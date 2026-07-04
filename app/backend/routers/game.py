"""Agent Diplomacy game routes backed by the real database and a real LLM."""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from services.aihub import AIHubService
from services.chronicles import ChroniclesService
from services.diplo_messages import Diplo_messagesService
from services.game_engine import (
    DECISION_PHASES,
    NATIONS,
    NATION_IDS,
    PHASES,
    PROVINCES,
    SESSION_KEY_DEFAULT,
    START_YEAR,
    _seed_rng,
    adjudicate,
    default_agent_profile,
    initial_board,
    nation_name,
    next_phase_index,
    phase_at,
    province_name,
    recount_sc,
    resolve_winter,
)
from services.game_sessions import Game_sessionsService
from services.nation_agents import Nation_agentsService
from services.war_reports import War_reportsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/game", tags=["game"])

DEFAULT_GAME_LLM_MODEL = "deepseek-v4-flash"
FALLBACK_GAME_LLM_MODEL = "deepseek-v4-pro"


class InitRequest(BaseModel):
    session_key: str = SESSION_KEY_DEFAULT
    reset: bool = False


class AdvanceRequest(BaseModel):
    session_key: str = SESSION_KEY_DEFAULT


class AgentUpdateRequest(BaseModel):
    session_key: str = SESSION_KEY_DEFAULT
    nation_id: str
    system_prompt: Optional[str] = None
    skills_md: Optional[str] = None
    memory: Optional[str] = None
    annual_advice: Optional[str] = None
    aggression: Optional[int] = None
    loyalty: Optional[int] = None
    cunning: Optional[int] = None


class ScAdjustItem(BaseModel):
    nation_id: str
    sc: int


class ScAdjustRequest(BaseModel):
    session_key: str = SESSION_KEY_DEFAULT
    endowments: List[ScAdjustItem]


def _agent_to_dict(agent: Any) -> Dict[str, Any]:
    return {
        "id": agent.id,
        "nation_id": agent.nation_id,
        "nation_name": agent.nation_name,
        "system_prompt": agent.system_prompt or "",
        "skills_md": agent.skills_md or "",
        "memory": agent.memory or "",
        "annual_advice": agent.annual_advice or "",
        "aggression": agent.aggression if agent.aggression is not None else 50,
        "loyalty": agent.loyalty if agent.loyalty is not None else 50,
        "cunning": agent.cunning if agent.cunning is not None else 50,
    }


async def _load_agents(db: AsyncSession, session_key: str) -> Dict[str, Dict[str, Any]]:
    rows = await Nation_agentsService(db).list_by_field("session_key", session_key, skip=0, limit=100)
    return {row.nation_id: _agent_to_dict(row) for row in rows}


async def _load_session(db: AsyncSession, session_key: str):
    return await Game_sessionsService(db).get_by_field("session_key", session_key)


def _phase_meta(phase_index: int) -> Dict[str, str]:
    return phase_at(phase_index)


def _session_state(session: Any) -> Dict[str, Any]:
    phase = _phase_meta(session.phase_index)
    return {
        "id": session.id,
        "session_key": session.session_key,
        "year": session.year,
        "phase_index": session.phase_index,
        "phase_key": phase["key"],
        "phase_label": phase["label"],
        "season": phase["season"],
        "status": session.status,
        "engine": session.engine or "llm",
        "ownership": json.loads(session.provinces_json or "{}"),
        "units": json.loads(session.units_json or "[]"),
        "scCount": json.loads(session.sc_json or "{}"),
        "nations": json.loads(session.nations_json or "[]"),
        "lastOrders": json.loads(session.last_orders_json or "{}"),
    }


def _extract_json_block(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start:end + 1]
    return text


def _units_of(state: Dict[str, Any], nation_id: str) -> List[Dict[str, str]]:
    return [unit for unit in state["units"] if unit["owner"] == nation_id]


def _get_game_llm_models() -> List[str]:
    models: List[str] = []
    try:
        configured = settings.game_llm_model
    except AttributeError:
        configured = DEFAULT_GAME_LLM_MODEL
    for model in (configured, DEFAULT_GAME_LLM_MODEL, FALLBACK_GAME_LLM_MODEL):
        if model and model not in models:
            models.append(model)
    return models


def _build_situation(state: Dict[str, Any]) -> str:
    lines = [f"Current phase: {state['year']} {state['phase_label']}.", "Supply centers by nation:"]
    for nation_id in NATION_IDS:
        lines.append(f"- {nation_name(nation_id)}: {state['scCount'].get(nation_id, 0)}")
    lines.append("Units on the board:")
    for unit in state["units"]:
        lines.append(
            f"- {nation_name(unit['owner'])} {unit['type']} @ {province_name(unit['location'])} ({unit['location']})"
        )
    return "\n".join(lines)


def _build_unit_options(state: Dict[str, Any], nation_id: str) -> List[Dict[str, Any]]:
    options: List[Dict[str, Any]] = []
    for unit in _units_of(state, nation_id):
        location = unit["location"]
        unit_type = unit["type"]
        legal_moves: List[str] = []
        for province_id in PROVINCES.get(location, {}).get("adj", []):
            province_type = PROVINCES[province_id]["type"]
            if unit_type == "Army" and province_type != "sea":
                legal_moves.append(province_id)
            elif unit_type == "Fleet" and province_type != "land":
                legal_moves.append(province_id)
        options.append(
            {
                "unit_province": location,
                "unit_name": province_name(location),
                "unit_type": unit_type,
                "legal_moves": legal_moves,
            }
        )
    return options


def _message_content_or_empty(message: Any) -> str:
    return (getattr(message, "content", None) or "").strip()


async def _llm_decide(service: AIHubService, agent: Dict[str, Any], state: Dict[str, Any], situation: str) -> Dict[str, Any]:
    nation_id = agent["nation_id"]
    units = _build_unit_options(state, nation_id)
    if not units:
        return {"orders": [], "messages": []}

    system_prompt = "\n".join(
        [
            f"You are the strategic decision engine for {agent['nation_name']} in a Diplomacy-like game.",
            "Return exactly one JSON object and no markdown, no prose, no reasoning.",
            "Schema:",
            '{"orders":[{"unit_province":"id","action":"Move|Hold|Support|Convoy","target":"id or empty","support_of":"id or empty"}],"messages":[{"to_nation":"nation id or public","intent":"alliance|probe|threat|betrayal|peace|coordination","content":"short diplomatic message"}]}',
            "Rules:",
            "- Include at most one order per own unit.",
            "- For action=Move, target must be one of that unit's legal_moves.",
            "- If unsure, use Hold.",
            "- messages may contain 0 to 2 items.",
            "- Never invent province ids or nation ids.",
        ]
    )
    user_payload = {
        "nation_id": nation_id,
        "nation_name": agent["nation_name"],
        "personality": {
            "aggression": agent["aggression"],
            "loyalty": agent["loyalty"],
            "cunning": agent["cunning"],
        },
        "system_prompt": agent["system_prompt"] or "",
        "skills_md": agent["skills_md"] or "",
        "memory": agent["memory"] or "",
        "annual_advice": agent["annual_advice"] or "",
        "situation_summary": situation,
        "allowed_nation_ids": list(NATION_IDS) + ["public"],
        "units": units,
    }

    client: AsyncOpenAI = service._require_ai_client()
    last_error: Optional[str] = None
    for model in _get_game_llm_models():
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                response_format={"type": "json_object"},
                extra_body={"thinking": {"type": "disabled"}},
                temperature=0.1,
                max_tokens=1500,
                stream=False,
            )
            raw = _message_content_or_empty(response.choices[0].message)
            if not raw:
                last_error = f"{model} returned empty content"
                continue
            payload = json.loads(_extract_json_block(raw))
            if not isinstance(payload, dict):
                last_error = f"{model} returned non-object JSON"
                continue
            payload.setdefault("orders", [])
            payload.setdefault("messages", [])
            return payload
        except Exception as exc:  # noqa: BLE001
            last_error = f"{model} failed: {exc}"
            logger.error("LLM decide failed for %s with %s: %s", nation_id, model, exc)

    raise RuntimeError(last_error or f"LLM decision failed for {nation_id}")


def _validate_orders(nation_id: str, raw_orders: Any, state: Dict[str, Any]) -> List[Dict[str, str]]:
    my_units = {unit["location"]: unit for unit in state["units"] if unit["owner"] == nation_id}
    valid_orders: List[Dict[str, str]] = []
    seen_units = set()
    if not isinstance(raw_orders, list):
        return valid_orders

    for order in raw_orders:
        if not isinstance(order, dict):
            continue
        unit_province = order.get("unit_province")
        if unit_province not in my_units or unit_province in seen_units:
            continue

        action = order.get("action", "Hold")
        if action not in ("Move", "Hold", "Support", "Convoy"):
            action = "Hold"

        target = order.get("target", "") or ""
        if action == "Move":
            unit_type = my_units[unit_province]["type"]
            adjacency = PROVINCES.get(unit_province, {}).get("adj", [])
            target_type = PROVINCES.get(target, {}).get("type")
            is_legal = target in adjacency and (
                (unit_type == "Army" and target_type != "sea") or
                (unit_type == "Fleet" and target_type != "land")
            )
            if not is_legal:
                action = "Hold"
                target = ""

        seen_units.add(unit_province)
        valid_orders.append(
            {
                "unit_province": unit_province,
                "action": action,
                "target": target,
                "support_of": order.get("support_of", "") or "",
            }
        )
    return valid_orders


def _validate_messages(nation_id: str, raw_messages: Any) -> List[Dict[str, str]]:
    valid_messages: List[Dict[str, str]] = []
    if not isinstance(raw_messages, list):
        return valid_messages

    valid_targets = set(NATION_IDS) | {"public"}
    for message in raw_messages[:2]:
        if not isinstance(message, dict):
            continue
        content = (message.get("content") or "").strip()
        if not content:
            continue
        to_nation = message.get("to_nation", "public")
        if to_nation not in valid_targets or to_nation == nation_id:
            to_nation = "public"
        valid_messages.append(
            {
                "from_nation": nation_id,
                "to_nation": to_nation,
                "intent": message.get("intent", "probe"),
                "content": content,
            }
        )
    return valid_messages


@router.post("/init")
async def init_game(data: InitRequest, db: AsyncSession = Depends(get_db)):
    """Initialize or reset the live game and seed nation agents."""
    session_key = data.session_key or SESSION_KEY_DEFAULT
    session_service = Game_sessionsService(db)
    agent_service = Nation_agentsService(db)
    existing = await session_service.get_by_field("session_key", session_key)

    if existing and not data.reset:
        if not await _load_agents(db, session_key):
            for nation_id in NATION_IDS:
                await agent_service.create({"session_key": session_key, **default_agent_profile(nation_id)})
        state = _session_state(await session_service.get_by_field("session_key", session_key))
        state["agents"] = await _load_agents(db, session_key)
        return {"created": False, "state": state}

    provinces, units, sc_count = initial_board()
    payload = {
        "session_key": session_key,
        "year": START_YEAR,
        "season": PHASES[0]["key"],
        "phase_index": 0,
        "status": "running",
        "provinces_json": json.dumps(provinces, ensure_ascii=False),
        "units_json": json.dumps(units, ensure_ascii=False),
        "sc_json": json.dumps(sc_count, ensure_ascii=False),
        "nations_json": json.dumps(NATIONS, ensure_ascii=False),
        "last_orders_json": json.dumps({}, ensure_ascii=False),
        "engine": "llm",
    }
    if existing and data.reset:
        await session_service.update(existing.id, payload)
        for service_cls in (Diplo_messagesService, War_reportsService, ChroniclesService, Nation_agentsService):
            service = service_cls(db)
            for row in await service.list_by_field("session_key", session_key, skip=0, limit=2000):
                await service.delete(row.id)
    else:
        await session_service.create(payload)

    for nation_id in NATION_IDS:
        await agent_service.create({"session_key": session_key, **default_agent_profile(nation_id)})

    state = _session_state(await session_service.get_by_field("session_key", session_key))
    state["agents"] = await _load_agents(db, session_key)
    return {"created": True, "state": state}


@router.get("/state")
async def get_state(session_key: str = SESSION_KEY_DEFAULT, db: AsyncSession = Depends(get_db)):
    """Read the full persisted game state for any device or host."""
    session = await _load_session(db, session_key)
    if not session:
        return {"exists": False}

    state = _session_state(session)
    state["agents"] = await _load_agents(db, session_key)

    messages = await Diplo_messagesService(db).list_by_field("session_key", session_key, skip=0, limit=500)
    reports = await War_reportsService(db).list_by_field("session_key", session_key, skip=0, limit=500)
    chronicles = await ChroniclesService(db).list_by_field("session_key", session_key, skip=0, limit=200)

    state["messages"] = [
        {
            "id": row.id,
            "year": row.year,
            "phaseLabel": row.season,
            "from": row.from_nation,
            "to": row.to_nation,
            "intent": row.intent,
            "content": row.content,
        }
        for row in messages
    ]
    state["reports"] = [
        {
            "id": row.id,
            "year": row.year,
            "phaseLabel": row.season,
            "phase_index": row.phase_index,
            "headline": row.headline,
            "body": row.body,
        }
        for row in reports
    ]
    state["history"] = [
        {
            "id": row.id,
            "year": row.year,
            "summary": row.summary,
            "scSnapshot": json.loads(row.sc_snapshot_json or "{}"),
        }
        for row in chronicles
    ]
    return {"exists": True, "state": state}


@router.post("/advance")
async def advance_phase(data: AdvanceRequest, db: AsyncSession = Depends(get_db)):
    """Advance one phase. Decision phases require a real LLM result."""
    session_key = data.session_key or SESSION_KEY_DEFAULT
    session = await _load_session(db, session_key)
    if not session:
        raise HTTPException(status_code=404, detail="Game session not initialized.")

    state = _session_state(session)
    agents = await _load_agents(db, session_key)
    session_id = int(session.id)
    year = state["year"]
    phase_index = state["phase_index"]
    phase = _phase_meta(phase_index)
    phase_label = f"{year} {phase['label']}"
    await db.rollback()

    rng = _seed_rng(session_key, year, phase_index)
    orders: Dict[str, List[Dict[str, str]]] = {nation_id: [] for nation_id in NATION_IDS}
    new_messages: List[Dict[str, str]] = []
    report_headline = f"{year} {phase['label']}"
    report_lines: List[str] = [f"{phase_label} resolved."]
    new_ownership = state["ownership"]
    new_units = state["units"]

    if phase["key"] in DECISION_PHASES:
        try:
            service = AIHubService()
            situation = _build_situation(state)
            for nation_id in NATION_IDS:
                agent = agents.get(nation_id) or default_agent_profile(nation_id)
                decision = await _llm_decide(service, agent, state, situation)
                orders[nation_id] = _validate_orders(nation_id, decision.get("orders"), state)
                new_messages.extend(_validate_messages(nation_id, decision.get("messages")))
        except Exception as exc:  # noqa: BLE001
            logger.error("LLM advance pipeline error: %s", exc)
            raise HTTPException(status_code=502, detail=f"LLM decision pipeline failed: {exc}") from exc

        new_ownership, new_units, conflicts = adjudicate(state["ownership"], state["units"], orders, rng)
        move_lines = [
            f"{nation_name(nation_id)} {province_name(order['unit_province'])} -> {province_name(order['target'])}"
            for nation_id, order_list in orders.items()
            for order in order_list
            if order["action"] == "Move" and order.get("target")
        ]
        report_lines.append("Movements: " + ("; ".join(move_lines) if move_lines else "No successful move orders."))
        if conflicts:
            conflict_lines = []
            for conflict in conflicts:
                province = conflict.get("province_name") or conflict.get("province") or "unknown"
                kind = conflict.get("kind") or "conflict"
                winner = conflict.get("winner")
                if winner:
                    conflict_lines.append(f"{province}: {kind} (winner: {winner})")
                else:
                    conflict_lines.append(f"{province}: {kind}")
            report_lines.append("Conflicts: " + "; ".join(conflict_lines))

    elif phase["key"] == "winter":
        new_units, winter_logs = resolve_winter(state["ownership"], state["units"], rng)
        report_lines.append(
            "Winter adjustments: " + ("; ".join(winter_logs) if winter_logs else "No winter adjustments required.")
        )

    elif phase["key"] in ("springRetreat", "autumnRetreat"):
        report_lines.append("Retreat phase resolved deterministically.")

    new_sc = recount_sc(new_ownership)
    sc_rank = sorted(new_sc.items(), key=lambda item: item[1], reverse=True)
    report_lines.append("Supply centers: " + "; ".join(f"{nation_name(n)} {v}" for n, v in sc_rank if v > 0))
    report_body = "\n".join(report_lines)

    next_phase, next_year = next_phase_index(phase_index, year)
    await Game_sessionsService(db).update(
        session_id,
        {
            "year": next_year,
            "season": PHASES[next_phase]["key"],
            "phase_index": next_phase,
            "status": "running",
            "provinces_json": json.dumps(new_ownership, ensure_ascii=False),
            "units_json": json.dumps(new_units, ensure_ascii=False),
            "sc_json": json.dumps(new_sc, ensure_ascii=False),
            "last_orders_json": json.dumps(orders, ensure_ascii=False),
            "engine": "llm",
        },
    )

    message_service = Diplo_messagesService(db)
    for message in new_messages:
        await message_service.create(
            {
                "session_key": session_key,
                "year": year,
                "season": phase_label,
                "from_nation": message["from_nation"],
                "to_nation": message["to_nation"],
                "intent": message.get("intent", "probe"),
                "content": message["content"],
            }
        )

    await War_reportsService(db).create(
        {
            "session_key": session_key,
            "year": year,
            "season": phase_label,
            "phase_index": next_phase,
            "headline": report_headline,
            "body": report_body,
        }
    )

    if phase["key"] == "review":
        leader = sc_rank[0] if sc_rank else (None, 0)
        summary = "Year review concluded."
        if leader[0]:
            summary += f" {nation_name(leader[0])} leads with {leader[1]} supply centers."
        await ChroniclesService(db).create(
            {
                "session_key": session_key,
                "year": year,
                "summary": summary,
                "sc_snapshot_json": json.dumps(new_sc, ensure_ascii=False),
            }
        )

    return await get_state(session_key=session_key, db=db)


@router.post("/agent")
async def update_agent(data: AgentUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Update a nation agent profile."""
    session_key = data.session_key or SESSION_KEY_DEFAULT
    service = Nation_agentsService(db)
    rows = await service.list_by_field("session_key", session_key, skip=0, limit=100)
    target = next((row for row in rows if row.nation_id == data.nation_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Nation agent profile not found.")

    update: Dict[str, Any] = {}
    for field in ("system_prompt", "skills_md", "memory", "annual_advice", "aggression", "loyalty", "cunning"):
        value = getattr(data, field)
        if value is not None:
            update[field] = value
    if not update:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    updated = await service.update(target.id, update)
    return {"ok": True, "agent": _agent_to_dict(updated)}


@router.post("/sc_endowment")
async def adjust_sc(data: ScAdjustRequest, db: AsyncSession = Depends(get_db)):
    """Adjust the supply-center snapshot for a live session."""
    session_key = data.session_key or SESSION_KEY_DEFAULT
    session = await _load_session(db, session_key)
    if not session:
        raise HTTPException(status_code=404, detail="Game session not initialized.")

    sc_count = json.loads(session.sc_json or "{}")
    for item in data.endowments:
        if item.nation_id in NATION_IDS:
            sc_count[item.nation_id] = max(0, int(item.sc))

    await Game_sessionsService(db).update(session.id, {"sc_json": json.dumps(sc_count, ensure_ascii=False)})
    return {"ok": True, "sc": sc_count}
