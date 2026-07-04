"""Agent Diplomacy game engine (backend authoritative).

Mirrors the frontend map topology EXACTLY (same nation ids, province ids,
adjacency and initial units) so persisted backend state maps 1:1 onto the
existing SVG strategic map. Pure logic only: no DB, no AI. The router
orchestrates persistence and LLM calls.

State stored as JSON strings on game_sessions:
- provinces_json: {province_id: owner_nation_id or ""}  (""=neutral)
- units_json: [{"owner","type","location"}]  (type: Army|Fleet)
- sc_json: {nation_id: supply_center_count}
- nations_json: [{"id","name","short","color"}]
- last_orders_json: {nation_id: [order,...]}
"""

import hashlib
import random
from typing import Any, Dict, List, Optional, Tuple

SESSION_KEY_DEFAULT = "main"

# Six-phase yearly cycle mirrors the frontend PHASES.
PHASES: List[Dict[str, str]] = [
    {"key": "spring", "label": "春季·谈判与决策", "season": "春季"},
    {"key": "springRetreat", "label": "春季撤退", "season": "春季"},
    {"key": "autumn", "label": "秋季·谈判与决策", "season": "秋季"},
    {"key": "autumnRetreat", "label": "秋季撤退", "season": "秋季"},
    {"key": "winter", "label": "冬季调整", "season": "冬季"},
    {"key": "review", "label": "年度复盘与治理", "season": "冬季"},
]
DECISION_PHASES = {"spring", "autumn"}

# Kept for backward-compat imports; season strings here are phase keys.
SEASON_CN = {p["key"]: p["label"] for p in PHASES}

START_YEAR = 1901

# --- 10 nations (mirror frontend engine.ts) ----------------------------------
NATIONS: List[Dict[str, str]] = [
    {"id": "aur", "name": "奥瑞利亚帝国", "short": "奥瑞利亚", "color": "#e0533f"},
    {"id": "mar", "name": "玛琳诺海洋共和国", "short": "玛琳诺", "color": "#2d8fd0"},
    {"id": "vel", "name": "维尔登王国", "short": "维尔登", "color": "#6f57c8"},
    {"id": "kaz", "name": "卡兹汗国", "short": "卡兹", "color": "#d98a2b"},
    {"id": "sol", "name": "索拉里斯教国", "short": "索拉里斯", "color": "#e6c229"},
    {"id": "nor", "name": "诺瓦克联邦", "short": "诺瓦克", "color": "#3aa676"},
    {"id": "ferr", "name": "费罗斯工业同盟", "short": "费罗斯", "color": "#b0563e"},
    {"id": "zeph", "name": "泽菲兰群岛联盟", "short": "泽菲兰", "color": "#4cc0c0"},
    {"id": "dra", "name": "德拉肯高地", "short": "德拉肯", "color": "#8a8f98"},
    {"id": "ith", "name": "伊萨里绿洲城邦", "short": "伊萨里", "color": "#c86fa0"},
]
NATION_IDS = [n["id"] for n in NATIONS]
NATION_NAME = {n["id"]: n["name"] for n in NATIONS}
NATION_SHORT = {n["id"]: n["short"] for n in NATIONS}

# --- Hex grid map (flat-top axial), MUST mirror frontend hexmap.ts EXACTLY ----
# Each province occupies one axial cell (q, r). Adjacency is derived strictly
# from the 6 hex neighbors, identical to the frontend, so that move/attack/
# support/convoy legality validation is 1:1 consistent across both ends.
# cell: id -> (name, type, sc, q, r); type in {"land","coast","sea"}
_HEX_CELLS: List[Dict[str, Any]] = [
    # Northern continent
    {"id": "aur_north", "name": "北疆冻原", "type": "land", "sc": True, "q": 0, "r": 0},
    {"id": "dra_peak", "name": "龙脊峰", "type": "land", "sc": True, "q": 1, "r": -1},
    {"id": "dra_cap", "name": "德拉肯要塞", "type": "land", "sc": True, "q": 2, "r": -1},
    {"id": "kaz_steppe", "name": "苍狼草原", "type": "land", "sc": True, "q": 3, "r": -1},
    {"id": "kaz_cap", "name": "卡兹汗庭", "type": "land", "sc": True, "q": 4, "r": -1},
    {"id": "aur_cap", "name": "奥瑞京畿", "type": "land", "sc": True, "q": 1, "r": 0},
    {"id": "dra_pass", "name": "幽谷隘口", "type": "land", "sc": False, "q": 2, "r": 0},
    {"id": "sol_gate", "name": "圣光之门", "type": "land", "sc": False, "q": 3, "r": 0},
    {"id": "kaz_oasis", "name": "金沙绿洲", "type": "land", "sc": True, "q": 4, "r": 0},
    {"id": "aur_port", "name": "铁湾港", "type": "coast", "sc": True, "q": 0, "r": 1},
    {"id": "ferr_mine", "name": "深铁矿脉", "type": "land", "sc": True, "q": 1, "r": 1},
    {"id": "sol_temple", "name": "神谕圣殿", "type": "land", "sc": True, "q": 2, "r": 1},
    {"id": "sol_cap", "name": "索拉里斯圣城", "type": "land", "sc": True, "q": 3, "r": 1},
    {"id": "ith_spring", "name": "甘泉圣井", "type": "land", "sc": True, "q": 4, "r": 1},
    {"id": "ferr_forge", "name": "烈焰锻炉", "type": "coast", "sc": True, "q": 0, "r": 2},
    {"id": "ferr_cap", "name": "费罗斯钢都", "type": "land", "sc": True, "q": 1, "r": 2},
    {"id": "nor_wood", "name": "翠影林地", "type": "land", "sc": True, "q": 2, "r": 2},
    {"id": "ith_market", "name": "伊萨里商栈", "type": "land", "sc": True, "q": 3, "r": 2},
    {"id": "ith_cap", "name": "绿洲王庭", "type": "land", "sc": True, "q": 4, "r": 2},
    {"id": "mar_dock", "name": "珊瑚船坞", "type": "coast", "sc": True, "q": 0, "r": 3},
    {"id": "nor_lake", "name": "静水湖区", "type": "coast", "sc": True, "q": 1, "r": 3},
    {"id": "nor_cap", "name": "诺瓦克联邦厅", "type": "land", "sc": True, "q": 2, "r": 3},
    {"id": "vel_cap", "name": "维尔登王城", "type": "land", "sc": True, "q": 3, "r": 3},
    {"id": "mar_cap", "name": "玛琳诺商都", "type": "coast", "sc": True, "q": 0, "r": 4},
    {"id": "vel_ford", "name": "维尔登渡口", "type": "land", "sc": True, "q": 1, "r": 4},
    {"id": "vel_hill", "name": "维尔登丘陵", "type": "land", "sc": True, "q": 2, "r": 4},
    # Islands
    {"id": "zeph_reef", "name": "碧波礁群", "type": "coast", "sc": True, "q": 5, "r": 0},
    {"id": "zeph_cap", "name": "泽菲兰主岛", "type": "coast", "sc": True, "q": 5, "r": 1},
    {"id": "zeph_bay", "name": "风信湾", "type": "coast", "sc": True, "q": 5, "r": 2},
    {"id": "mar_isle", "name": "灯塔孤岛", "type": "coast", "sc": True, "q": -1, "r": 5},
    # Seas
    {"id": "sea_north", "name": "北冥海", "type": "sea", "sc": False, "q": -1, "r": 1},
    {"id": "sea_central", "name": "中央大洋", "type": "sea", "sc": False, "q": -1, "r": 3},
    {"id": "sea_south", "name": "南珀海", "type": "sea", "sc": False, "q": -1, "r": 4},
    {"id": "sea_east", "name": "东陲汪洋", "type": "sea", "sc": False, "q": 5, "r": -1},
    {"id": "sea_reach", "name": "寒风海峡", "type": "sea", "sc": False, "q": 0, "r": -1},
]

# flat-top hex neighbor offsets (identical to frontend HEX_DIRECTIONS)
_HEX_DIRECTIONS = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]


def _build_provinces() -> Dict[str, Dict[str, Any]]:
    by_axial = {(c["q"], c["r"]): c["id"] for c in _HEX_CELLS}
    provinces: Dict[str, Dict[str, Any]] = {}
    for c in _HEX_CELLS:
        adj: List[str] = []
        for dq, dr in _HEX_DIRECTIONS:
            nb = by_axial.get((c["q"] + dq, c["r"] + dr))
            if nb:
                adj.append(nb)
        provinces[c["id"]] = {
            "name": c["name"],
            "type": c["type"],
            "sc": c["sc"],
            "q": c["q"],
            "r": c["r"],
            "adj": adj,
        }
    return provinces


PROVINCES: Dict[str, Dict[str, Any]] = _build_provinces()

# Home supply centers per nation (mirror frontend homeCenters). vel now owns
# three real hex tiles (vel_cap/vel_ford/vel_hill) in the southern continent.
HOME_CENTERS: Dict[str, List[str]] = {
    "aur": ["aur_cap", "aur_port", "aur_north"],
    "mar": ["mar_cap", "mar_isle", "mar_dock"],
    "vel": ["vel_cap", "vel_hill", "vel_ford"],
    "kaz": ["kaz_cap", "kaz_steppe", "kaz_oasis"],
    "sol": ["sol_cap", "sol_temple", "sol_gate"],
    "nor": ["nor_cap", "nor_lake", "nor_wood"],
    "ferr": ["ferr_cap", "ferr_forge", "ferr_mine"],
    "zeph": ["zeph_cap", "zeph_reef", "zeph_bay"],
    "dra": ["dra_cap", "dra_peak", "dra_pass"],
    "ith": ["ith_cap", "ith_market", "ith_spring"],
}

# Initial units (mirror frontend INITIAL_UNITS).
INITIAL_UNITS: List[Dict[str, str]] = [
    {"owner": "aur", "type": "Army", "location": "aur_cap"},
    {"owner": "aur", "type": "Fleet", "location": "aur_port"},
    {"owner": "mar", "type": "Fleet", "location": "mar_cap"},
    {"owner": "mar", "type": "Fleet", "location": "mar_dock"},
    {"owner": "vel", "type": "Army", "location": "vel_cap"},
    {"owner": "vel", "type": "Army", "location": "vel_hill"},
    {"owner": "kaz", "type": "Army", "location": "kaz_cap"},
    {"owner": "kaz", "type": "Army", "location": "kaz_steppe"},
    {"owner": "sol", "type": "Army", "location": "sol_cap"},
    {"owner": "sol", "type": "Army", "location": "sol_temple"},
    {"owner": "nor", "type": "Army", "location": "nor_cap"},
    {"owner": "nor", "type": "Fleet", "location": "nor_lake"},
    {"owner": "ferr", "type": "Army", "location": "ferr_cap"},
    {"owner": "ferr", "type": "Army", "location": "ferr_mine"},
    {"owner": "zeph", "type": "Fleet", "location": "zeph_cap"},
    {"owner": "zeph", "type": "Fleet", "location": "zeph_reef"},
    {"owner": "dra", "type": "Army", "location": "dra_cap"},
    {"owner": "dra", "type": "Army", "location": "dra_peak"},
    {"owner": "ith", "type": "Army", "location": "ith_cap"},
    {"owner": "ith", "type": "Army", "location": "ith_market"},
]


def province_name(pid: str) -> str:
    p = PROVINCES.get(pid)
    return p["name"] if p else pid


def nation_name(nid: str) -> str:
    return NATION_NAME.get(nid, nid)


def nation_short(nid: str) -> str:
    return NATION_SHORT.get(nid, nid)


def phase_at(index: int) -> Dict[str, str]:
    return PHASES[index % len(PHASES)]


def initial_board() -> Tuple[Dict[str, str], List[Dict[str, str]], Dict[str, int]]:
    """Initial ownership, units, SC counts."""
    provinces: Dict[str, str] = {pid: "" for pid in PROVINCES}
    for nid, homes in HOME_CENTERS.items():
        for h in homes:
            if h in PROVINCES:
                provinces[h] = nid
    units = [dict(u) for u in INITIAL_UNITS]
    sc = recount_sc(provinces)
    return provinces, units, sc


def recount_sc(provinces: Dict[str, str]) -> Dict[str, int]:
    sc = {nid: 0 for nid in NATION_IDS}
    for pid, owner in provinces.items():
        if owner and PROVINCES.get(pid, {}).get("sc"):
            sc[owner] = sc.get(owner, 0) + 1
    return sc


def default_agent_profile(nid: str) -> Dict[str, Any]:
    """Chinese starter profile per nation (concise; UI carries the rich text)."""
    name = nation_name(nid)
    homes = "、".join(province_name(h) for h in HOME_CENTERS.get(nid, []) if h in PROVINCES) or "本土"
    presets = {
        "aur": (88, 40, 60), "mar": (55, 55, 70), "vel": (48, 90, 30), "kaz": (90, 30, 55),
        "sol": (66, 45, 68), "nor": (35, 75, 40), "ferr": (72, 60, 45), "zeph": (50, 50, 60),
        "dra": (40, 70, 55), "ith": (30, 55, 72),
    }
    aggression, loyalty, cunning = presets.get(nid, (50, 50, 50))
    return {
        "nation_id": nid,
        "nation_name": name,
        "system_prompt": (
            f"你是{name}的最高决策智能体，核心领土包括{homes}。你的使命是让{name}在这片大陆上"
            "生存、扩张并争夺霸权。你会权衡结盟与背叛，善用外交密信与军事命令（Move/Hold/Support/Convoy）。"
        ),
        "skills_md": (
            "# 战略技能\n"
            "- 外交：通过密信结盟、施压、欺骗或求和。\n"
            "- 军事：为每个单位下达 Move / Hold / Support / Convoy。\n"
            "- 优先：先取相邻中立补给中心(SC)，再图对手核心领土。\n"
            "- 风控：兵力不足时收缩防守，避免多线作战。"
        ),
        "memory": f"{name}起于{homes}，暂无历史恩怨记录。",
        "annual_advice": "开局阶段：稳固本土，试探邻国，争取一到两个中立补给中心。",
        "aggression": aggression,
        "loyalty": loyalty,
        "cunning": cunning,
    }


# --- Deterministic RNG --------------------------------------------------------
def _seed_rng(session_key: str, year: int, phase_index: int) -> random.Random:
    raw = f"{session_key}:{year}:{phase_index}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _unit_index(units: List[Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    return {u["location"]: u for u in units}


def _army_can_enter(utype: str, pid: str) -> bool:
    ptype = PROVINCES.get(pid, {}).get("type")
    if utype == "Army":
        return ptype != "sea"
    return ptype != "land"  # Fleet: coast or sea


def adjudicate(
    provinces: Dict[str, str],
    units: List[Dict[str, str]],
    orders: Dict[str, List[Dict[str, str]]],
    rng: random.Random,
) -> Tuple[Dict[str, str], List[Dict[str, str]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Resolve one decision phase. Returns provinces, units, conflicts, pending_retreats."""
    unit_at = _unit_index(units)

    support_for: Dict[str, int] = {}  # "origin>dest" -> support count
    for nid, ol in orders.items():
        for od in ol or []:
            up = od.get("unit_province")
            if up not in unit_at or unit_at[up]["owner"] != nid:
                continue
            if od.get("action") == "Support":
                key = f"{od.get('support_of', '')}>{od.get('target', '')}"
                support_for[key] = support_for.get(key, 0) + 1

    move_intents: Dict[str, List[Dict[str, Any]]] = {}
    holding: Dict[str, Dict[str, Any]] = {}
    ordered_units: set = set()

    for nid, ol in orders.items():
        for od in ol or []:
            up = od.get("unit_province")
            if up not in unit_at or unit_at[up]["owner"] != nid:
                continue
            ordered_units.add(up)
            action = od.get("action", "Hold")
            if action == "Move":
                dest = od.get("target")
                utype = unit_at[up]["type"]
                if (not dest or dest not in PROVINCES or dest not in PROVINCES[up]["adj"]
                        or not _army_can_enter(utype, dest)):
                    holding[up] = {"nation": nid, "strength": 1 + support_for.get(f"{up}>{up}", 0)}
                    continue
                strength = 1 + support_for.get(f"{up}>{dest}", 0)
                move_intents.setdefault(dest, []).append({"from": up, "nation": nid, "strength": strength})
            else:
                holding[up] = {"nation": nid, "strength": 1 + support_for.get(f"{up}>{up}", 0)}

    for up, u in unit_at.items():
        if up not in ordered_units and up not in holding:
            holding[up] = {"nation": u["owner"], "strength": 1}

    conflicts: List[Dict[str, Any]] = []
    winners_at: Dict[str, str] = {}
    moved_from: set = set()
    standoff_provinces: set = set()
    dislodged_units: List[Dict[str, Any]] = []

    for dest, movers in move_intents.items():
        contenders = list(movers)
        defender = holding.get(dest)
        if defender:
            contenders.append({"from": dest, "nation": defender["nation"], "strength": defender["strength"], "is_def": True})
        max_s = max(c["strength"] for c in contenders)
        top = [c for c in contenders if c["strength"] == max_s]
        defs = [c for c in top if c.get("is_def")]
        if len(top) > 1 and not defs:
            # contested standoff: nobody moves in
            standoff_provinces.add(dest)
            conflicts.append({
                "province": dest, "province_name": province_name(dest),
                "kind": "争夺", "winner": "", "losers": [nation_name(m["nation"]) for m in movers],
            })
            continue
        winner = defs[0] if defs else top[0]
        if winner.get("is_def"):
            conflicts.append({
                "province": dest, "province_name": province_name(dest), "kind": "防守",
                "winner": nation_name(winner["nation"]),
                "losers": [nation_name(m["nation"]) for m in movers],
            })
        else:
            winners_at[dest] = winner["nation"]
            moved_from.add(winner["from"])
            losers = [nation_name(c["nation"]) for c in contenders if c is not winner]
            defender_unit = unit_at.get(dest)
            if defender and defender_unit and defender_unit["owner"] != winner["nation"]:
                dislodged_units.append(
                    {
                        "owner": defender_unit["owner"],
                        "type": defender_unit["type"],
                        "location": dest,
                        "attacked_from": winner["from"],
                    }
                )
            conflicts.append({
                "province": dest, "province_name": province_name(dest),
                "kind": "占领变化" if not defender else "进攻",
                "winner": nation_name(winner["nation"]), "losers": losers,
            })

    new_units: List[Dict[str, str]] = []
    occupied: set = set()
    for dest, nid in winners_at.items():
        origin = next((m["from"] for m in move_intents[dest] if m["nation"] == nid), None)
        utype = unit_at.get(origin, {}).get("type", "Army") if origin else "Army"
        new_units.append({"owner": nid, "type": utype, "location": dest})
        occupied.add(dest)
    for up, u in unit_at.items():
        if up in moved_from or up in occupied:
            continue
        new_units.append({"owner": u["owner"], "type": u["type"], "location": up})
        occupied.add(up)

    new_provinces = dict(provinces)
    for u in new_units:
        if PROVINCES.get(u["location"], {}).get("type") != "sea":
            new_provinces[u["location"]] = u["owner"]
    occupied_after_moves = {unit["location"] for unit in new_units}
    pending_retreats: List[Dict[str, Any]] = []
    for dislodged in dislodged_units:
        unit_type = dislodged["type"]
        location = dislodged["location"]
        legal_retreats: List[str] = []
        for province_id in PROVINCES.get(location, {}).get("adj", []):
            if province_id == dislodged["attacked_from"]:
                continue
            if province_id in occupied_after_moves:
                continue
            if province_id in standoff_provinces:
                continue
            if not _army_can_enter(unit_type, province_id):
                continue
            legal_retreats.append(province_id)
        pending_retreats.append(
            {
                "owner": dislodged["owner"],
                "type": unit_type,
                "location": location,
                "attacked_from": dislodged["attacked_from"],
                "legal_retreats": legal_retreats,
            }
        )
    return new_provinces, new_units, conflicts, pending_retreats


def resolve_winter(
    provinces: Dict[str, str], units: List[Dict[str, str]], rng: random.Random
) -> Tuple[List[Dict[str, str]], List[str]]:
    """Winter build/disband. Returns (new_units, log_lines)."""
    sc = recount_sc(provinces)
    occupied = {u["location"] for u in units}
    new_units = [dict(u) for u in units]
    logs: List[str] = []
    for nid in NATION_IDS:
        count = sum(1 for u in new_units if u["owner"] == nid)
        target = sc.get(nid, 0)
        if target > count:
            free_homes = [h for h in HOME_CENTERS.get(nid, [])
                          if h in PROVINCES and provinces.get(h) == nid and h not in occupied]
            build = min(target - count, len(free_homes))
            for h in free_homes[:build]:
                utype = "Fleet" if (PROVINCES[h]["type"] == "coast" and rng.random() > 0.5) else "Army"
                new_units.append({"owner": nid, "type": utype, "location": h})
                occupied.add(h)
            if build > 0:
                logs.append(f"{nation_name(nid)} 于本土增兵 {build} 支")
        elif target < count:
            cull = count - target
            own = [u for u in new_units if u["owner"] == nid]
            away = [u for u in own if u["location"] not in HOME_CENTERS.get(nid, [])]
            remove = (away or own)[:cull]
            rm_ids = {(u["owner"], u["location"]) for u in remove}
            new_units = [u for u in new_units if (u["owner"], u["location"]) not in rm_ids or u["owner"] != nid]
            logs.append(f"{nation_name(nid)} 被迫裁撤 {cull} 支单位")
    return new_units, logs


def next_phase_index(phase_index: int, year: int) -> Tuple[int, int]:
    nxt = phase_index + 1
    if nxt >= len(PHASES):
        return 0, year + 1
    return nxt, year


# --- Deterministic fallback (no LLM) -----------------------------------------
def fallback_orders(
    provinces: Dict[str, str],
    units: List[Dict[str, str]],
    rng: random.Random,
    agents: Dict[str, Dict[str, Any]],
) -> Dict[str, List[Dict[str, str]]]:
    orders: Dict[str, List[Dict[str, str]]] = {nid: [] for nid in NATION_IDS}
    for u in units:
        nid, up, utype = u["owner"], u["location"], u["type"]
        aggression = agents.get(nid, {}).get("aggression", 50)
        neigh = [n for n in PROVINCES[up]["adj"] if _army_can_enter(utype, n)]
        neutral = [n for n in neigh if not provinces.get(n) and PROVINCES[n]["type"] != "sea"]
        enemy = [n for n in neigh if provinces.get(n) and provinces.get(n) != nid]
        roll = rng.randint(0, 100)
        if neutral and roll < 40 + aggression // 2:
            orders[nid].append({"unit_province": up, "action": "Move", "target": rng.choice(neutral), "support_of": ""})
        elif enemy and roll < aggression:
            orders[nid].append({"unit_province": up, "action": "Move", "target": rng.choice(enemy), "support_of": ""})
        else:
            orders[nid].append({"unit_province": up, "action": "Hold", "target": "", "support_of": ""})
    return orders


def fallback_messages(
    orders: Dict[str, List[Dict[str, str]]],
    rng: random.Random,
    agents: Dict[str, Dict[str, Any]],
) -> List[Dict[str, str]]:
    ally = "{a}向{b}提议结盟：\u201c你我接壤，何不互不侵犯，共分{p}？\u201d"
    threat = "{a}警告{b}：\u201c速退出{p}一带，否则休怪我铁骑无情。\u201d"
    deceive = "{a}对{b}示好，暗中却在{p}方向调兵，笑里藏刀。"
    msgs: List[Dict[str, str]] = []
    for nid in NATION_IDS:
        if rng.randint(0, 100) < 45:
            to = rng.choice([o for o in NATION_IDS if o != nid])
            mv = next((od for od in orders.get(nid, []) if od["action"] == "Move"), None)
            p = province_name(mv["target"]) if mv else "边境"
            cunning = agents.get(nid, {}).get("cunning", 50)
            aggression = agents.get(nid, {}).get("aggression", 50)
            if cunning > 65:
                intent, tpl = "背叛", deceive
            elif aggression > 60:
                intent, tpl = "恐吓", threat
            else:
                intent, tpl = "结盟", ally
            msgs.append({
                "from_nation": nid, "to_nation": to, "intent": intent,
                "content": tpl.format(a=nation_name(nid), b=nation_name(to), p=p),
            })
    return msgs
