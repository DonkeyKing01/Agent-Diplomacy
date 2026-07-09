from types import SimpleNamespace

from routers.game import (
    _active_annual_advice,
    _annual_advice_years_for_nation,
    _build_memory_brief,
    _compose_persistent_memory,
    _default_governance_state,
    _governance_nation_edits,
    _missing_annual_advice_nations,
    _record_governance_nation_edit,
    _record_annual_advice_update,
    _validate_messages,
    _validate_orders,
)
from services import game_logs
from services.game_engine import adjudicate
from services.game_engine import HOME_CENTERS, NATIONS, PROVINCES, initial_board


def test_annual_advice_applies_from_effective_year_onward():
    agent = {"nation_id": "aur", "annual_advice": "Next year push north."}
    governance = _default_governance_state()
    governance["annual_advice_effective_years"]["aur"] = 1902

    assert _active_annual_advice(agent, governance, 1901) == ""
    assert _active_annual_advice(agent, governance, 1902) == "Next year push north."
    assert _active_annual_advice(agent, governance, 1903) == "Next year push north."


def test_annual_advice_defaults_to_current_agent_text_before_any_governance_override():
    agent = {"nation_id": "aur", "annual_advice": "Open cautiously."}
    governance = _default_governance_state()

    assert _active_annual_advice(agent, governance, 1901) == "Open cautiously."


def test_annual_advice_limits_are_tracked_per_nation_not_globally():
    governance = _default_governance_state()
    governance["annual_advice_updated_years"] = [1904]

    assert _annual_advice_years_for_nation(governance, "aur") == []
    assert _annual_advice_years_for_nation(governance, "nor") == []

    _record_annual_advice_update(governance, "aur", 1904)

    assert _annual_advice_years_for_nation(governance, "aur") == [1904]
    assert _annual_advice_years_for_nation(governance, "nor") == []


def test_prompt_and_skills_revision_limits_are_tracked_per_nation():
    governance = _default_governance_state()

    _record_governance_nation_edit(governance, "system_prompt_updated_nations", "aur")
    _record_governance_nation_edit(governance, "system_prompt_updated_nations", "aur")
    _record_governance_nation_edit(governance, "skills_updated_nations", "nor")

    assert _governance_nation_edits(governance, "system_prompt_updated_nations") == {"aur"}
    assert governance["system_prompt_edits_used"] == 1
    assert _governance_nation_edits(governance, "skills_updated_nations") == {"nor"}
    assert governance["skills_edits_used"] == 1


def test_review_annual_advice_requirement_ignores_eliminated_nations():
    governance = _default_governance_state()
    _record_annual_advice_update(governance, "aur", 1902)

    assert _missing_annual_advice_nations(governance, ["aur", "nor"], 1902) == ["nor"]
    assert _missing_annual_advice_nations(governance, ["aur"], 1902) == []


def test_message_validation_enforces_allowed_targets():
    messages = _validate_messages(
        "aur",
        [
            {"to_nation": "mar", "intent": "alliance", "content": "Work together."},
            {"to_nation": "zeph", "intent": "probe", "content": "Far-away ping."},
        ],
        allowed_targets=["mar", "dra"],
    )

    assert messages[0]["to_nation"] == "mar"
    assert messages[1]["to_nation"] == "public"


def test_dislodged_unit_cannot_retreat_to_attack_origin():
    provinces = {
        "aur_cap": "aur",
        "dra_peak": "dra",
        "dra_cap": "dra",
        "aur_port": "aur",
        "ferr_mine": "",
    }
    units = [
        {"owner": "aur", "type": "Army", "location": "aur_cap"},
        {"owner": "dra", "type": "Army", "location": "dra_peak"},
        {"owner": "dra", "type": "Army", "location": "dra_cap"},
    ]
    orders = {
        "aur": [{"unit_province": "aur_cap", "action": "Hold", "target": "", "support_of": ""}],
        "dra": [
            {"unit_province": "dra_peak", "action": "Move", "target": "aur_cap", "support_of": ""},
            {"unit_province": "dra_cap", "action": "Support", "target": "aur_cap", "support_of": "dra_peak"},
        ],
    }

    _, _, _, pending_retreats = adjudicate(provinces, units, orders, rng=__import__("random").Random(1))

    assert len(pending_retreats) == 1
    retreat = pending_retreats[0]
    assert retreat["location"] == "aur_cap"
    assert retreat["attacked_from"] == "dra_peak"
    assert "dra_peak" not in retreat["legal_retreats"]
    assert "ferr_mine" in retreat["legal_retreats"]


def test_validate_orders_upgrades_passive_hold_into_proactive_move():
    state = {
        "units": [
            {"owner": "mar", "type": "Fleet", "location": "mar_isle"},
        ],
        "ownership": {
            "mar_isle": "mar",
            "mar_cap": "mar",
            "lighthouse_isle": "",
            "mar_shoal": "mar",
            "nor_harbor": "nor",
            "sea_far_sw": "",
            "sea_southwest_outer": "",
        },
    }

    orders = _validate_orders(
        "mar",
        [{"unit_province": "mar_isle", "action": "Hold", "target": "", "support_of": ""}],
        state,
    )

    assert len(orders) == 1
    assert orders[0]["unit_province"] == "mar_isle"
    assert orders[0]["action"] == "Move"
    assert orders[0]["target"] != ""


def test_validate_orders_fills_missing_unit_orders_with_proactive_expansion():
    state = {
        "units": [
            {"owner": "kaz", "type": "Army", "location": "kaz_steppe"},
            {"owner": "kaz", "type": "Army", "location": "kaz_cap"},
        ],
        "ownership": {
            "kaz_steppe": "kaz",
            "kaz_cap": "kaz",
            "sol_gate": "",
            "sol_cap": "sol",
            "dra_cap": "dra",
            "dra_pass": "dra",
            "kaz_oasis": "kaz",
        },
    }

    orders = _validate_orders("kaz", [], state)

    assert len(orders) == 2
    assert all(order["action"] == "Move" for order in orders)
    assert {order["target"] for order in orders} == {"mt_goldwall", "kaz_ford"}


def test_support_is_cut_when_supporter_is_attacked_from_elsewhere():
    provinces = {
        "aur_cap": "aur",
        "dra_peak": "dra",
        "dra_watch": "dra",
        "kaz_steppe": "kaz",
    }
    units = [
        {"owner": "aur", "type": "Army", "location": "aur_cap"},
        {"owner": "dra", "type": "Army", "location": "dra_peak"},
        {"owner": "dra", "type": "Army", "location": "dra_watch"},
        {"owner": "kaz", "type": "Army", "location": "kaz_steppe"},
    ]
    orders = {
        "aur": [{"unit_province": "aur_cap", "action": "Hold", "target": "", "support_of": ""}],
        "dra": [
            {"unit_province": "dra_peak", "action": "Move", "target": "aur_cap", "support_of": ""},
            {"unit_province": "dra_watch", "action": "Support", "target": "aur_cap", "support_of": "dra_peak"},
        ],
        "kaz": [{"unit_province": "kaz_steppe", "action": "Move", "target": "dra_watch", "support_of": ""}],
    }

    new_provinces, new_units, pending_conflicts, pending_retreats = adjudicate(
        provinces, units, orders, rng=__import__("random").Random(1)
    )

    assert new_provinces["aur_cap"] == "aur"
    assert any(unit["owner"] == "aur" and unit["location"] == "aur_cap" for unit in new_units)
    assert pending_retreats == []
    defense_conflict = next(conflict for conflict in pending_conflicts if conflict["province"] == "aur_cap")
    assert defense_conflict["kind"] == "\u9632\u5b88"
    assert set(defense_conflict.get("participants", [])) == {"\u4e00\u6392\u9886\u5730", "\u4e5d\u6392\u9886\u5730"}

def test_convoy_chain_allows_army_to_cross_multiple_sea_zones():
    provinces = {
        "lighthouse_isle": "vel",
        "windward_key": "",
        "sea_south_inlet": "",
        "sea_south_mid": "",
        "sea_south": "",
        "sea_south_channel": "",
    }
    units = [
        {"owner": "vel", "type": "Army", "location": "lighthouse_isle"},
        {"owner": "mar", "type": "Fleet", "location": "sea_south_inlet"},
        {"owner": "mar", "type": "Fleet", "location": "sea_south_mid"},
        {"owner": "mar", "type": "Fleet", "location": "sea_south"},
        {"owner": "mar", "type": "Fleet", "location": "sea_south_channel"},
    ]
    orders = {
        "vel": [{"unit_province": "lighthouse_isle", "action": "Move", "target": "windward_key", "support_of": ""}],
        "mar": [
            {"unit_province": "sea_south_inlet", "action": "Convoy", "target": "windward_key", "support_of": "lighthouse_isle"},
            {"unit_province": "sea_south_mid", "action": "Convoy", "target": "windward_key", "support_of": "lighthouse_isle"},
            {"unit_province": "sea_south", "action": "Convoy", "target": "windward_key", "support_of": "lighthouse_isle"},
            {"unit_province": "sea_south_channel", "action": "Convoy", "target": "windward_key", "support_of": "lighthouse_isle"},
        ],
    }

    new_provinces, new_units, _, _ = adjudicate(provinces, units, orders, rng=__import__("random").Random(1))

    assert new_provinces["windward_key"] == "vel"
    assert any(unit["owner"] == "vel" and unit["location"] == "windward_key" for unit in new_units)


def test_coastal_fleet_convoy_order_is_rejected_by_validation():
    state = {
        "units": [
            {"owner": "zeph", "type": "Fleet", "location": "zeph_cap"},
            {"owner": "vel", "type": "Army", "location": "lighthouse_isle"},
        ],
        "ownership": {
            "zeph_cap": "zeph",
            "lighthouse_isle": "vel",
            "windward_key": "",
            "ith_garden": "ith",
            "amber_cross": "",
            "zeph_reef": "zeph",
            "sea_outer_ne": "",
            "sea_east_ocean": "",
        },
    }

    orders = _validate_orders(
        "zeph",
        [{"unit_province": "zeph_cap", "action": "Convoy", "target": "windward_key", "support_of": "lighthouse_isle"}],
        state,
    )

    assert len(orders) == 1
    assert orders[0]["action"] != "Convoy"


def test_game_log_reset_clears_previous_session_content(tmp_path):
    original_root = game_logs._LOG_ROOT
    game_logs._LOG_ROOT = tmp_path
    try:
        session_key = "debug-session"
        game_logs.reset_game_log(session_key, {"reason": "init"})
        game_logs.append_game_log(session_key, "phase_advance_started", {"year": 1901})
        path = game_logs.game_log_path(session_key)
        before_reset = path.read_text(encoding="utf-8")
        assert "phase_advance_started" in before_reset

        game_logs.reset_game_log(session_key, {"reason": "reset"})
        after_reset = path.read_text(encoding="utf-8")
        assert "phase_advance_started" not in after_reset
        assert "session_log_reset" in after_reset
        assert "\"reason\": \"reset\"" in after_reset
    finally:
        game_logs._LOG_ROOT = original_root


def test_compose_persistent_memory_writes_whitelist_blacklist_and_bias():
    agent = {"nation_id": "aur", "memory": ""}
    trust = {
        "aur->mar": 78,
        "aur->dra": 22,
        "aur->nor": 55,
        "aur->ferr": 48,
        "aur->zeph": 50,
        "aur->vel": 50,
        "aur->sol": 50,
        "aur->ith": 50,
        "aur->kaz": 50,
    }
    messages = [
        SimpleNamespace(
            id=3,
            year=1901,
            season="春季·谈判与决策",
            from_nation="dra",
            to_nation="aur",
            intent="betrayal",
            content="Surprise strike.",
        ),
        SimpleNamespace(
            id=2,
            year=1901,
            season="春季·谈判与决策",
            from_nation="mar",
            to_nation="aur",
            intent="alliance",
            content="Let us cooperate.",
        ),
        SimpleNamespace(
            id=1,
            year=1901,
            season="春季·谈判与决策",
            from_nation="mar",
            to_nation="public",
            intent="coordination",
            content="Sea lanes stay open.",
        ),
    ]
    reports = [
        SimpleNamespace(
            year=1901,
            season="春季·谈判与决策",
            headline="1901 春季·谈判与决策",
            body="Mar secured the sea while Dra struck north.",
        )
    ]

    memory = _compose_persistent_memory(agent, "aur", trust, messages, reports, 1901, "春季·谈判与决策")

    assert "信誉白名单：" in memory
    assert "血仇黑名单：" in memory
    assert "历史偏见：" in memory
    assert "二排" in memory
    assert "九排" in memory
    assert "最近更新：1901 春季·谈判与决策" in memory


def test_memory_brief_prioritizes_persistent_memory_over_dynamic_signals():
    agent = {"memory": "信誉白名单：\n- 二排：可信。"}
    trust = {"aur->mar": 80}
    memory_brief = _build_memory_brief(agent, "aur", trust, [], [])

    assert memory_brief["persistent_memory"] == agent["memory"]
    assert "primary long-term bias baseline" in memory_brief["memory_priority"]


def test_initial_nations_are_named_by_platoon():
    names = [nation["name"] for nation in NATIONS]

    assert names == [
        "一排领地",
        "二排领地",
        "三排领地",
        "四排领地",
        "五排领地",
        "六排领地",
        "七排领地",
        "八排领地",
        "九排领地",
        "十排领地",
    ]


def test_two_island_map_has_neutral_central_contested_region():
    ownership, units, sc_count = initial_board()
    central_sea_corridor = {
        "mt_ashencrest",
        "dra_cap",
        "dra_pass",
        "sol_temple",
        "nor_wood",
        "nor_cap",
        "vel_hill",
        "sea_south_inlet",
        "sea_southwest_tail",
    }

    assert all(PROVINCES[province_id]["type"] == "sea" for province_id in central_sea_corridor)
    assert all(not PROVINCES[province_id]["sc"] for province_id in central_sea_corridor)
    assert all(ownership[province_id] == "" for province_id in central_sea_corridor)
    assert ownership["lighthouse_isle"] == ""
    assert PROVINCES["lighthouse_isle"]["sc"]
    assert ownership["mt_rimepass"] == "aur"
    assert ownership["aur_cliff"] == "aur"
    assert ownership["aur_north"] == ""
    assert ownership["aur_port"] == ""
    assert sc_count == {nation["id"]: len(HOME_CENTERS[nation["id"]]) for nation in NATIONS}
    assert len(units) == 30
    assert PROVINCES["dra_cap"]["type"] == "sea"
    assert "aur_cap" in PROVINCES["dra_cap"]["adj"]
    assert "kaz_steppe" in PROVINCES["dra_cap"]["adj"]
    assert any(unit["owner"] == "aur" and unit["type"] == "Fleet" and unit["location"] == "aur_cliff" for unit in units)
    assert all(
        (unit["type"] == "Fleet" and PROVINCES[unit["location"]]["type"] in {"coast", "sea"})
        or (unit["type"] == "Army" and PROVINCES[unit["location"]]["type"] in {"land", "coast"})
        for unit in units
    )


def test_coastal_cells_must_touch_real_sea_tiles():
    invalid = [
        province_id
        for province_id, province in PROVINCES.items()
        if province["type"] == "coast"
        and not any(PROVINCES[neighbor]["type"] == "sea" for neighbor in province["adj"])
    ]

    assert invalid == []


def test_inland_cells_use_armies_in_new_opening_setup():
    ownership, units, _ = initial_board()

    assert ownership["mar_dock"] == "mar"
    assert ownership["ith_spring"] == "ith"
    assert PROVINCES["mar_dock"]["type"] == "land"
    assert PROVINCES["ith_spring"]["type"] == "land"
    assert PROVINCES["mar_dock"]["name"] == "二排中镇"
    assert any(unit["owner"] == "mar" and unit["type"] == "Army" and unit["location"] == "mar_dock" for unit in units)
    assert any(unit["owner"] == "ith" and unit["type"] == "Army" and unit["location"] == "ith_spring" for unit in units)
    assert not any(unit["type"] == "Fleet" and unit["location"] in {"mar_dock", "ith_spring"} for unit in units)
