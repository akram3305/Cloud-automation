"""
routers/sync.py — Real-time VM state streaming via Server-Sent Events.

Endpoint: GET /sync/stream?token=<jwt>
The browser EventSource API cannot send custom headers, so the JWT is
passed as a query parameter instead of the Authorization header.
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json

from database import SessionLocal
from models import VM
from routers.auth import decode_token

router = APIRouter(prefix="/sync", tags=["sync"])


async def _vm_event_stream(token: str):
    """Async generator that yields SSE-formatted VM state every 5 seconds."""
    payload = decode_token(token)
    if not payload:
        yield 'data: {"error":"unauthorized"}\n\n'
        return

    while True:
        try:
            db = SessionLocal()
            try:
                vms = db.query(VM).order_by(VM.created_at.desc()).all()
                data = [
                    {
                        "id":            v.id,
                        "instance_id":   v.instance_id,
                        "name":          v.name,
                        "state":         v.state,
                        "public_ip":     v.public_ip,
                        "private_ip":    v.private_ip,
                        "environment":   v.environment or "dev",
                        "instance_type": v.instance_type,
                        "region":        v.region,
                        "owner_username": v.owner_username,
                        "ami_id":        v.ami_id,
                        "auto_start":    v.auto_start,
                        "auto_stop":     v.auto_stop,
                        "created_at":    v.created_at.isoformat() if v.created_at else "",
                    }
                    for v in vms
                ]
            finally:
                db.close()

            yield f"data: {json.dumps(data)}\n\n"

        except asyncio.CancelledError:
            break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        await asyncio.sleep(5)


@router.get("/stream")
async def sync_stream(token: str = Query(..., description="JWT access token")):
    """
    Server-Sent Events endpoint that streams VM state every 5 seconds.
    Pass the JWT as ?token=<value> since EventSource cannot set headers.
    """
    # Quick auth check before opening the stream
    if not decode_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return StreamingResponse(
        _vm_event_stream(token),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "Connection":       "keep-alive",
            "X-Accel-Buffering":"no",     # disable Nginx buffering
        },
    )
