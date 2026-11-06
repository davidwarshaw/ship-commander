"""LLM plan generation entrypoint."""

from __future__ import annotations

import hashlib
import json
from typing import Any


# @spec LLMGEN-PROMPT-001, LLMGEN-PROMPT-002, LLMGEN-PROMPT-003, LLMGEN-PROMPT-004
# @spec LLMGEN-PLAN-001, LLMGEN-PLAN-002, LLMGEN-PLAN-003, LLMGEN-PLAN-004, LLMGEN-PLAN-005, LLMGEN-PLAN-006
# @spec LLMGEN-VAL-001, LLMGEN-VAL-002, LLMGEN-VAL-003, LLMGEN-VAL-004, LLMGEN-VAL-005
# @spec LLMGEN-CLAR-001, LLMGEN-CLAR-002, LLMGEN-CLAR-003
# @spec LLMGEN-OBS-001, LLMGEN-OBS-002, LLMGEN-OBS-003
# @spec LLMGEN-ERR-001, LLMGEN-ERR-002, LLMGEN-ERR-003, LLMGEN-ERR-004
def generate_crew_plans(turn_input: dict[str, Any]) -> dict[str, Any]:
    """Generate crew plans for a captain turn."""
    required = ["captain_message", "snapshot_id", "mission_context", "ship_status_summary"]
    missing = [field for field in required if field not in turn_input]
    if missing:
        return {
            "status": "error",
            "planning_operational_error": True,
            "planning_error_reason": "MISSING_TURN_INPUT_FIELDS",
            "missing_fields": missing,
            "plans": [],
        }

    policy = turn_input.get("generation_policy", {})
    timeout_policy = policy.get("timeout_policy", "operational_error")
    confidence_floor = float(policy.get("confidence_floor", 0.0))
    max_attempts = int(policy.get("max_attempts", 1))
    max_attempts = max(1, max_attempts)

    prompt_payload = {
        "captain_message": turn_input["captain_message"],
        "snapshot_id": turn_input["snapshot_id"],
        "mission_context": turn_input["mission_context"],
        "ship_status_summary": turn_input["ship_status_summary"],
        "role_catalog": turn_input.get("role_catalog", []),
    }
    prompt_hash = hashlib.sha256(
        json.dumps(prompt_payload, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()

    if turn_input.get("simulate_connectivity_failure"):
        return {
            "status": "error",
            "planning_clarification_needed": bool(turn_input.get("simulate_clarification_signal")),
            "planning_operational_error": True,
            "planning_error_reason": "MODEL_SERVICE_UNREACHABLE",
            "plans": [],
            "metadata": {"prompt_hash": prompt_hash, "attempt_count": 1},
        }

    if turn_input.get("simulate_timeout"):
        if timeout_policy == "clarification":
            return {
                "status": "clarification_required",
                "planning_clarification_needed": True,
                "planning_reasons": ["GENERATION_TIMEOUT"],
                "plans": [],
                "metadata": {"prompt_hash": prompt_hash, "attempt_count": 1},
            }
        return {
            "status": "error",
            "planning_operational_error": True,
            "planning_error_reason": "GENERATION_TIMEOUT",
            "plans": [],
            "metadata": {"prompt_hash": prompt_hash, "attempt_count": 1},
        }

    attempts: list[list[dict[str, Any]]] = turn_input.get("candidate_plans_attempts", [])
    if not attempts:
        attempts = [[{
            "plan_id": "PLAN-DEFAULT-1",
            "role": "operations",
            "goal": "Acknowledge captain intent and hold position.",
            "actions": [{"action_id": "ACT-HOLD-1", "family": "hold_position", "params": {}}],
            "contingencies": [],
            "confidence": 0.75,
            "rationale": "No explicit maneuver requested; maintain safety.",
        }]]

    validation_errors: list[str] = []
    selected_plans: list[dict[str, Any]] = []
    attempts_used = 0
    max_run = min(len(attempts), max_attempts + 1)
    for idx in range(max_run):
        attempts_used = idx + 1
        candidate = attempts[idx]
        errors, valid = _validate_plans(candidate, confidence_floor)
        if not errors:
            selected_plans = valid
            break
        validation_errors = errors

    if not selected_plans:
        return {
            "status": "clarification_required",
            "planning_clarification_needed": True,
            "planning_reasons": ["PLAN_VALIDATION_FAILED"],
            "validation_errors": validation_errors,
            "plans": [],
            "metadata": {
                "prompt_hash": prompt_hash,
                "attempt_count": attempts_used,
                "validation_feedback": validation_errors,
            },
        }

    return {
        "status": "ok",
        "planning_clarification_needed": False,
        "planning_operational_error": False,
        "plans": selected_plans,
        "metadata": {
            "prompt_hash": prompt_hash,
            "attempt_count": attempts_used,
            "model_version": policy.get("model_version", "local-default"),
            "validation_feedback": validation_errors,
        },
    }


def _validate_plans(
    plans: list[dict[str, Any]], confidence_floor: float
) -> tuple[list[str], list[dict[str, Any]]]:
    errors: list[str] = []
    valid_plans: list[dict[str, Any]] = []
    required_plan_fields = {"plan_id", "role", "goal", "actions", "contingencies", "confidence", "rationale"}
    seen_plan_ids: set[str] = set()
    for plan in plans:
        missing = sorted(required_plan_fields - set(plan))
        if missing:
            errors.append(f"{plan.get('plan_id', 'UNKNOWN')}:MISSING_FIELDS:{','.join(missing)}")
            continue
        plan_id = str(plan["plan_id"])
        if plan_id in seen_plan_ids:
            errors.append(f"{plan_id}:DUPLICATE_PLAN_ID")
            continue
        seen_plan_ids.add(plan_id)
        confidence = plan["confidence"]
        if not isinstance(confidence, (int, float)) or not 0.0 <= float(confidence) <= 1.0:
            errors.append(f"{plan_id}:INVALID_CONFIDENCE")
            continue
        clarification_only = bool(plan.get("clarification_only"))
        actions = plan.get("actions", [])
        if not clarification_only and not actions:
            errors.append(f"{plan_id}:PLAN_EMPTY_ACTIONS")
            continue
        if float(confidence) < confidence_floor:
            errors.append(f"{plan_id}:BELOW_CONFIDENCE_FLOOR")
            continue
        for action in actions:
            if "action_id" not in action or "family" not in action or "params" not in action:
                errors.append(f"{plan_id}:INVALID_ACTION_SHAPE")
                break
            if not isinstance(action["params"], dict):
                errors.append(f"{plan_id}:INVALID_ACTION_PARAMS")
                break
        else:
            valid_plans.append(plan)
    return errors, valid_plans
