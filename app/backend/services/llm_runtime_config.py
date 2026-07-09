import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

from core.config import settings

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
RUNTIME_CONFIG_PATH = RUNTIME_DIR / "llm_config.local.json"
SUPPORTED_PROVIDERS = {"openai", "anthropic", "gemini"}


def _provider_defaults() -> Dict[str, Dict[str, str]]:
    return {
        "openai": {
            "api_key": settings.app_ai_key or "",
            "base_url": settings.app_ai_base_url or "",
            "model": settings.game_llm_model or "deepseek-v4-flash",
        },
        "anthropic": {
            "api_key": os.environ.get("ANTHROPIC_API_KEY", ""),
            "base_url": os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
            "model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        },
        "gemini": {
            "api_key": os.environ.get("GEMINI_API_KEY", ""),
            "base_url": os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"),
            "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-pro"),
        },
    }


def _default_runtime_config() -> Dict[str, Any]:
    return {
        "active_provider": os.environ.get("GAME_LLM_PROVIDER", "openai"),
        "openai": _provider_defaults()["openai"],
        "anthropic": _provider_defaults()["anthropic"],
        "gemini": _provider_defaults()["gemini"],
        "updated_at": None,
    }


def _normalize_provider_name(value: Any) -> str:
    provider = str(value or "openai").strip().lower()
    return provider if provider in SUPPORTED_PROVIDERS else "openai"


def _normalize_provider_config(payload: Any, defaults: Dict[str, str]) -> Dict[str, str]:
    current = deepcopy(defaults)
    if isinstance(payload, dict):
        for field in ("api_key", "base_url", "model"):
            if field in payload and payload[field] is not None:
                current[field] = str(payload[field]).strip()
    return current


def _normalize_runtime_config(payload: Any) -> Dict[str, Any]:
    defaults = _default_runtime_config()
    source = payload if isinstance(payload, dict) else {}
    return {
        "active_provider": _normalize_provider_name(source.get("active_provider", defaults["active_provider"])),
        "openai": _normalize_provider_config(source.get("openai"), defaults["openai"]),
        "anthropic": _normalize_provider_config(source.get("anthropic"), defaults["anthropic"]),
        "gemini": _normalize_provider_config(source.get("gemini"), defaults["gemini"]),
        "updated_at": source.get("updated_at") if isinstance(source.get("updated_at"), str) else None,
    }


def load_llm_runtime_config() -> Dict[str, Any]:
    defaults = _default_runtime_config()
    if not RUNTIME_CONFIG_PATH.exists():
        return defaults
    try:
        payload = json.loads(RUNTIME_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return defaults
    merged = _normalize_runtime_config(payload)
    if not merged.get("updated_at"):
        merged["updated_at"] = defaults.get("updated_at")
    return merged


def save_llm_runtime_config(payload: Dict[str, Any]) -> Dict[str, Any]:
    next_config = _normalize_runtime_config(payload)
    next_config["updated_at"] = datetime.now(timezone.utc).isoformat()
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_CONFIG_PATH.write_text(json.dumps(next_config, ensure_ascii=False, indent=2), encoding="utf-8")
    return next_config


def active_llm_runtime_config() -> Tuple[str, Dict[str, str], Dict[str, Any]]:
    config = load_llm_runtime_config()
    provider = _normalize_provider_name(config.get("active_provider"))
    return provider, deepcopy(config[provider]), config


def openai_runtime_config() -> Dict[str, str]:
    return deepcopy(load_llm_runtime_config()["openai"])
