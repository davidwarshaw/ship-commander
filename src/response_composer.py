"""Response composition entrypoint."""

from __future__ import annotations

from typing import Any


# @spec RESPCOMP-CLASS-001, RESPCOMP-CLASS-002, RESPCOMP-CLASS-003
# @spec RESPCOMP-EVID-001, RESPCOMP-EVID-002, RESPCOMP-EVID-003, RESPCOMP-EVID-004
# @spec RESPCOMP-NARR-001, RESPCOMP-NARR-002, RESPCOMP-NARR-003, RESPCOMP-NARR-004, RESPCOMP-NARR-005
# @spec RESPCOMP-OUT-001, RESPCOMP-OUT-002, RESPCOMP-OUT-003
# @spec RESPCOMP-MSG-001, RESPCOMP-MSG-002, RESPCOMP-MSG-003, RESPCOMP-MSG-004, RESPCOMP-MSG-005
# @spec RESPCOMP-ERR-001, RESPCOMP-ERR-002, RESPCOMP-ERR-003, RESPCOMP-ERR-004
def compose_turn_response(turn_data: dict[str, Any]) -> dict[str, Any]:
    """Compose captain-facing response payload."""
    required = ["captain_message", "turn_id"]
    missing = [field for field in required if field not in turn_data]
    if missing:
        return {
            "outcome_classification": "operational_failure",
            "outcome_summary": "Turn response unavailable due to missing response inputs.",
            "crew_lines": [],
            "rejected_action_explanations": [],
            "clarification_prompts": [],
            "operational_notices": [
                {
                    "failure_class": "MISSING_COMPOSER_INPUTS",
                    "message": f"Missing required fields: {', '.join(missing)}",
                    "diagnostics_ref": turn_data.get("diagnostics_ref", "diag-missing-input"),
                }
            ],
            "trace_references": {},
        }

    policy = turn_data.get("response_policy", {})
    canonical_outcome = turn_data.get("canonical_outcome_classification")
    arbitration = turn_data.get("arbitration_result", {})
    execution = turn_data.get("execution_result", {})
    planning_error = bool(turn_data.get("planning_operational_error"))
    planning_clarification = bool(turn_data.get("planning_clarification_needed"))
    execution_reason = execution.get("reason_code")

    if canonical_outcome:
        outcome = canonical_outcome
    elif planning_error or arbitration.get("operational_error") or execution_reason in {
        "EXECUTION_HANDLER_FAULT",
        "ROLLBACK_INTERNAL_FAULT",
        "EXECUTION_POLICY_VERSION_MISMATCH",
    }:
        outcome = "operational_failure"
    elif planning_clarification or arbitration.get("clarification_needed") or execution_reason == "RUNTIME_PRECONDITION_INVALIDATED":
        outcome = "clarification_required"
    else:
        outcome = "completed"

    accepted = arbitration.get("accepted_actions", [])
    rejected = arbitration.get("rejected_actions", [])
    unresolved = arbitration.get("unresolved_ambiguities", [])

    crew_lines = [
        {
            "role": action.get("plan_id", "crew"),
            "text": f"Executing {action.get('family', 'action')} ({action.get('action_id')}).",
            "source_action_id": action.get("action_id"),
        }
        for action in accepted
    ]
    rejected_lines = [
        {
            "action_id": item.get("action_id"),
            "plan_id": item.get("plan_id"),
            "reason_code": item.get("reason_code"),
            "message": _reason_message(item.get("reason_code"), policy.get("reason_map", {})),
        }
        for item in rejected
    ]

    clarification_prompts: list[str] = []
    if outcome == "clarification_required":
        for reason in unresolved or turn_data.get("planning_reasons", []):
            clarification_prompts.append(f"Clarify: {reason}.")

    operational_notices: list[dict[str, Any]] = []
    if outcome == "operational_failure":
        failure_classes = []
        if planning_error:
            failure_classes.append(turn_data.get("planning_error_reason", "PLANNING_FAILURE"))
        if arbitration.get("operational_error"):
            failure_classes.append(arbitration.get("operational_error_reason", "ARBITRATION_FAILURE"))
        if execution_reason:
            failure_classes.append(execution_reason)
        if turn_data.get("trace_persistence_failure"):
            failure_classes.append("TRACE_PERSISTENCE_FAILURE")
        if not failure_classes:
            failure_classes.append("UNKNOWN_FAILURE")
        primary_policy = policy.get("primary_failure_policy", "first")
        primary = failure_classes[0] if primary_policy != "last" else failure_classes[-1]
        operational_notices.append(
            {
                "failure_class": primary,
                "secondary_failure_classes": [c for c in failure_classes if c != primary],
                "message": _reason_message(primary, policy.get("reason_map", {})),
                "diagnostics_ref": turn_data.get("diagnostics_ref", f"diag-{turn_data['turn_id']}"),
                "retry_allowed": bool(policy.get("retry_allowed", False)),
            }
        )

    outcome_summary = {
        "completed": "Turn completed successfully.",
        "clarification_required": "Turn requires clarification before safe execution.",
        "operational_failure": "Turn failed due to an operational issue.",
    }[outcome]

    tie_break_visible = bool(
        policy.get("tie_break_visibility", False)
        and arbitration.get("tie_break_rationale", {}).get("visibility_eligible")
    )
    if tie_break_visible:
        rejected_lines.append(
            {
                "action_id": None,
                "plan_id": None,
                "reason_code": "TIE_BREAK_RATIONALE",
                "message": "Selection used configured tie-break policy.",
            }
        )

    return {
        "outcome_classification": outcome,
        "outcome_summary": outcome_summary,
        "crew_lines": crew_lines,
        "rejected_action_explanations": rejected_lines,
        "clarification_prompts": clarification_prompts,
        "operational_notices": operational_notices,
        "trace_references": {
            "accepted_action_ids": [a.get("action_id") for a in accepted],
            "rejected_action_ids": [r.get("action_id") for r in rejected],
            "event_ids": [e.get("action_id") for e in execution.get("events", [])],
        },
    }


def _reason_message(reason_code: str | None, reason_map: dict[str, str]) -> str:
    if reason_code is None:
        return "No reason available."
    if reason_code in reason_map:
        return reason_map[reason_code]
    label = reason_code.replace("_", " ").lower()
    return f"{label} ({reason_code})"
