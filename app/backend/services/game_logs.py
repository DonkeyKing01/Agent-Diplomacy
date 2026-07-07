import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_LOG_ROOT = Path(__file__).resolve().parent.parent / "logs" / "game_sessions"


def _safe_session_key(session_key: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", session_key.strip())
    return cleaned or "main"


def game_log_path(session_key: str) -> Path:
    _LOG_ROOT.mkdir(parents=True, exist_ok=True)
    return _LOG_ROOT / f"{_safe_session_key(session_key)}.log"


def reset_game_log(session_key: str, context: Dict[str, Any] | None = None) -> Path:
    path = game_log_path(session_key)
    header = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "event": "session_log_reset",
        "session_key": session_key,
        "context": context or {},
    }
    path.write_text(json.dumps(header, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info("Reset gameplay log for session %s at %s", session_key, path)
    return path


def append_game_log(session_key: str, event: str, payload: Dict[str, Any]) -> Path:
    path = game_log_path(session_key)
    if not path.exists():
        reset_game_log(session_key, {"auto_created": True})
    record = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "event": event,
        "session_key": session_key,
        "payload": payload,
    }
    with path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, ensure_ascii=False) + "\n")
    return path


def read_game_log(session_key: str) -> List[Dict[str, Any]]:
    path = game_log_path(session_key)
    if not path.exists():
        return []

    records: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                logger.warning("Skipping malformed gameplay log line in %s", path)
                continue
            if isinstance(payload, dict):
                records.append(payload)
    return records
