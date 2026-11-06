"""Presentation layer entrypoint."""

from __future__ import annotations

from typing import Any


# @spec PRESENT-BIND-001, PRESENT-BIND-001A, PRESENT-BIND-002, PRESENT-BIND-003, PRESENT-BIND-004, PRESENT-BIND-005, PRESENT-BIND-006
# @spec PRESENT-LOG-001, PRESENT-LOG-002, PRESENT-LOG-003
# @spec PRESENT-PROJ-001, PRESENT-PROJ-002, PRESENT-PROJ-003, PRESENT-PROJ-004
# @spec PRESENT-MODE-001, PRESENT-MODE-002, PRESENT-MODE-003, PRESENT-MODE-004, PRESENT-MODE-005
# @spec PRESENT-SNAP-001, PRESENT-SNAP-002
# @spec PRESENT-ERR-001, PRESENT-ERR-002, PRESENT-ERR-003, PRESENT-ERR-004
def render_turn_view(turn_output: dict[str, Any], projection_data: dict[str, Any]) -> dict[str, Any]:
    """Render command-log-first turn view plus projections."""
    turn_output = _shape_turn_output(turn_output)
    required_keys = {
        "outcome_summary",
        "crew_lines",
        "rejected_action_explanations",
        "clarification_prompts",
        "operational_notices",
    }
    missing = sorted(required_keys - set(turn_output))
    if missing:
        return {
            "status": "error",
            "operational_state": True,
            "message": f"Missing CaptainTurnOutput keys: {', '.join(missing)}",
            "command_log": [],
            "tactical_view": {"available": False},
            "status_view": {"available": False},
            "stale_projection": True,
        }
    contract_violations = list(turn_output.get("_contract_violations", []))

    turn_snapshot = projection_data.get("turn_snapshot_id")
    projection_snapshot = projection_data.get("projection_snapshot_id")
    stale = turn_snapshot != projection_snapshot

    command_log = [
        {"section": "outcome_summary", "content": turn_output["outcome_summary"]},
        {"section": "crew_lines", "content": turn_output["crew_lines"]},
        {"section": "rejected_action_explanations", "content": turn_output["rejected_action_explanations"]},
        {"section": "clarification_prompts", "content": turn_output["clarification_prompts"]},
        {"section": "operational_notices", "content": turn_output["operational_notices"]},
    ]

    tactical_entities = projection_data.get("tactical_entities", [])
    status_panels = projection_data.get("status_panels", [])
    highlights = projection_data.get("highlight_entity_ids", [])
    available_entity_ids = {entity.get("id") for entity in tactical_entities}
    applied_highlights = [hid for hid in highlights if hid in available_entity_ids]
    if stale:
        applied_highlights = []

    mode_policy = projection_data.get("mode_policy", {})
    notice_priority = mode_policy.get("operational_notice_priority", "preserve_order")
    if notice_priority == "pin_top" and turn_output["operational_notices"]:
        command_log = [command_log[-1]] + command_log[:-1]

    return {
        "status": "ok",
        "operational_state": False,
        "command_log": command_log,
        "tactical_view": {
            "available": True,
            "entities": tactical_entities,
            "highlights": applied_highlights,
            "wireframe_theme": "black_and_white",
        },
        "status_view": {
            "available": True,
            "panels": status_panels,
        },
        "stale_projection": stale,
        "stale_warning": stale,
        "mode_toggle_allowed_when_stale": True,
        "canonical_outcome_classification": projection_data.get("canonical_outcome_classification"),
        "normalized_presentation_state": {
            "command_log_entries": len(command_log),
            "tactical_entity_count": len(tactical_entities),
            "status_panel_count": len(status_panels),
        },
        "input_contract_violations": contract_violations,
    }


def _shape_turn_output(turn_output: dict[str, Any]) -> dict[str, Any]:
    shaped = dict(turn_output)
    violations: list[str] = []
    defaults: dict[str, Any] = {
        "outcome_summary": "",
        "crew_lines": [],
        "rejected_action_explanations": [],
        "clarification_prompts": [],
        "operational_notices": [],
    }
    for key, default_value in defaults.items():
        if key not in shaped:
            shaped[key] = default_value
            violations.append(key)
    shaped["_contract_violations"] = violations
    return shaped
