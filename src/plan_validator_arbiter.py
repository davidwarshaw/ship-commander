"""Plan validation and arbitration entrypoint."""

from __future__ import annotations

from typing import Any


# @spec PLANARB-VAL-001, PLANARB-VAL-002, PLANARB-VAL-003, PLANARB-VAL-004, PLANARB-VAL-005
# @spec PLANARB-PERM-001, PLANARB-PERM-002
# @spec PLANARB-FEAS-001, PLANARB-FEAS-002
# @spec PLANARB-ARB-001, PLANARB-ARB-002, PLANARB-ARB-003, PLANARB-ARB-004, PLANARB-ARB-005
# @spec PLANARB-CLAR-001, PLANARB-CLAR-002, PLANARB-CLAR-003, PLANARB-CLAR-004, PLANARB-CLAR-005
# @spec PLANARB-OBS-001, PLANARB-OBS-002, PLANARB-OBS-003, PLANARB-OBS-004, PLANARB-OBS-005
# @spec PLANARB-ERR-001, PLANARB-ERR-002, PLANARB-ERR-003
def validate_and_arbitrate(plans: list[dict[str, Any]], context: dict[str, Any]) -> dict[str, Any]:
    """Validate and arbitrate candidate plans."""
    if not isinstance(plans, list):
        return _operational_error("INVALID_PLANS_CONTRACT")

    role_permissions: dict[str, set[str]] = {
        role: set(families) for role, families in context.get("role_permissions", {}).items()
    }
    action_schemas: dict[str, dict[str, Any]] = context.get("action_schemas", {})
    resources: dict[str, float] = {
        key: float(value) for key, value in context.get("resources", {}).items()
    }

    accepted_candidates: list[dict[str, Any]] = []
    rejected_actions: list[dict[str, Any]] = []

    for plan in plans:
        plan_id = str(plan.get("plan_id", "UNKNOWN_PLAN"))
        role = str(plan.get("role", "unknown"))
        confidence = plan.get("confidence")
        if not isinstance(confidence, (int, float)) or not 0.0 <= float(confidence) <= 1.0:
            rejected_actions.append(_reject(plan_id, None, "INVALID_CONFIDENCE"))
            continue
        actions = plan.get("actions", [])
        clarification_only = bool(plan.get("clarification_only"))
        if not clarification_only and not actions:
            rejected_actions.append(_reject(plan_id, None, "PLAN_EMPTY_ACTIONS"))
            continue
        remaining_for_plan = 0
        for idx, action in enumerate(actions):
            action_id = str(action.get("action_id", f"{plan_id}-A{idx}"))
            family = str(action.get("family", ""))
            params = action.get("params")
            if not isinstance(params, dict):
                rejected_actions.append(_reject(plan_id, action_id, "INVALID_ACTION_PARAMS"))
                continue

            if role not in role_permissions or family not in role_permissions[role]:
                rejected_actions.append(_reject(plan_id, action_id, "ROLE_PERMISSION_DENIED"))
                continue

            schema = action_schemas.get(family)
            if schema and not _params_match_schema(params, schema):
                rejected_actions.append(_reject(plan_id, action_id, "PARAM_CONSTRAINT_VIOLATION"))
                continue

            resource_cost = float(action.get("resource_cost", 0.0))
            resource_key = str(action.get("resource", "energy"))
            if resource_cost > 0 and resources.get(resource_key, 0.0) < resource_cost:
                rejected_actions.append(_reject(plan_id, action_id, "RESOURCE_UNAVAILABLE"))
                continue

            accepted_candidates.append(
                {
                    "plan_id": plan_id,
                    "action_id": action_id,
                    "family": family,
                    "params": params,
                    "resource": resource_key,
                    "resource_cost": resource_cost,
                    "confidence": float(confidence),
                    "mission_priority": float(action.get("mission_priority", plan.get("mission_priority", 0.0))),
                    "risk": float(action.get("risk", plan.get("risk", 0.0))),
                }
            )
            remaining_for_plan += 1

        if actions and remaining_for_plan == 0:
            rejected_actions.append(_reject(plan_id, None, "PLAN_EMPTY_AFTER_VALIDATION"))

    if context.get("simulate_dependency_unavailable"):
        return _operational_error("ARBITER_DEPENDENCY_UNAVAILABLE", rejected_actions)

    weights = context.get("weights", {"priority_weight": 1.0, "risk_weight": 1.0, "confidence_weight": 1.0})
    chosen: list[dict[str, Any]] = []
    used_resources: set[str] = set()

    for candidate in sorted(
        accepted_candidates,
        key=lambda c: (
            -_score(c, weights),
            -c["mission_priority"],
            c["risk"],
            -c["confidence"],
            c["plan_id"],
            c["action_id"],
        ),
    ):
        if candidate["resource_cost"] > 0 and candidate["resource"] in used_resources:
            rejected_actions.append(_reject(candidate["plan_id"], candidate["action_id"], "RESOURCE_CONTENTION"))
            continue
        if candidate["resource_cost"] > 0:
            used_resources.add(candidate["resource"])
        chosen.append(candidate)

    unresolved = context.get("unresolved_ambiguities", [])
    clarification_needed = len(chosen) == 0 or len(unresolved) > 0
    if context.get("cross_runtime_split") and not bool(context.get("ordered_messaging", True)):
        return _operational_error("UNORDERED_CROSS_RUNTIME_MESSAGING", rejected_actions)

    return {
        "status": "ok",
        "accepted_actions": [
            {
                "plan_id": c["plan_id"],
                "action_id": c["action_id"],
                "family": c["family"],
                "params": c["params"],
            }
            for c in chosen
        ],
        "rejected_actions": rejected_actions,
        "unresolved_ambiguities": unresolved,
        "clarification_needed": clarification_needed,
        "operational_error": False,
        "tie_break_rationale": {
            "visibility_eligible": bool(context.get("tie_break_material")),
            "weights": weights,
        },
        "client_state_update": {
            "target_slice": "orchestration.arbitration",
            "canonical_state_mutation": False,
        },
        "messaging": {
            "cross_runtime": bool(context.get("cross_runtime_split")),
            "ordered_delivery": not bool(context.get("cross_runtime_split")) or bool(context.get("ordered_messaging", True)),
            "sequence": int(context.get("message_sequence", 0)),
        },
    }


def _score(candidate: dict[str, Any], weights: dict[str, Any]) -> float:
    priority_weight = float(weights.get("priority_weight", 1.0))
    risk_weight = float(weights.get("risk_weight", 1.0))
    confidence_weight = float(weights.get("confidence_weight", 1.0))
    return (
        candidate["mission_priority"] * priority_weight
        - candidate["risk"] * risk_weight
        + candidate["confidence"] * confidence_weight
    )


def _params_match_schema(params: dict[str, Any], schema: dict[str, Any]) -> bool:
    required = schema.get("required", [])
    for field in required:
        if field not in params:
            return False
    ranges = schema.get("ranges", {})
    for key, bounds in ranges.items():
        if key not in params:
            continue
        value = params[key]
        if not isinstance(value, (int, float)):
            return False
        if "min" in bounds and value < bounds["min"]:
            return False
        if "max" in bounds and value > bounds["max"]:
            return False
    return True


def _reject(plan_id: str, action_id: str | None, reason_code: str) -> dict[str, Any]:
    payload = {"plan_id": plan_id, "reason_code": reason_code}
    if action_id is not None:
        payload["action_id"] = action_id
    return payload


def _operational_error(reason_code: str, rejected_actions: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "status": "error",
        "accepted_actions": [],
        "rejected_actions": rejected_actions or [],
        "unresolved_ambiguities": [],
        "clarification_needed": False,
        "operational_error": True,
        "operational_error_reason": reason_code,
    }
