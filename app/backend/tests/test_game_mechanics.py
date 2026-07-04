from routers.game import _active_annual_advice, _default_governance_state, _validate_messages
from services.game_engine import adjudicate


def test_annual_advice_only_applies_in_effective_year():
    agent = {"nation_id": "aur", "annual_advice": "Next year push north."}
    governance = _default_governance_state()
    governance["annual_advice_effective_years"]["aur"] = 1902

    assert _active_annual_advice(agent, governance, 1901) == ""
    assert _active_annual_advice(agent, governance, 1902) == "Next year push north."
    assert _active_annual_advice(agent, governance, 1903) == ""


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

