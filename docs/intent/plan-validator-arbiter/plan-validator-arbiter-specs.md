# Plan Validator + Arbiter Specs

## Input and Contract Validation

- [ ] **PLANARB-VAL-001**: When the arbiter receives a turn's candidate plans, the system shall validate each plan for required fields `plan_id`, `role`, `goal`, `actions[]`, `contingencies[]`, `confidence`, and `rationale`.
- [ ] **PLANARB-VAL-002**: If a candidate plan is not a clarification-only plan and `actions[]` is empty, then the system shall reject that plan with reason code `PLAN_EMPTY_ACTIONS`.
- [ ] **PLANARB-VAL-003**: Where a candidate plan includes `confidence`, the system shall reject the plan if `confidence` is not numeric or is outside inclusive range `[0.0, 1.0]`.
- [ ] **PLANARB-VAL-004**: Where a candidate action parameter violates declared type, range, or domain constraints, the system shall reject that action and keep evaluating remaining actions in the same plan.
- [ ] **PLANARB-VAL-005**: If all actions in a candidate plan are rejected during validation, then the system shall mark the plan rejected with reason code `PLAN_EMPTY_AFTER_VALIDATION`.

## Permission and Feasibility Validation

- [ ] **PLANARB-PERM-001**: When evaluating a candidate action, the system shall validate the action against the role-permission matrix for the proposing role.
- [ ] **PLANARB-PERM-002**: If a role-permission check fails for a candidate action, then the system shall reject that action with reason code `ROLE_PERMISSION_DENIED`.
- [ ] **PLANARB-FEAS-001**: When evaluating a candidate action, the system shall validate snapshot-scoped feasibility constraints including resource availability, cooldown/lock constraints, and positional or target constraints.
- [ ] **PLANARB-FEAS-002**: If a candidate action violates temporal ordering feasibility with other candidate actions in the same turn, then the system shall reject that action with reason code `TEMPORAL_ORDER_CONFLICT`.

## Conflict Resolution and Selection

- [ ] **PLANARB-ARB-001**: When validated actions remain, the system shall construct conflict sets for resource contention, intent exclusivity, and ordering invalidation before selecting an accepted action set.
- [ ] **PLANARB-ARB-002**: The system shall exclude any candidate action combination that violates hard safety constraints from the selectable set.
- [ ] **PLANARB-ARB-003**: Where more than one safe candidate set remains, the system shall score each set using configurable weighted policy inputs for mission-priority contribution, operational risk, and confidence.
- [ ] **PLANARB-ARB-004**: When weighted scores are equal for multiple safe candidate sets, the system shall resolve the tie deterministically by mission-priority contribution, then lower operational risk, then higher confidence, then lexical order by `plan_id` and `action_id`.
- [ ] **PLANARB-ARB-005**: If no safe non-contradictory candidate set exists, then the system shall emit no accepted actions and set `clarification_needed=true`.

## Clarification and Ambiguity Handling

- [ ] **PLANARB-CLAR-001**: The system shall set `clarification_needed` to true if and only if `accepted_actions[]` is empty or unresolved ambiguities remain.
- [ ] **PLANARB-CLAR-002**: The system shall set `clarification_needed` to false if and only if `accepted_actions[]` is non-empty and unresolved ambiguities do not remain.
- [ ] **PLANARB-CLAR-003**: When `clarification_needed=true`, the system shall include machine-readable reason codes for all rejected actions in the arbitration output payload.
- [ ] **PLANARB-CLAR-004**: When `clarification_needed=true`, the system shall include clarification prompts keyed to unresolved ambiguity reasons.
- [ ] **PLANARB-CLAR-005**: The system shall be the authoritative source for arbitration reason-code taxonomy and `clarification_needed` derivation semantics consumed by integrating components.

## Traceability, Determinism, and Failure Behavior

- [ ] **PLANARB-OBS-001**: When arbitration completes, the system shall include canonical source `plan_id` and `action_id` references for every accepted action and every rejected action.
- [ ] **PLANARB-OBS-002**: For identical validated inputs and policy configuration, the system shall produce an identical accepted action set and identical rejection set ordering.
- [ ] **PLANARB-OBS-003**: Where deterministic tie-break ordering materially determines the selected safe action set, the system shall emit tie-break rationale metadata sufficient for captain-visible explanation.
- [ ] **PLANARB-OBS-004**: The system shall publish arbitration outputs to client orchestration state without directly mutating simulation canonical state.
- [ ] **PLANARB-OBS-005**: Where arbitration and execution run in different client runtime locations, the system shall deliver arbitration outputs through deterministic ordered messaging before execution consumption.
- [ ] **PLANARB-ERR-001**: If arbiter input contract validation fails at turn scope, then the system shall return no accepted actions and emit an explicit contract error reason.
- [ ] **PLANARB-ERR-002**: If required arbitration configuration is missing or invalid, then the system shall return no accepted actions and emit an explicit configuration error reason.
- [ ] **PLANARB-ERR-003**: If simulation-query adapters required for feasibility checks are unavailable, then the system shall return no accepted actions, set `operational_error=true`, and emit reason `ARBITER_DEPENDENCY_UNAVAILABLE`.
