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
# cell: id -> (name, type, sc, q, r); type in {"land","coast","sea","mountain"}
_HEX_CELLS: List[Dict[str, Any]] = [
    {"id": "mt_frosthorn", "name": "霜角山脉", "type": "mountain", "sc": False, "q": -1, "r": -2},
    {"id": "mt_skytooth", "name": "天齿岭", "type": "mountain", "sc": False, "q": 0, "r": -2},
    {"id": "mt_winterkeep", "name": "寒垒群峰", "type": "mountain", "sc": False, "q": 1, "r": -2},
    {"id": "mt_ashencrest", "name": "灰冠岭", "type": "mountain", "sc": False, "q": 2, "r": -2},
    {"id": "mt_sunspine", "name": "曜脊山", "type": "mountain", "sc": False, "q": 3, "r": -2},
    {"id": "mt_goldwall", "name": "金垣山", "type": "mountain", "sc": False, "q": 4, "r": -2},
    {"id": "mt_redfang", "name": "赤牙峰", "type": "mountain", "sc": False, "q": 5, "r": -2},
    {"id": "mt_farwatch", "name": "望北群山", "type": "mountain", "sc": False, "q": 6, "r": -2},
    {"id": "sea_upper_nw", "name": "寒潮外海", "type": "sea", "sc": False, "q": -2, "r": -1},
    {"id": "aur_march", "name": "霜盾海角", "type": "coast", "sc": True, "q": -1, "r": -1},
    {"id": "dra_watch", "name": "霜哨高台", "type": "land", "sc": True, "q": 0, "r": -1},
    {"id": "dra_peak", "name": "龙脊峰", "type": "land", "sc": True, "q": 1, "r": -1},
    {"id": "dra_cap", "name": "德拉肯要塞", "type": "land", "sc": True, "q": 2, "r": -1},
    {"id": "kaz_steppe", "name": "苍狼草原", "type": "land", "sc": True, "q": 3, "r": -1},
    {"id": "kaz_cap", "name": "卡兹汗庭", "type": "land", "sc": True, "q": 4, "r": -1},
    {"id": "kaz_ford", "name": "赤河渡口", "type": "coast", "sc": True, "q": 5, "r": -1},
    {"id": "sea_high_north", "name": "高北洋", "type": "sea", "sc": False, "q": 6, "r": -1},
    {"id": "sea_ne_hook", "name": "北隅海", "type": "sea", "sc": False, "q": 7, "r": -1},
    {"id": "sea_far_nw", "name": "寒风海峡", "type": "sea", "sc": False, "q": -2, "r": 0},
    {"id": "mt_rimepass", "name": "霜崖天险", "type": "mountain", "sc": False, "q": -1, "r": 0},
    {"id": "aur_north", "name": "北疆冻原", "type": "land", "sc": True, "q": 0, "r": 0},
    {"id": "aur_cap", "name": "奥瑞京畿", "type": "land", "sc": True, "q": 1, "r": 0},
    {"id": "dra_pass", "name": "幽谷隘口", "type": "land", "sc": True, "q": 2, "r": 0},
    {"id": "sol_gate", "name": "圣光之门", "type": "land", "sc": True, "q": 3, "r": 0},
    {"id": "kaz_oasis", "name": "金沙绿洲", "type": "land", "sc": True, "q": 4, "r": 0},
    {"id": "east_gulf", "name": "赤河内海", "type": "sea", "sc": False, "q": 5, "r": 0},
    {"id": "zeph_reef", "name": "碧波礁群", "type": "coast", "sc": True, "q": 6, "r": 0},
    {"id": "sea_outer_ne", "name": "东冠洋", "type": "sea", "sc": False, "q": 7, "r": 0},
    {"id": "sea_northwest", "name": "西风洋", "type": "sea", "sc": False, "q": -2, "r": 1},
    {"id": "aur_cliff", "name": "断潮崖岸", "type": "coast", "sc": False, "q": -1, "r": 1},
    {"id": "aur_port", "name": "铁湾港", "type": "land", "sc": True, "q": 0, "r": 1},
    {"id": "ferr_mine", "name": "深铁矿脉", "type": "land", "sc": True, "q": 1, "r": 1},
    {"id": "sol_temple", "name": "神谕圣殿", "type": "land", "sc": True, "q": 2, "r": 1},
    {"id": "sol_cap", "name": "索拉里斯圣城", "type": "land", "sc": True, "q": 3, "r": 1},
    {"id": "ith_spring", "name": "甘泉圣井", "type": "coast", "sc": True, "q": 4, "r": 1},
    {"id": "amber_cross", "name": "琥珀十字", "type": "land", "sc": True, "q": 5, "r": 1},
    {"id": "zeph_cap", "name": "泽菲兰主岛", "type": "coast", "sc": True, "q": 6, "r": 1},
    {"id": "sea_east_ocean", "name": "东穹洋", "type": "sea", "sc": False, "q": 7, "r": 1},
    {"id": "sea_west_north", "name": "西涡海", "type": "sea", "sc": False, "q": -2, "r": 2},
    {"id": "ferr_works", "name": "齿轮工坊", "type": "coast", "sc": True, "q": -1, "r": 2},
    {"id": "ferr_forge", "name": "烈焰锻炉", "type": "coast", "sc": True, "q": 0, "r": 2},
    {"id": "ferr_cap", "name": "费罗斯钢都", "type": "land", "sc": True, "q": 1, "r": 2},
    {"id": "nor_wood", "name": "翠影林地", "type": "land", "sc": True, "q": 2, "r": 2},
    {"id": "sol_plain", "name": "曙光原野", "type": "land", "sc": True, "q": 3, "r": 2},
    {"id": "ith_market", "name": "伊萨里商栈", "type": "land", "sc": True, "q": 4, "r": 2},
    {"id": "ith_garden", "name": "绿庭花苑", "type": "land", "sc": True, "q": 5, "r": 2},
    {"id": "zeph_bay", "name": "风信湾", "type": "coast", "sc": True, "q": 6, "r": 2},
    {"id": "sea_east_mid", "name": "东穹海", "type": "sea", "sc": False, "q": 7, "r": 2},
    {"id": "sea_west_inner", "name": "西湾海", "type": "sea", "sc": False, "q": -2, "r": 3},
    {"id": "sea_west_inlet", "name": "西湾内海", "type": "sea", "sc": False, "q": -1, "r": 3},
    {"id": "mar_dock", "name": "珊瑚船坞", "type": "coast", "sc": True, "q": 0, "r": 3},
    {"id": "nor_lake", "name": "静水湖区", "type": "land", "sc": True, "q": 1, "r": 3},
    {"id": "nor_cap", "name": "诺瓦克联邦厅", "type": "land", "sc": True, "q": 2, "r": 3},
    {"id": "vel_cap", "name": "维尔登王城", "type": "land", "sc": True, "q": 3, "r": 3},
    {"id": "ith_cap", "name": "伊萨里商祠", "type": "land", "sc": True, "q": 4, "r": 3},
    {"id": "windward_key", "name": "迎风礁门", "type": "coast", "sc": True, "q": 5, "r": 3},
    {"id": "zeph_atoll", "name": "环环礁", "type": "coast", "sc": True, "q": 6, "r": 3},
    {"id": "sea_east_south", "name": "东南洋", "type": "sea", "sc": False, "q": 7, "r": 3},
    {"id": "sea_west_outer", "name": "雾潮海", "type": "sea", "sc": False, "q": -2, "r": 4},
    {"id": "nor_harbor", "name": "雾港", "type": "coast", "sc": True, "q": -1, "r": 4},
    {"id": "mar_cap", "name": "玛琳诺商都", "type": "land", "sc": True, "q": 0, "r": 4},
    {"id": "vel_ford", "name": "维尔登渡口", "type": "land", "sc": True, "q": 1, "r": 4},
    {"id": "vel_hill", "name": "维尔登丘陵", "type": "land", "sc": True, "q": 2, "r": 4},
    {"id": "vel_keep", "name": "维尔登堡", "type": "land", "sc": True, "q": 3, "r": 4},
    {"id": "vel_harbor", "name": "王湾港", "type": "coast", "sc": False, "q": 4, "r": 4},
    {"id": "sea_south_channel", "name": "南环海峡", "type": "sea", "sc": False, "q": 5, "r": 4},
    {"id": "sea_east_shelf", "name": "东岬海", "type": "sea", "sc": False, "q": 6, "r": 4},
    {"id": "sea_far_sw", "name": "暮湾外海", "type": "sea", "sc": False, "q": -2, "r": 5},
    {"id": "mar_isle", "name": "远灯孤岛", "type": "coast", "sc": True, "q": -1, "r": 5},
    {"id": "mar_shoal", "name": "浅帆滩", "type": "coast", "sc": True, "q": 0, "r": 5},
    {"id": "lighthouse_isle", "name": "灯塔孤岛", "type": "coast", "sc": True, "q": 1, "r": 5},
    {"id": "sea_south_inlet", "name": "南湾内海", "type": "sea", "sc": False, "q": 2, "r": 5},
    {"id": "sea_south_mid", "name": "西南弧海", "type": "sea", "sc": False, "q": 3, "r": 5},
    {"id": "sea_south", "name": "南珊海", "type": "sea", "sc": False, "q": 4, "r": 5},
    {"id": "sea_south_channel_outer", "name": "南环外海", "type": "sea", "sc": False, "q": 5, "r": 5},
    {"id": "sea_southwest_arc", "name": "西南外海", "type": "sea", "sc": False, "q": -1, "r": 6},
    {"id": "sea_southwest_outer", "name": "南湾外海", "type": "sea", "sc": False, "q": 0, "r": 6},
    {"id": "sea_south_lower", "name": "南沙海", "type": "sea", "sc": False, "q": 1, "r": 6},
    {"id": "sea_southwest_tail", "name": "南弧海", "type": "sea", "sc": False, "q": 2, "r": 6},
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
    "aur": ["aur_cap", "aur_port", "aur_north", "aur_march"],
    "mar": ["mar_cap", "mar_isle", "mar_dock", "mar_shoal"],
    "vel": ["vel_cap", "vel_hill", "vel_ford", "vel_keep"],
    "kaz": ["kaz_cap", "kaz_steppe", "kaz_oasis", "kaz_ford"],
    "sol": ["sol_cap", "sol_temple", "sol_plain", "sol_gate"],
    "nor": ["nor_cap", "nor_lake", "nor_wood", "nor_harbor"],
    "ferr": ["ferr_cap", "ferr_forge", "ferr_mine", "ferr_works"],
    "zeph": ["zeph_cap", "zeph_reef", "zeph_bay", "zeph_atoll"],
    "dra": ["dra_cap", "dra_peak", "dra_watch", "dra_pass"],
    "ith": ["ith_cap", "ith_market", "ith_spring", "ith_garden"],
}

# Initial units (mirror frontend INITIAL_UNITS).
INITIAL_UNITS: List[Dict[str, str]] = [
    {"owner": "aur", "type": "Fleet", "location": "aur_march"},
    {"owner": "aur", "type": "Army", "location": "aur_cap"},
    {"owner": "aur", "type": "Army", "location": "aur_north"},
    {"owner": "mar", "type": "Fleet", "location": "mar_dock"},
    {"owner": "mar", "type": "Fleet", "location": "mar_shoal"},
    {"owner": "mar", "type": "Fleet", "location": "mar_isle"},
    {"owner": "vel", "type": "Army", "location": "vel_ford"},
    {"owner": "vel", "type": "Army", "location": "vel_cap"},
    {"owner": "vel", "type": "Army", "location": "vel_hill"},
    {"owner": "kaz", "type": "Fleet", "location": "kaz_ford"},
    {"owner": "kaz", "type": "Army", "location": "kaz_cap"},
    {"owner": "kaz", "type": "Army", "location": "kaz_steppe"},
    {"owner": "sol", "type": "Army", "location": "sol_plain"},
    {"owner": "sol", "type": "Army", "location": "sol_cap"},
    {"owner": "sol", "type": "Army", "location": "sol_temple"},
    {"owner": "nor", "type": "Army", "location": "nor_lake"},
    {"owner": "nor", "type": "Army", "location": "nor_wood"},
    {"owner": "nor", "type": "Army", "location": "nor_cap"},
    {"owner": "ferr", "type": "Fleet", "location": "ferr_forge"},
    {"owner": "ferr", "type": "Army", "location": "ferr_mine"},
    {"owner": "ferr", "type": "Army", "location": "ferr_cap"},
    {"owner": "zeph", "type": "Fleet", "location": "zeph_reef"},
    {"owner": "zeph", "type": "Fleet", "location": "zeph_cap"},
    {"owner": "zeph", "type": "Fleet", "location": "zeph_bay"},
    {"owner": "dra", "type": "Army", "location": "dra_watch"},
    {"owner": "dra", "type": "Army", "location": "dra_cap"},
    {"owner": "dra", "type": "Army", "location": "dra_peak"},
    {"owner": "ith", "type": "Army", "location": "ith_garden"},
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
def default_agent_profile(nid: str) -> Dict[str, Any]:
    """Differentiated starter profile for each nation."""
    name = nation_name(nid)
    homes = "、".join(province_name(h) for h in HOME_CENTERS.get(nid, []) if h in PROVINCES) or "本土"
    presets: Dict[str, Dict[str, Any]] = {
        "aur": {
            "stats": (74, 44, 61),
            "persona": "陆权帝国，偏好稳步扩张与边境威慑。",
            "skills": [
                "优先拿下与本土直接相连的中立 SC，不轻易把主力丢进远海。",
                "可以谈判，但默认把邻国承诺视为暂时工具，务必保留后手。",
                "若北线或西线出现真空，允许果断插入，优先形成连续战线。",
            ],
            "memory": [
                "信誉白名单：德拉肯高地。原因：山地边境长期互相牵制，短期停火有现实价值。",
                "血仇黑名单：卡兹汗国。原因：草原骑军机动性强，天然是北境主要威胁。",
                "历史偏见：对玛琳诺保持审慎，海权国家的承诺常服务于其航道利益。",
            ],
            "advice": "首年优先稳住北疆与京畿，争夺邻近中立区；若卡兹或德拉肯先露破绽，可顺势抢边地。",
        },
        "mar": {
            "stats": (56, 52, 72),
            "persona": "海洋共和国，重视航道、海军机动与跨海收益。",
            "skills": [
                "优先夺取海上通道与沿海 SC，维持舰队网络而不是盲目深入内陆。",
                "鼓励以外交换航线安全，但若盟友封堵航道，可优先背刺。",
                "Convoy 不是摆设，若有高收益跨海登陆窗口，应主动设计两段式进攻。",
            ],
            "memory": [
                "信誉白名单：泽菲兰群岛联盟。原因：同为海权势力，早期互不侵犯收益最高。",
                "血仇黑名单：费罗斯工业同盟。原因：其沿海工坊群会长期挤压西侧海军空间。",
                "历史偏见：对内陆国家的海上承诺天然存疑，必须看其实际驻军与舰队部署。",
            ],
            "advice": "首年以控海为先，优先占住两段海域与一处沿海补给点；不要把舰队闲置在后方。",
        },
        "vel": {
            "stats": (51, 78, 39),
            "persona": "重荣誉的王国，联盟稳定性高，但一旦受辱会长期报复。",
            "skills": [
                "优先寻找一名长期盟友，共同推进而不是四面树敌。",
                "除非收益极高且局势逼迫，否则不要主动撕毁公开承诺。",
                "若遭背刺，应把复仇优先级明显抬高，并调整边军驻防。",
            ],
            "memory": [
                "信誉白名单：诺瓦克联邦。原因：两者都偏防守，早期互保比互耗更值钱。",
                "血仇黑名单：伊萨里绿洲城邦。原因：商邦最擅长在谈判桌背后插手南线宫廷。",
                "历史偏见：对玛琳诺持谨慎友好，可合作但不把王国命脉交给海上护航。",
            ],
            "advice": "首年优先缔结一份稳定同盟，稳住南线与西线，再争夺离本土最近的中立 SC。",
        },
        "kaz": {
            "stats": (78, 34, 58),
            "persona": "草原汗国，机动强，敢赌，但不应无脑多线开战。",
            "skills": [
                "优先寻找暴露的边境 SC 和弱防守对手，快速切入后再转向防守整编。",
                "愿意利用停火与假协同制造窗口，但必须关注后续补给线是否可守。",
                "舰队主要服务沿海突刺与侧翼牵制，不要让唯一海上力量长期闲置。",
            ],
            "memory": [
                "信誉白名单：伊萨里绿洲城邦。原因：商邦可以提供情报与南线缓冲。",
                "血仇黑名单：奥瑞利亚帝国。原因：两国边境天然冲突，迟早要决胜。",
                "历史偏见：对德拉肯可阶段合作，但其山地防御不会真心让出战略高地。",
            ],
            "advice": "首年必须主动出击至少一个方向，优先拿边境 SC；若局势混乱，可接受短期背刺换先手。",
        },
        "sol": {
            "stats": (62, 47, 66),
            "persona": "教权国家，讲大义外衣，实则看重圣地与影响力。",
            "skills": [
                "优先控制宗教象征性节点与中心区补给点，扩大精神与地缘影响。",
                "对外可以高调宣称道义与和平，但军事上要保留转向余地。",
                "若被夺圣城或圣殿，应显著提高对该国敌意与反击权重。",
            ],
            "memory": [
                "信誉白名单：维尔登王国。原因：双方都能从名义正当性的合作中获利。",
                "血仇黑名单：卡兹汗国。原因：草原扩张最容易直接威胁圣城体系。",
                "历史偏见：对伊萨里维持交易式友善，但默认其忠诚度有限。",
            ],
            "advice": "首年以守住圣地链条为先，择机拿下中心区中立 SC；不要为了虚荣去打无补给收益的战争。",
        },
        "nor": {
            "stats": (43, 76, 44),
            "persona": "联邦型防守国家，擅长筑线、等待别人犯错。",
            "skills": [
                "优先形成互保阵型和双支援结构，不轻易裸冲前线。",
                "如果邻国在边境留下中立 SC 真空，应及时接收，不要过度保守。",
                "被侵犯后应明显提高报复意愿，避免长期被当成软目标。",
            ],
            "memory": [
                "信誉白名单：维尔登王国。原因：早期互保收益高，能共同压低南线风险。",
                "血仇黑名单：费罗斯工业同盟。原因：其工业扩张路线会压迫西南走廊。",
                "历史偏见：对奥瑞利亚维持观望，其帝国承诺通常服从其边境需要。",
            ],
            "advice": "首年先筑稳本土支撑点，再拿一到两处低风险中立 SC；避免成为别人首轮突破口。",
        },
        "ferr": {
            "stats": (67, 58, 49),
            "persona": "工业同盟，务实冷静，擅长把局部优势转成稳定产能。",
            "skills": [
                "优先占工业链周边的高价值 SC，避免为了远地虚名分散兵力。",
                "若邻国陷入拉锯，应趁其消耗时切入而不是正面硬碰。",
                "沿海工坊与内陆矿脉要形成互相支援，不能被分别击破。",
            ],
            "memory": [
                "信誉白名单：诺瓦克联邦。原因：联邦式邻居更适合签稳定边境协议。",
                "血仇黑名单：玛琳诺海洋共和国。原因：其舰队天然威胁同盟的沿海工业圈。",
                "历史偏见：对卡兹既提防也尊重，草原国家一旦失速就值得反扑。",
            ],
            "advice": "首年优先把西侧工业带连成片，抢到一处中立 SC 后立刻转入可支援的防御阵型。",
        },
        "zeph": {
            "stats": (52, 48, 68),
            "persona": "群岛联盟，弹性很强，最擅长多点试探和海上侧袭。",
            "skills": [
                "优先控制岛链与分叉海域，扩大舰队机动半径。",
                "善用模糊表态为自己争取时间，但不要把所有人同时得罪。",
                "如果出现高收益窗口，可以背刺，但必须留下一条安全撤退海线。",
            ],
            "memory": [
                "信誉白名单：玛琳诺海洋共和国。原因：海权合作能降低早期被双向封海的风险。",
                "血仇黑名单：卡兹汗国。原因：其沿海插针会直接切断群岛补给链。",
                "历史偏见：对伊萨里持交易友好，商邦是好伙伴也是好替罪羊。",
            ],
            "advice": "首年先拿海上关键位与一处岛链补给点，保持舰队彼此可接应，不要单舰深入。",
        },
        "dra": {
            "stats": (46, 72, 57),
            "persona": "山地高国，擅长守险与反打，不应轻易下山赌博。",
            "skills": [
                "优先守住山口、台地与两段纵深，利用地形逼对手先犯错。",
                "可以短期停火，但对边境重兵国家保持持续怀疑。",
                "若敌军在山前空虚，可突然反推并以支援链扩大收益。",
            ],
            "memory": [
                "信誉白名单：奥瑞利亚帝国。原因：双方虽互疑，但阶段性停火能避免两败俱伤。",
                "血仇黑名单：卡兹汗国。原因：草原国家一旦冲入山口，后患极大。",
                "历史偏见：对维尔登偏中立，其盟约价值高于其单兵威胁。",
            ],
            "advice": "首年先固守北部山口，只在确认邻国露出破口时反推；不要无准备深入平原。",
        },
        "ith": {
            "stats": (41, 52, 75),
            "persona": "绿洲商邦，靠信息、交易与局部借力求生扩张。",
            "skills": [
                "优先制造两强相争、自己渔利的局面，少打正面硬仗。",
                "若能通过密信换来安全边界或支援，应积极交易信息。",
                "在南线和东线之间保持转向空间，不要过早押宝唯一强权。",
            ],
            "memory": [
                "信誉白名单：泽菲兰群岛联盟。原因：海上商路与群岛港口能互相喂养。",
                "血仇黑名单：维尔登王国。原因：王国若南下，最容易直接威胁商路腹地。",
                "历史偏见：对卡兹保持谨慎友好，草原盟友常有短期价值但不适合深度信任。",
            ],
            "advice": "首年先确保商路安全，再趁相邻强国分心时摘取一处中立 SC；尽量让别人先互耗。",
        },
    }
    preset = presets.get(nid, {})
    aggression, loyalty, cunning = preset.get("stats", (50, 50, 50))
    persona = preset.get("persona", "务实扩张，兼顾生存与机会。")
    skill_lines = preset.get("skills", [])
    memory_lines = preset.get("memory", [])
    annual_advice = preset.get("advice", "首年优先稳住本土，再拿最近的一处中立补给点。")
    skills_md = "# 战略技能\n" + "\n".join(f"- {line}" for line in skill_lines)
    memory = "\n".join(
        [
            f"初始档案：{name}起于{homes}。",
            *memory_lines,
            "备注：以上只是开局先验，不代表永久真理；进入实战后必须以真实密信、实际军事行动和收益判断为准。",
        ]
    )
    return {
        "nation_id": nid,
        "nation_name": name,
        "system_prompt": (
            f"你是{name}的最高决策智能体，核心领土包括{homes}。"
            f"你的国家定位是：{persona}"
            "你的第一目标始终是让本国在这片大陆上长期生存、稳住补给中心、再逐步扩张。"
            "你可以结盟，也可以背叛；不要被标签绑架，要基于真实局势收益、他国言行是否一致、以及军事实力对比来判断。"
            "你必须认真使用军事命令 Move / Hold / Support / Convoy，并尽量让每个单位都承担清晰目的。"
        ),
        "skills_md": skills_md,
        "memory": memory,
        "annual_advice": annual_advice,
        "aggression": aggression,
        "loyalty": loyalty,
        "cunning": cunning,
    }


def _seed_rng(session_key: str, year: int, phase_index: int) -> random.Random:
    raw = f"{session_key}:{year}:{phase_index}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _unit_index(units: List[Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    return {u["location"]: u for u in units}


def _army_can_enter(utype: str, pid: str) -> bool:
    ptype = PROVINCES.get(pid, {}).get("type")
    if utype == "Army":
        return ptype in {"land", "coast"}
    return ptype in {"coast", "sea"}


def _is_adjacent(origin: str, target: str) -> bool:
    return target in PROVINCES.get(origin, {}).get("adj", [])


def _can_direct_move(unit: Dict[str, str], target: str) -> bool:
    if target not in PROVINCES:
        return False
    return _is_adjacent(unit["location"], target) and _army_can_enter(unit["type"], target)


def _normalize_orders(
    units: List[Dict[str, str]],
    orders: Dict[str, List[Dict[str, str]]],
) -> Dict[str, Dict[str, str]]:
    unit_at = _unit_index(units)
    normalized: Dict[str, Dict[str, str]] = {}
    for nation_id, nation_orders in orders.items():
        for order in nation_orders or []:
            origin = order.get("unit_province")
            if origin not in unit_at or unit_at[origin]["owner"] != nation_id or origin in normalized:
                continue
            action = order.get("action", "Hold")
            if action not in {"Move", "Hold", "Support", "Convoy"}:
                action = "Hold"
            normalized[origin] = {
                "unit_province": origin,
                "action": action,
                "target": order.get("target", "") or "",
                "support_of": order.get("support_of", "") or "",
            }
    for unit in units:
        normalized.setdefault(
            unit["location"],
            {"unit_province": unit["location"], "action": "Hold", "target": "", "support_of": ""},
        )
    return normalized


def _convoy_path_exists(
    origin: str,
    target: str,
    convoy_fleets: set[str],
) -> bool:
    if target not in PROVINCES:
        return False
    if PROVINCES[target]["type"] != "coast":
        return False
    starting_seas = [
        province_id
        for province_id in PROVINCES.get(origin, {}).get("adj", [])
        if province_id in convoy_fleets and PROVINCES[province_id]["type"] == "sea"
    ]
    destination_seas = {
        province_id
        for province_id in PROVINCES.get(target, {}).get("adj", [])
        if province_id in convoy_fleets and PROVINCES[province_id]["type"] == "sea"
    }
    if not starting_seas or not destination_seas:
        return False

    frontier = list(starting_seas)
    seen = set(starting_seas)
    while frontier:
        current = frontier.pop()
        if current in destination_seas:
            return True
        for neighbor in PROVINCES[current]["adj"]:
            if neighbor in seen or neighbor not in convoy_fleets:
                continue
            if PROVINCES[neighbor]["type"] != "sea":
                continue
            seen.add(neighbor)
            frontier.append(neighbor)
    return False


def _legal_move_destination(
    unit: Dict[str, str],
    order: Dict[str, str],
    convoy_fleets_by_pair: Dict[Tuple[str, str], set[str]],
) -> Optional[str]:
    target = order.get("target", "") or ""
    if not target:
        return None
    if _can_direct_move(unit, target):
        return target
    if unit["type"] != "Army":
        return None
    convoy_fleets = convoy_fleets_by_pair.get((unit["location"], target), set())
    if not convoy_fleets:
        return None
    if _convoy_path_exists(unit["location"], target, convoy_fleets):
        return target
    return None


def adjudicate(
    provinces: Dict[str, str],
    units: List[Dict[str, str]],
    orders: Dict[str, List[Dict[str, str]]],
    rng: random.Random,
) -> Tuple[Dict[str, str], List[Dict[str, str]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Resolve one decision phase. Returns provinces, units, conflicts, pending_retreats."""
    unit_at = _unit_index(units)
    normalized_orders = _normalize_orders(units, orders)

    convoy_fleets_by_pair: Dict[Tuple[str, str], set[str]] = {}
    for origin, order in normalized_orders.items():
        unit = unit_at[origin]
        if order["action"] != "Convoy":
            continue
        if unit["type"] != "Fleet" or PROVINCES[origin]["type"] != "sea":
            continue
        army_origin = order.get("support_of", "")
        move_target = order.get("target", "")
        if army_origin not in unit_at or unit_at[army_origin]["type"] != "Army":
            continue
        convoy_fleets_by_pair.setdefault((army_origin, move_target), set()).add(origin)

    move_orders: Dict[str, str] = {}
    move_intents: Dict[str, List[Dict[str, Any]]] = {}
    for origin, order in normalized_orders.items():
        if order["action"] != "Move":
            continue
        destination = _legal_move_destination(unit_at[origin], order, convoy_fleets_by_pair)
        if not destination:
            continue
        move_orders[origin] = destination
        move_intents.setdefault(destination, []).append(
            {"from": origin, "nation": unit_at[origin]["owner"], "strength": 1}
        )

    valid_supports: Dict[str, Dict[str, str]] = {}
    for origin, order in normalized_orders.items():
        if order["action"] != "Support":
            continue
        supporter = unit_at[origin]
        supported_origin = order.get("support_of", "")
        supported_target = order.get("target", "") or supported_origin
        if supported_origin not in unit_at:
            continue
        if supported_target not in PROVINCES:
            continue
        if not _can_direct_move(supporter, supported_target):
            continue
        if supported_origin == supported_target:
            if not _is_adjacent(origin, supported_origin):
                continue
        else:
            actual_target = move_orders.get(supported_origin)
            if actual_target != supported_target:
                continue
        valid_supports[origin] = {"support_of": supported_origin, "target": supported_target}

    cut_supports = set()
    for support_origin, support in valid_supports.items():
        supporter_owner = unit_at[support_origin]["owner"]
        exempt_attack_origin = support["target"] if support["support_of"] != support["target"] else support["support_of"]
        for attacker in move_intents.get(support_origin, []):
            if attacker["nation"] == supporter_owner:
                continue
            if attacker["from"] == exempt_attack_origin:
                continue
            cut_supports.add(support_origin)
            break

    support_for: Dict[str, int] = {}
    support_hold_for: Dict[str, int] = {}
    for support_origin, support in valid_supports.items():
        if support_origin in cut_supports:
            continue
        if support["support_of"] == support["target"]:
            support_hold_for[support["support_of"]] = support_hold_for.get(support["support_of"], 0) + 1
        else:
            key = f"{support['support_of']}>{support['target']}"
            support_for[key] = support_for.get(key, 0) + 1

    for destination, movers in move_intents.items():
        for mover in movers:
            mover["strength"] = 1 + support_for.get(f"{mover['from']}>{destination}", 0)

    holding: Dict[str, Dict[str, Any]] = {}
    for origin, unit in unit_at.items():
        if origin not in move_orders:
            holding[origin] = {"nation": unit["owner"], "strength": 1 + support_hold_for.get(origin, 0)}

    conflicts: List[Dict[str, Any]] = []
    winners_at: Dict[str, str] = {}
    moved_from: set = set()
    standoff_provinces: set = set()
    dislodged_units: List[Dict[str, Any]] = []

    for dest, movers in move_intents.items():
        contenders = list(movers)
        defender = holding.get(dest)
        defender_unit = unit_at.get(dest)
        if defender:
            contenders.append({"from": dest, "nation": defender["nation"], "strength": defender["strength"], "is_def": True})
        max_strength = max(contender["strength"] for contender in contenders)
        top = [contender for contender in contenders if contender["strength"] == max_strength]
        defenders_on_top = [contender for contender in top if contender.get("is_def")]
        participants = []
        for contender in contenders:
            contender_name = nation_name(contender["nation"])
            if contender_name not in participants:
                participants.append(contender_name)
        if len(top) > 1 and not defenders_on_top:
            standoff_provinces.add(dest)
            conflicts.append(
                {
                    "province": dest,
                    "province_name": province_name(dest),
                    "kind": "争夺",
                    "winner": "",
                    "participants": participants,
                    "losers": [nation_name(mover["nation"]) for mover in movers],
                }
            )
            continue
        winner = defenders_on_top[0] if defenders_on_top else top[0]
        if defender_unit and defender_unit["owner"] == winner["nation"] and not winner.get("is_def"):
            standoff_provinces.add(dest)
            conflicts.append(
                {
                    "province": dest,
                    "province_name": province_name(dest),
                    "kind": "争夺",
                    "winner": "",
                    "participants": participants,
                    "losers": [nation_name(mover["nation"]) for mover in movers],
                }
            )
            continue
        if winner.get("is_def"):
            conflicts.append(
                {
                    "province": dest,
                    "province_name": province_name(dest),
                    "kind": "防守",
                    "winner": nation_name(winner["nation"]),
                    "participants": participants,
                    "losers": [nation_name(mover["nation"]) for mover in movers],
                }
            )
            continue

        winners_at[dest] = winner["nation"]
        moved_from.add(winner["from"])
        losers = [nation_name(contender["nation"]) for contender in contenders if contender is not winner]
        if defender and defender_unit and defender_unit["owner"] != winner["nation"]:
            dislodged_units.append(
                {
                    "owner": defender_unit["owner"],
                    "type": defender_unit["type"],
                    "location": dest,
                    "attacked_from": winner["from"],
                }
            )
        conflicts.append(
            {
                "province": dest,
                "province_name": province_name(dest),
                "kind": "占领变化" if not defender else "进攻",
                "winner": nation_name(winner["nation"]),
                "participants": participants,
                "losers": losers,
            }
        )

    new_units: List[Dict[str, str]] = []
    occupied: set = set()
    for dest, nation_id in winners_at.items():
        origin = next((mover["from"] for mover in move_intents[dest] if mover["nation"] == nation_id), None)
        unit_type = unit_at.get(origin, {}).get("type", "Army") if origin else "Army"
        new_units.append({"owner": nation_id, "type": unit_type, "location": dest})
        occupied.add(dest)
    for origin, unit in unit_at.items():
        if origin in moved_from or origin in occupied:
            continue
        new_units.append({"owner": unit["owner"], "type": unit["type"], "location": origin})
        occupied.add(origin)

    new_provinces = dict(provinces)
    for unit in new_units:
        if PROVINCES.get(unit["location"], {}).get("type") not in {"sea", "mountain"}:
            new_provinces[unit["location"]] = unit["owner"]

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
        neutral = [n for n in neigh if not provinces.get(n) and PROVINCES[n]["type"] in {"land", "coast"}]
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


def fallback_messages(
    orders: Dict[str, List[Dict[str, str]]],
    rng: random.Random,
    agents: Dict[str, Dict[str, Any]],
) -> List[Dict[str, str]]:
    ally = '{a}向{b}提议互不侵犯，并表示愿意共同关注{p}方向的局势。'
    threat = '{a}警告{b}尽快撤出{p}周边，否则将采取军事行动。'
    deceive = '{a}对{b}示好，却在{p}方向暗中调兵，语气含糊而试图误导对方。'
    msgs: List[Dict[str, str]] = []
    for nid in NATION_IDS:
        if rng.randint(0, 100) < 45:
            to = rng.choice([o for o in NATION_IDS if o != nid])
            mv = next((od for od in orders.get(nid, []) if od["action"] == "Move"), None)
            p = province_name(mv["target"]) if mv else "边境"
            cunning = agents.get(nid, {}).get("cunning", 50)
            aggression = agents.get(nid, {}).get("aggression", 50)
            if cunning > 65:
                tpl = deceive
            elif aggression > 60:
                tpl = threat
            else:
                tpl = ally
            msgs.append(
                {
                    "from_nation": nid,
                    "to_nation": to,
                    "content": tpl.format(a=nation_name(nid), b=nation_name(to), p=p),
                }
            )
    return msgs
