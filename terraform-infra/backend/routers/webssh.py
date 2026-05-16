# -*- coding: utf-8 -*-
"""
webssh.py — Browser-based SSH terminal via WebSocket + paramiko.

Flow:
  1. Client opens  ws://.../ws/ssh?token=<jwt>
  2. Backend validates JWT; if invalid → close(4401)
  3. Client sends  {"type":"init", host, port, username, auth_type, password|key_data, cols, rows}
  4. Backend opens SSH connection and invokes an interactive shell
  5. Bidirectional stream:
       client  → {"type":"data",   "data":"..."}          keyboard input
       client  → {"type":"resize", "cols":N, "rows":N}    terminal resize
       backend → {"type":"data",   "data":"..."}          terminal output
       backend → {"type":"connected"}                     SSH handshake done
       backend → {"type":"disconnected"}                  remote shell exited
       backend → {"type":"error",  "message":"..."}       any error
"""

import asyncio
import io
import json
import socket

import paramiko
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from config import JWT_ALGORITHM, JWT_SECRET

router = APIRouter(tags=["webssh"])


# ── helpers ───────────────────────────────────────────────────────────────────

async def _validate_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def _load_pkey(key_data: str):
    """Try RSA → Ed25519 → ECDSA for a PEM private key string."""
    for KeyClass in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey):
        try:
            return KeyClass.from_private_key(io.StringIO(key_data))
        except paramiko.SSHException:
            continue
    raise paramiko.SSHException("Unsupported or malformed private key")


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/ssh")
async def webssh_endpoint(websocket: WebSocket, token: str = Query(...)):
    """WebSocket SSH bridge — authenticated via JWT query param."""

    await websocket.accept()

    user = await _validate_token(token)
    if not user:
        await websocket.send_text(json.dumps({"type": "error", "message": "Unauthorized — please log in again"}))
        await websocket.close()
        return

    # ── Step 1: receive init config ──────────────────────────────────────────
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
        cfg = json.loads(raw)
    except (asyncio.TimeoutError, Exception):
        await websocket.close()
        return

    if cfg.get("type") != "init":
        await websocket.close()
        return

    host      = cfg.get("host", "").strip()
    port      = int(cfg.get("port", 22))
    username  = cfg.get("username", "").strip() or "root"
    auth_type = cfg.get("auth_type", "password")   # "password" | "key"
    password  = cfg.get("password", "")
    key_data  = cfg.get("key_data", "").strip()
    cols      = max(40, int(cfg.get("cols", 200)))
    rows      = max(10, int(cfg.get("rows",  50)))

    if not host:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": "Host is required"}))
        except Exception:
            pass
        await websocket.close()
        return

    # ── Step 2: SSH connect (blocking → thread pool) ─────────────────────────
    client  = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    channel = None
    loop    = asyncio.get_event_loop()

    try:
        def _connect():
            sock = socket.create_connection((host, port), timeout=15)
            if auth_type == "key" and key_data:
                pkey = _load_pkey(key_data)
                client.connect(
                    host, port=port, username=username, pkey=pkey,
                    sock=sock,
                    timeout=15, banner_timeout=15, auth_timeout=15,
                    allow_agent=False, look_for_keys=False,
                )
            else:
                client.connect(
                    host, port=port, username=username,
                    password=password or None,
                    sock=sock,
                    timeout=15, banner_timeout=15, auth_timeout=15,
                    allow_agent=False, look_for_keys=False,
                )

        await asyncio.wait_for(loop.run_in_executor(None, _connect), timeout=20)

        # ── Step 3: open interactive shell ───────────────────────────────────
        channel = client.invoke_shell(
            term="xterm-256color", width=cols, height=rows,
        )
        channel.setblocking(False)

        await websocket.send_text(json.dumps({"type": "connected"}))

        # ── Step 4: SSH → WS reader coroutine ────────────────────────────────
        async def _ssh_to_ws():
            while True:
                await asyncio.sleep(0.02)
                try:
                    if channel.recv_ready():
                        data = channel.recv(16384)
                        if data:
                            await websocket.send_text(json.dumps({
                                "type": "data",
                                "data": data.decode("utf-8", errors="replace"),
                            }))
                    if channel.recv_stderr_ready():
                        data = channel.recv_stderr(4096)
                        if data:
                            await websocket.send_text(json.dumps({
                                "type": "data",
                                "data": data.decode("utf-8", errors="replace"),
                            }))
                    if channel.closed or channel.exit_status_ready():
                        try:
                            await websocket.send_text(json.dumps({"type": "disconnected"}))
                        except Exception:
                            pass
                        return
                except Exception:
                    break

        read_task = asyncio.create_task(_ssh_to_ws())

        # ── Step 5: WS → SSH writer loop ─────────────────────────────────────
        try:
            while True:
                text = await websocket.receive_text()
                msg  = json.loads(text)
                t    = msg.get("type")
                if t == "data":
                    channel.send(msg.get("data", ""))
                elif t == "resize":
                    channel.resize_pty(
                        width=max(1, int(msg.get("cols", 80))),
                        height=max(1, int(msg.get("rows", 24))),
                    )
                elif t == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
        except WebSocketDisconnect:
            pass
        finally:
            read_task.cancel()

    # ── Error handling ────────────────────────────────────────────────────────
    except paramiko.AuthenticationException as exc:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"Authentication failed: {exc}"}))
        except Exception:
            pass
    except asyncio.TimeoutError:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"Connection timed out — check that port 22 is open on {host}"}))
        except Exception:
            pass
    except (socket.timeout, paramiko.ssh_exception.NoValidConnectionsError, OSError) as exc:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": f"Connection failed: {exc}"}))
        except Exception:
            pass
    except Exception as exc:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
        except Exception:
            pass
    finally:
        try:
            client.close()
        except Exception:
            pass
