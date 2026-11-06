"""Crew command loop orchestration entrypoint."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from src.llm_plan_generator import generate_crew_plans
from src.plan_validator_arbiter import validate_and_arbitrate
from src.response_composer import compose_turn_response
from src.simulation_engine_turn_execution import execute_round


# @spec CREWCMD-CORE-001, CREWCMD-CORE-002, CREWCMD-CORE-003, CREWCMD-CORE-004, CREWCMD-CORE-005, CREWCMD-CORE-006, CREWCMD-CORE-007
# @spec CREWCMD-PLAN-001, CREWCMD-PLAN-002, CREWCMD-PLAN-003, CREWCMD-PLAN-004, CREWCMD-PLAN-005, CREWCMD-PLAN-006, CREWCMD-PLAN-007, CREWCMD-PLAN-008
# @spec CREWCMD-ARB-001, CREWCMD-ARB-002, CREWCMD-ARB-003, CREWCMD-ARB-004, CREWCMD-ARB-005, CREWCMD-ARB-006, CREWCMD-ARB-007, CREWCMD-ARB-008, CREWCMD-ARB-009, CREWCMD-ARB-010, CREWCMD-ARB-011, CREWCMD-ARB-012
# @spec CREWCMD-EXEC-001, CREWCMD-EXEC-002, CREWCMD-EXEC-003, CREWCMD-EXEC-004, CREWCMD-EXEC-005, CREWCMD-EXEC-006, CREWCMD-EXEC-007, CREWCMD-EXEC-008
# @spec CREWCMD-CLAR-001, CREWCMD-CLAR-002, CREWCMD-CLAR-003
# @spec CREWCMD-OBS-001, CREWCMD-OBS-002, CREWCMD-OBS-003, CREWCMD-OBS-004, CREWCMD-OBS-005, CREWCMD-OBS-006, CREWCMD-OBS-007, CREWCMD-OBS-008, CREWCMD-OBS-009, CREWCMD-OBS-010
def process_turn(turn_input: dict[str, Any]) -> dict[str, Any]:
    """Process a single captain turn through orchestration."""
    turn_id = turn_input.get("turn_id") or _turn_id(turn_input)
    lock_state = turn_input.get("session_lock", {})
    if lock_state and not bool(lock_state.get("is_lock_owner", False)):
        return {
            "turn_id": turn_id,
            "status": "read_only",
            "outcome_classification": "operational_failure",
            "planning": {},
            "arbitration": {},
            "execution": {},
            "response": compose_turn_response(
                {
                    "turn_id": turn_id,
                    "captain_message": turn_input.get("captain_message", ""),
                    "canonical_outcome_classification": "operational_failure",
                    "planning_operational_error": True,
                    "planning_error_reason": "SESSION_LOCK_NOT_OWNER",
                    "response_policy": turn_input.get("response_policy", {}),
                }
            ),
            "observability": {
                "read_only": True,
                "lock_owner_tab_id": lock_state.get("lock_owner_tab_id"),
            },
        }

    planning = generate_crew_plans(turn_input)

    if planning.get("planning_operational_error"):
        outcome = "operational_failure"
        response = compose_turn_response(
            {
                "turn_id": turn_id,
                "captain_message": turn_input.get("captain_message", ""),
                "planning_operational_error": True,
                "planning_error_reason": planning.get("planning_error_reason"),
                "canonical_outcome_classification": outcome,
                "response_policy": turn_input.get("response_policy", {}),
            }
        )
        return {
            "turn_id": turn_id,
            "status": "failed",
            "outcome_classification": outcome,
            "planning": planning,
            "arbitration": {},
            "execution": {},
            "response": response,
            "observability": {"prompt_hash": planning.get("metadata", {}).get("prompt_hash")},
        }

    if planning.get("planning_clarification_needed") and not planning.get("plans"):
        outcome = "clarification_required"
        response = compose_turn_response(
            {
                "turn_id": turn_id,
                "captain_message": turn_input.get("captain_message", ""),
                "planning_clarification_needed": True,
                "planning_reasons": planning.get("planning_reasons", []),
                "canonical_outcome_classification": outcome,
                "response_policy": turn_input.get("response_policy", {}),
            }
        )
        return {
            "turn_id": turn_id,
            "status": "awaiting_clarification",
            "outcome_classification": outcome,
            "planning": planning,
            "arbitration": {},
            "execution": {},
            "response": response,
            "observability": {"prompt_hash": planning.get("metadata", {}).get("prompt_hash")},
        }

    arbitration_context = turn_input.get("arbitration_context", {})
    arbitration = validate_and_arbitrate(planning.get("plans", []), arbitration_context)
    if arbitration.get("operational_error"):
        outcome = "operational_failure"
        response = compose_turn_response(
            {
                "turn_id": turn_id,
                "captain_message": turn_input.get("captain_message", ""),
                "arbitration_result": arbitration,
                "canonical_outcome_classification": outcome,
                "response_policy": turn_input.get("response_policy", {}),
            }
        )
        return {
            "turn_id": turn_id,
            "status": "failed",
            "outcome_classification": outcome,
            "planning": planning,
            "arbitration": arbitration,
            "execution": {},
            "response": response,
            "observability": {"prompt_hash": planning.get("metadata", {}).get("prompt_hash")},
        }

    if arbitration.get("clarification_needed"):
        outcome = "clarification_required"
        response = compose_turn_response(
            {
                "turn_id": turn_id,
                "captain_message": turn_input.get("captain_message", ""),
                "arbitration_result": arbitration,
                "canonical_outcome_classification": outcome,
                "response_policy": turn_input.get("response_policy", {}),
            }
        )
        return {
            "turn_id": turn_id,
            "status": "awaiting_clarification",
            "outcome_classification": outcome,
            "planning": planning,
            "arbitration": arbitration,
            "execution": {},
            "response": response,
            "observability": {"prompt_hash": planning.get("metadata", {}).get("prompt_hash")},
        }

    execution_context = turn_input.get("execution_context", {})
    execution = execute_round(arbitration.get("accepted_actions", []), execution_context)

    outcome = "completed"
    status = "completed"
    if execution.get("status") == "error":
        if execution.get("reason_code") == "RUNTIME_PRECONDITION_INVALIDATED":
            outcome = "clarification_required"
            status = "awaiting_clarification"
        else:
            outcome = "operational_failure"
            status = "failed"

    response = compose_turn_response(
        {
            "turn_id": turn_id,
            "captain_message": turn_input.get("captain_message", ""),
            "arbitration_result": arbitration,
            "execution_result": execution,
            "canonical_outcome_classification": outcome,
            "response_policy": turn_input.get("response_policy", {}),
            "trace_persistence_failure": bool(turn_input.get("trace_persistence_failure")),
        }
    )
    return {
        "turn_id": turn_id,
        "status": status,
        "outcome_classification": outcome,
        "planning": planning,
        "arbitration": arbitration,
        "execution": execution,
        "response": response,
        "observability": {
            "prompt_hash": planning.get("metadata", {}).get("prompt_hash"),
            "canonical_outcome_classification": outcome,
        },
    }


def _turn_id(turn_input: dict[str, Any]) -> str:
    payload = {
        "captain_message": turn_input.get("captain_message", ""),
        "snapshot_id": turn_input.get("snapshot_id"),
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return f"turn-{digest[:12]}"
