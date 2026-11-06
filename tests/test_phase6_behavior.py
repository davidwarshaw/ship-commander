import unittest

from src.crew_command_loop import process_turn
from src.llm_plan_generator import generate_crew_plans
from src.plan_validator_arbiter import validate_and_arbitrate
from src.presentation_layer import render_turn_view
from src.response_composer import compose_turn_response
from src.simulation_engine_turn_execution import execute_round


class TestPhase6Behavior(unittest.TestCase):
    # @spec LLMGEN-PROMPT-004, LLMGEN-VAL-002, LLMGEN-VAL-003, LLMGEN-ERR-004
    def test_llm_generator_retries_then_clarifies(self) -> None:
        turn_input = {
            "captain_message": "Engage target lock",
            "snapshot_id": "snap-1",
            "mission_context": {"objective": "defend"},
            "ship_status_summary": {"hull": 100},
            "generation_policy": {"max_attempts": 1},
            "candidate_plans_attempts": [
                [{"plan_id": "P1", "role": "tactical", "goal": "lock", "actions": [], "contingencies": [], "confidence": 0.7, "rationale": "x"}],
                [{"plan_id": "P2", "role": "tactical", "goal": "lock", "actions": [{"action_id": "A1", "family": "target_lock", "params": {}}], "contingencies": [], "confidence": 0.8, "rationale": "x"}],
            ],
        }
        result = generate_crew_plans(turn_input)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["metadata"]["attempt_count"], 2)
        self.assertTrue(result["metadata"]["prompt_hash"])

        failure = generate_crew_plans(
            {
                **turn_input,
                "candidate_plans_attempts": [
                    [{"plan_id": "PX", "role": "tactical", "goal": "lock", "actions": [], "contingencies": [], "confidence": 0.7, "rationale": "x"}]
                ],
            }
        )
        self.assertEqual(failure["status"], "clarification_required")
        self.assertTrue(failure["planning_clarification_needed"])

        connectivity_failure = generate_crew_plans(
            {
                **turn_input,
                "simulate_connectivity_failure": True,
                "simulate_clarification_signal": True,
            }
        )
        self.assertEqual(connectivity_failure["status"], "error")
        self.assertTrue(connectivity_failure["planning_operational_error"])
        self.assertTrue(connectivity_failure["planning_clarification_needed"])
        self.assertEqual(connectivity_failure["planning_error_reason"], "MODEL_SERVICE_UNREACHABLE")

    # @spec PLANARB-PERM-002, PLANARB-ARB-005, PLANARB-ERR-003, PLANARB-OBS-004, PLANARB-OBS-005
    def test_arbiter_permission_and_dependency_failure(self) -> None:
        plans = [
            {
                "plan_id": "P1",
                "role": "helm",
                "goal": "maneuver",
                "actions": [{"action_id": "A1", "family": "fire_weapon", "params": {}}],
                "contingencies": [],
                "confidence": 0.9,
                "rationale": "x",
            }
        ]
        context = {"role_permissions": {"helm": ["set_course"]}, "action_schemas": {}}
        result = validate_and_arbitrate(plans, context)
        self.assertTrue(result["clarification_needed"])
        self.assertEqual(result["accepted_actions"], [])
        self.assertEqual(result["rejected_actions"][0]["reason_code"], "ROLE_PERMISSION_DENIED")

        dep_down = validate_and_arbitrate(plans, {**context, "simulate_dependency_unavailable": True})
        self.assertTrue(dep_down["operational_error"])
        self.assertEqual(dep_down["operational_error_reason"], "ARBITER_DEPENDENCY_UNAVAILABLE")

        unordered = validate_and_arbitrate(
            plans,
            {
                **context,
                "cross_runtime_split": True,
                "ordered_messaging": False,
            },
        )
        self.assertTrue(unordered["operational_error"])
        self.assertEqual(unordered["operational_error_reason"], "UNORDERED_CROSS_RUNTIME_MESSAGING")

    # @spec SIMEXEC-GATE-001, SIMEXEC-TX-003, SIMEXEC-COMMIT-003, SIMEXEC-DET-003
    def test_simexec_gate_runtime_rollback_and_commit(self) -> None:
        actions = [{"plan_id": "P1", "action_id": "A1", "family": "increment", "params": {"key": "energy", "amount": 1}}]
        stale = execute_round(
            actions,
            {
                "turn_snapshot_id": "s1",
                "canonical_snapshot_id": "s2",
                "accepted_policy_version": "v1",
                "execution_policy_version": "v1",
                "state": {"energy": 0},
            },
        )
        self.assertEqual(stale["reason_code"], "SNAPSHOT_STALE")

        invalidated = execute_round(
            [{"plan_id": "P1", "action_id": "A1", "family": "increment", "params": {"key": "energy", "amount": 1}, "preconditions": {"mode": "combat"}}],
            {
                "turn_snapshot_id": "s1",
                "canonical_snapshot_id": "s1",
                "accepted_policy_version": "v1",
                "execution_policy_version": "v1",
                "state": {"mode": "travel", "energy": 0},
            },
        )
        self.assertEqual(invalidated["reason_code"], "RUNTIME_PRECONDITION_INVALIDATED")

        committed = execute_round(
            actions,
            {
                "turn_snapshot_id": "s1",
                "canonical_snapshot_id": "s1",
                "accepted_policy_version": "v1",
                "execution_policy_version": "v1",
                "state": {"energy": 0, "round": 0},
                "next_snapshot_id": "s2",
            },
        )
        self.assertEqual(committed["transaction_status"], "committed")
        self.assertEqual(committed["canonical_snapshot_id"], "s2")
        self.assertEqual(committed["backpressure_policy"], "none")

        pressured = execute_round(
            actions,
            {
                "turn_snapshot_id": "s1",
                "canonical_snapshot_id": "s1",
                "accepted_policy_version": "v1",
                "execution_policy_version": "v1",
                "state": {"energy": 0, "round": 0},
                "runtime_backpressure": True,
                "dropped_render_frames": 3,
                "runtime_placement": "worker",
            },
        )
        self.assertEqual(pressured["backpressure_policy"], "drop_render_frames")
        self.assertEqual(pressured["render_frames_dropped"], 3)
        self.assertEqual(pressured["runtime_placement"], "worker")

    # @spec RESPCOMP-CLASS-003, RESPCOMP-ERR-004, RESPCOMP-EVID-004
    def test_response_composer_outcome_precedence_and_reason_fallback(self) -> None:
        payload = compose_turn_response(
            {
                "turn_id": "t1",
                "captain_message": "scan sector",
                "canonical_outcome_classification": "operational_failure",
                "arbitration_result": {
                    "accepted_actions": [],
                    "rejected_actions": [{"plan_id": "P1", "action_id": "A1", "reason_code": "UNKNOWN_REASON"}],
                    "tie_break_rationale": {"visibility_eligible": True},
                },
                "response_policy": {"tie_break_visibility": True},
            }
        )
        self.assertEqual(payload["outcome_classification"], "operational_failure")
        self.assertIn("(UNKNOWN_REASON)", payload["rejected_action_explanations"][0]["message"])
        self.assertTrue(any(line["reason_code"] == "TIE_BREAK_RATIONALE" for line in payload["rejected_action_explanations"]))

    # @spec PRESENT-BIND-004, PRESENT-BIND-006, PRESENT-SNAP-002, PRESENT-ERR-004
    def test_presentation_strict_keys_stale_warning_and_notice_priority(self) -> None:
        bad = render_turn_view({"outcome_summary": "x"}, {})
        self.assertEqual(bad["status"], "ok")
        self.assertIn("crew_lines", bad["input_contract_violations"])

        output = {
            "outcome_summary": "done",
            "crew_lines": [],
            "rejected_action_explanations": [],
            "clarification_prompts": [],
            "operational_notices": [{"failure_class": "X"}],
        }
        view = render_turn_view(
            output,
            {
                "turn_snapshot_id": "s2",
                "projection_snapshot_id": "s1",
                "tactical_entities": [{"id": "e1"}],
                "status_panels": [],
                "highlight_entity_ids": ["e1"],
                "mode_policy": {"operational_notice_priority": "pin_top"},
            },
        )
        self.assertTrue(view["stale_projection"])
        self.assertEqual(view["tactical_view"]["highlights"], [])
        self.assertEqual(view["command_log"][0]["section"], "operational_notices")
        self.assertEqual(view["normalized_presentation_state"]["command_log_entries"], 5)

    # @spec CREWCMD-CORE-007, CREWCMD-PLAN-008, CREWCMD-ARB-011, CREWCMD-OBS-009
    def test_crew_command_loop_routes_clarification_and_failures(self) -> None:
        clarification = process_turn(
            {
                "captain_message": "do something unclear",
                "snapshot_id": "s1",
                "mission_context": {},
                "ship_status_summary": {},
                "candidate_plans_attempts": [[]],
            }
        )
        self.assertEqual(clarification["status"], "awaiting_clarification")
        self.assertTrue(clarification["observability"]["prompt_hash"])

        failed = process_turn(
            {
                "captain_message": "attack",
                "snapshot_id": "s1",
                "mission_context": {},
                "ship_status_summary": {},
                "candidate_plans_attempts": [
                    [{
                        "plan_id": "P1",
                        "role": "tactical",
                        "goal": "attack",
                        "actions": [{"action_id": "A1", "family": "fire_weapon", "params": {}}],
                        "contingencies": [],
                        "confidence": 0.8,
                        "rationale": "x",
                    }]
                ],
                "arbitration_context": {
                    "role_permissions": {"tactical": ["fire_weapon"]},
                    "simulate_dependency_unavailable": True,
                },
            }
        )
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["outcome_classification"], "operational_failure")

        readonly = process_turn(
            {
                "captain_message": "attack",
                "snapshot_id": "s1",
                "mission_context": {},
                "ship_status_summary": {},
                "session_lock": {"is_lock_owner": False, "lock_owner_tab_id": "tab-1"},
            }
        )
        self.assertEqual(readonly["status"], "read_only")
        self.assertTrue(readonly["observability"]["read_only"])


if __name__ == "__main__":
    unittest.main()
