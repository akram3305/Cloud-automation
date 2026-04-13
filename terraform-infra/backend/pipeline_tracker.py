# -*- coding: utf-8 -*-
"""
pipeline_tracker.py — Thread-safe in-memory stage tracker

Tracks live Terraform pipeline progress per request.
State lives in memory only — survives restarts via DB status fallback.
"""
import time
from threading import Lock

_lock  = Lock()
_state: dict = {}   # { request_id: PipelineState }

STAGE_ORDER = ["generating", "init", "plan", "apply"]


def _empty_stages() -> dict:
    return {
        s: {"status": "pending", "started_at": None, "finished_at": None, "duration": None}
        for s in STAGE_ORDER
    }


def init_pipeline(request_id: int) -> None:
    with _lock:
        _state[request_id] = {
            "stages":         _empty_stages(),
            "current_stage":  "generating",
            "logs":           [],
            "overall_status": "running",
            "started_at":     time.time(),
            "finished_at":    None,
        }


def set_stage(request_id: int, stage: str, status: str) -> None:
    """
    status: 'running' | 'done' | 'failed'
    """
    with _lock:
        if request_id not in _state or stage not in STAGE_ORDER:
            return
        s = _state[request_id]["stages"][stage]
        s["status"] = status
        if status == "running":
            s["started_at"] = time.time()
            _state[request_id]["current_stage"] = stage
        elif status in ("done", "failed"):
            s["finished_at"] = time.time()
            if s["started_at"]:
                s["duration"] = round(s["finished_at"] - s["started_at"], 1)
            if status == "failed":
                _state[request_id]["overall_status"] = "failed"
                _state[request_id]["finished_at"]    = time.time()


def append_log(request_id: int, line: str) -> None:
    with _lock:
        if request_id in _state:
            _state[request_id]["logs"].append({
                "t":   round(time.time(), 3),
                "msg": line,
            })


def complete_pipeline(request_id: int) -> None:
    with _lock:
        if request_id in _state:
            _state[request_id]["overall_status"] = "complete"
            _state[request_id]["finished_at"]    = time.time()
            # Mark apply as done if not already
            apply = _state[request_id]["stages"]["apply"]
            if apply["status"] == "running":
                apply["status"]      = "done"
                apply["finished_at"] = time.time()
                if apply["started_at"]:
                    apply["duration"] = round(apply["finished_at"] - apply["started_at"], 1)


def fail_pipeline(request_id: int) -> None:
    with _lock:
        if request_id in _state:
            _state[request_id]["overall_status"] = "failed"
            _state[request_id]["finished_at"]    = time.time()
            # Mark current running stage as failed
            for s_data in _state[request_id]["stages"].values():
                if s_data["status"] == "running":
                    s_data["status"]      = "failed"
                    s_data["finished_at"] = time.time()
                    if s_data["started_at"]:
                        s_data["duration"] = round(s_data["finished_at"] - s_data["started_at"], 1)


def get_state(request_id: int) -> dict:
    with _lock:
        raw = _state.get(request_id)
        if not raw:
            return {}
        # Return deep-enough copy for the endpoint
        return {
            "stages":         {k: dict(v) for k, v in raw["stages"].items()},
            "current_stage":  raw["current_stage"],
            "logs":           list(raw["logs"]),
            "overall_status": raw["overall_status"],
            "started_at":     raw["started_at"],
            "finished_at":    raw["finished_at"],
        }
