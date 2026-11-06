"""Simulation engine turn-execution entrypoint."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


# @spec SIMEXEC-GATE-001, SIMEXEC-GATE-002, SIMEXEC-GATE-003, SIMEXEC-GATE-004, SIMEXEC-GATE-005, SIMEXEC-GATE-006
# @spec SIMEXEC-TX-001, SIMEXEC-TX-002, SIMEXEC-TX-003, SIMEXEC-TX-004, SIMEXEC-TX-005
# @spec SIMEXEC-COMMIT-001, SIMEXEC-COMMIT-002, SIMEXEC-COMMIT-003, SIMEXEC-COMMIT-004
# @spec SIMEXEC-DET-001, SIMEXEC-DET-002, SIMEXEC-DET-003, SIMEXEC-DET-004
# @spec SIMEXEC-INV-001, SIMEXEC-INV-002, SIMEXEC-INV-003
# @spec SIMEXEC-OBS-001, SIMEXEC-OBS-002, SIMEXEC-OBS-003, SIMEXEC-OBS-004
# @spec SIMEXEC-ERR-001, SIMEXEC-ERR-002, SIMEXEC-ERR-003
def execute_round(accepted_actions: list[dict[str, Any]], context: dict[str, Any]) -> dict[str, Any]:
    """Execute a round of accepted actions in the simulation engine."""
    if context.get("turn_snapshot_id") != context.get("canonical_snapshot_id"):
        return _gate_failure("SNAPSHOT_STALE")
    if context.get("required_seed") and not context.get("seed_metadata"):
        return _gate_failure("DETERMINISM_METADATA_INVALID")
    if not accepted_actions:
        return _gate_failure("INVALID_ACCEPTED_ACTIONS")
    if context.get("accepted_policy_version") != context.get("execution_policy_version"):
        return _gate_failure("EXECUTION_POLICY_VERSION_MISMATCH")

    base_state = deepcopy(context.get("state", {}))
    staged = deepcopy(base_state)
    events: list[dict[str, Any]] = []
    deltas: dict[str, Any] = {}

    for idx, action in enumerate(accepted_actions):
        preconditions = action.get("preconditions", {})
        if not _preconditions_hold(staged, preconditions):
            return _rollback_result(
                reason_code="RUNTIME_PRECONDITION_INVALIDATED",
                events=events,
                deltas={},
            )
        try:
            _apply_action(staged, action)
        except Exception as exc:  # noqa: BLE001
            return _rollback_result(
                reason_code="EXECUTION_HANDLER_FAULT",
                events=events,
                deltas={},
                diagnostics={"error": str(exc), "action_index": idx},
            )
        events.append({"type": "action_applied", "action_id": action.get("action_id"), "plan_id": action.get("plan_id")})

    if context.get("simulate_rollback_fault"):
        return _rollback_result(
            reason_code="ROLLBACK_INTERNAL_FAULT",
            events=events,
            deltas={},
            diagnostics={"rollback_fault": True},
        )

    staged["round"] = int(staged.get("round", 0)) + 1
    deltas = _state_delta(base_state, staged)
    next_snapshot = str(context.get("next_snapshot_id", f"{context.get('canonical_snapshot_id')}:next"))
    backpressure = bool(context.get("runtime_backpressure"))
    dropped_frames = int(context.get("dropped_render_frames", 0)) if backpressure else 0
    return {
        "status": "ok",
        "transaction_status": "committed",
        "applied_actions": accepted_actions,
        "events": events,
        "state_deltas": deltas,
        "reason_code": None,
        "canonical_snapshot_id": next_snapshot,
        "projection_taxonomy": {
            "version": context.get("projection_taxonomy_version", "v1"),
            "entity_kinds": context.get("projection_entity_kinds", ["ship", "contact", "subsystem"]),
        },
        "runtime_placement": context.get("runtime_placement", "main-thread"),
        "backpressure_policy": "drop_render_frames" if backpressure else "none",
        "render_frames_dropped": max(dropped_frames, 0),
    }


def _preconditions_hold(state: dict[str, Any], preconditions: dict[str, Any]) -> bool:
    for key, expected in preconditions.items():
        if state.get(key) != expected:
            return False
    return True


def _apply_action(state: dict[str, Any], action: dict[str, Any]) -> None:
    family = action.get("family")
    params = action.get("params", {})
    if family == "set_value":
        state[params["key"]] = params["value"]
        return
    if family == "increment":
        key = params["key"]
        state[key] = int(state.get(key, 0)) + int(params.get("amount", 1))
        return
    if family == "consume_resource":
        key = params["key"]
        amount = int(params.get("amount", 0))
        current = int(state.get(key, 0))
        if current < amount:
            raise ValueError("INSUFFICIENT_RESOURCE")
        state[key] = current - amount
        return
    raise ValueError(f"UNKNOWN_ACTION_FAMILY:{family}")


def _state_delta(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    delta: dict[str, Any] = {}
    for key in sorted(set(before) | set(after)):
        if before.get(key) != after.get(key):
            delta[key] = {"before": before.get(key), "after": after.get(key)}
    return delta


def _gate_failure(reason_code: str) -> dict[str, Any]:
    return {
        "status": "error",
        "transaction_status": "rolled_back",
        "applied_actions": [],
        "events": [],
        "state_deltas": {},
        "reason_code": reason_code,
        "canonical_snapshot_id": None,
    }


def _rollback_result(
    reason_code: str, events: list[dict[str, Any]], deltas: dict[str, Any], diagnostics: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "status": "error",
        "transaction_status": "rolled_back",
        "applied_actions": [],
        "events": events,
        "state_deltas": deltas,
        "reason_code": reason_code,
        "canonical_snapshot_id": None,
        "diagnostics": diagnostics or {},
    }
