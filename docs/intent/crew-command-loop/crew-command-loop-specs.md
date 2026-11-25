# Crew Command Loop Specs

## Turn Intake and Concurrency

- [ ] **CREWCMD-CORE-001**: When the crew-command-loop receives a captain command, the system shall create a unique `turn_id` and persist it as the correlation key for that turn's planning, arbitration, execution, and response records.
- [ ] **CREWCMD-CORE-002**: While one turn is in an active processing state (`planning`, `validating`, `arbitrating`, `awaiting_clarification`, or `executing`) for a command channel, the system shall not start a second active turn for that same command channel.
- [ ] **CREWCMD-CORE-003**: When a captain command arrives for a command channel with an already active turn, the system shall enqueue the new command with turn state `queued`.
- [ ] **CREWCMD-CORE-004**: When the previously active turn for a command channel reaches `completed` or `failed`, the system shall transition the next queued turn for that channel from `queued` to `received`.
- [ ] **CREWCMD-CORE-005**: Before a queued turn transitions into planning, the system shall evaluate material context drift between queued snapshot context and current simulation context, and if configured drift thresholds are exceeded then the system shall request captain reconfirmation before planning that queued turn.
- [ ] **CREWCMD-CORE-006**: For browser iteration-1 runtime, the system shall map command-channel single-active-turn invariants to the active client gameplay session-state scope independent of presentation mode.
- [ ] **CREWCMD-CORE-007**: Where multiple browser tabs attach to the same local session scope, the system shall enforce single-writer tab lock semantics for turn-state mutations and expose non-owner tabs as read-only for active-turn control.

## Plan Generation and Validation

- [ ] **CREWCMD-PLAN-001**: When generating crew plans for a captain command, the system shall require each generated plan to include `role`, `goal`, `actions[]`, `contingencies[]`, `confidence`, and `rationale`.
- [ ] **CREWCMD-PLAN-002**: If generated crew plans fail schema or semantic validation on the first attempt, then the system shall perform one LLM regeneration attempt with explicit validation-error guidance.
- [ ] **CREWCMD-PLAN-003**: If generated crew plans fail schema or semantic validation after the regeneration attempt, then the system shall transition the turn to `awaiting_clarification` and produce a captain-visible clarification request.
- [ ] **CREWCMD-PLAN-004**: Where a generated crew plan is not a clarification-only plan, the system shall reject the plan if `actions[]` is empty.
- [ ] **CREWCMD-PLAN-005**: Where a generated crew plan includes `confidence`, the system shall reject the plan if `confidence` is not numeric or is outside the inclusive range `[0.0, 1.0]`.
- [ ] **CREWCMD-PLAN-006**: Where a generated crew plan includes action parameters, the system shall reject any action whose parameters violate declared type, range, or domain constraints.
- [ ] **CREWCMD-PLAN-007**: Where planning returns `planning_operational_error=true`, the system shall apply mode/channel policy that either transitions the turn to `failed` or routes to captain clarification/retry.
- [ ] **CREWCMD-PLAN-008**: Where planning returns `planning_clarification_needed=true` and no arbitration-ready plans, the system shall transition the turn to `awaiting_clarification` without entering arbitration.

## Crewed System Action Catalog

- [ ] **CREWCMD-SYS-001**: The system shall provide a `CrewedSystem` base abstraction that supports registering a crew member in charge of that subsystem.
- [ ] **CREWCMD-SYS-002**: Subclasses of `CrewedSystem` shall declare action methods and action metadata containing action name and description.
- [ ] **CREWCMD-SYS-003**: The `CrewedSystem` base abstraction shall expose a listing API that returns action names and descriptions for the subsystem.
- [ ] **CREWCMD-SYS-004**: The system shall provide a `HelmSystem` subclass as an initial concrete crewed subsystem implementation.
- [ ] **CREWCMD-SYS-005**: On each turn tick, crewed systems shall update the ship entity from system settings before simulation increment systems execute.
- [ ] **CREWCMD-SYS-006**: The `CrewedSystem` base abstraction shall expose a formatter method that returns assigned crew member identity and aliases (`dialogHandles`) in one printable string.

## Arbitration and Clarification

- [ ] **CREWCMD-ARB-001**: When validating and arbitrating crew plans, the system shall evaluate each candidate action for action-schema validity, role-permission validity, simulation preconditions, and temporal-order feasibility.
- [ ] **CREWCMD-ARB-002**: Where role-permission checks fail for some actions within a generated plan, the system shall reject only the invalid actions and retain remaining valid actions from that plan.
- [ ] **CREWCMD-ARB-003**: If all actions from a generated plan are rejected during validation, then the system shall mark that plan rejected with reason code `PLAN_EMPTY_AFTER_VALIDATION`.
- [ ] **CREWCMD-ARB-004**: When no safe non-contradictory accepted action set exists after arbitration, the system shall produce no executable action list and shall transition the turn to `awaiting_clarification`.
- [ ] **CREWCMD-ARB-005**: When arbitration outputs accepted and rejected actions, the system shall include canonical source `plan_id` references for every accepted action and every rejected action.
- [ ] **CREWCMD-ARB-006**: The system shall set `clarification_needed` to true if and only if `accepted_actions[]` is empty or unresolved ambiguity reasons remain after arbitration.
- [ ] **CREWCMD-ARB-007**: The system shall set `clarification_needed` to false if and only if `accepted_actions[]` is non-empty and unresolved ambiguity reasons do not remain after arbitration.
- [ ] **CREWCMD-ARB-008**: When clarification is required for a turn, the system shall include machine-readable reason codes for rejected actions in the clarification payload.
- [ ] **CREWCMD-ARB-009**: Where arbitration requires tie-breaking after hard-constraint filtering, the system shall select actions using a configurable weighted score over confidence, operational risk, and mission-priority contribution.
- [ ] **CREWCMD-ARB-010**: When a safe accepted action set exists and one or more actions are rejected, the system shall execute the safe accepted set and shall report rejected actions with reason codes in the captain-facing response.
- [ ] **CREWCMD-ARB-011**: Where arbitration reports `operational_error=true` with reason `ARBITER_DEPENDENCY_UNAVAILABLE`, the system shall transition the turn to `failed` and emit a captain-visible operational failure notice.
- [ ] **CREWCMD-ARB-012**: Where arbitration metadata indicates deterministic tie-break logic materially determined the selected safe action set, the system shall include a captain-visible explanation of the deciding tie-break factors in the turn response.

## Execution and Determinism

- [ ] **CREWCMD-EXEC-001**: When `clarification_needed` is false and execution begins, the system shall execute accepted actions within a single round transaction boundary.
- [ ] **CREWCMD-EXEC-002**: Before each action application within round execution, the system shall re-check that runtime dynamic preconditions remain valid.
- [ ] **CREWCMD-EXEC-003**: If a runtime dynamic precondition check fails during round execution, then the system shall roll back staged mutations, mark the round as not committed, and transition the turn to `awaiting_clarification` with reason `RUNTIME_PRECONDITION_INVALIDATED`.
- [ ] **CREWCMD-EXEC-004**: Where deterministic seed metadata is required for a stochastic subsystem in a turn, the system shall block execution if the metadata is missing or invalid, emit reason `DETERMINISM_METADATA_INVALID`, and apply no world-state mutation.
- [ ] **CREWCMD-EXEC-005**: When execution starts, the system shall verify that the turn's `CaptainTurnInput` snapshot id matches the canonical simulation snapshot, and if it does not match then the system shall emit reason `SNAPSHOT_STALE` and apply no world-state mutation.
- [ ] **CREWCMD-EXEC-006**: If a non-recoverable simulation execution fault occurs during round execution, then the system shall roll back staged mutations, mark turn state `failed`, and emit a captain-visible operational failure notice.
- [ ] **CREWCMD-EXEC-007**: Where execution emits reason `EXECUTION_POLICY_VERSION_MISMATCH` at gate, the system shall apply no world-state mutation, mark turn state `failed`, and emit a captain-visible operational failure notice.
- [ ] **CREWCMD-EXEC-008**: Where simulation execution reports rollback internal fault diagnostics, the system shall mark turn state `failed` and include rollback-failure diagnostics reference in operational failure reporting.

## Clarification Re-entry

- [ ] **CREWCMD-CLAR-001**: When a captain provides a clarification response for a turn in `awaiting_clarification`, the system shall create a new turn with a new `turn_id` and with `parent_turn_id` referencing the unresolved turn.
- [ ] **CREWCMD-CLAR-002**: When a clarification response is accepted and linked to its unresolved turn, the system shall transition the unresolved turn to `awaiting_clarification_resolved`.
- [ ] **CREWCMD-CLAR-003**: If three clarification re-entry turns for the same originating unresolved turn fail to produce an executable safe action set, then the system shall mark the active clarification turn `failed` with reason `CLARIFICATION_LIMIT_EXCEEDED`.

## Observability and Replay

- [ ] **CREWCMD-OBS-001**: For each processed turn instance, the system shall persist an observability record containing `turn_id`, input payload hash, snapshot id, generated plans, arbitration decisions, accepted actions, round deltas/events, and captain-facing response payload.
- [ ] **CREWCMD-OBS-002**: When a turn reaches `completed`, the system shall persist an immutable `RoundExecutionRecord` with `transaction_status=committed`.
- [ ] **CREWCMD-OBS-003**: When execution aborts before commit, the system shall persist a `RoundExecutionRecord` with `transaction_status=rolled_back`.
- [ ] **CREWCMD-OBS-004**: The system shall persist observability records atomically with turn completion-state updates.
- [ ] **CREWCMD-OBS-005**: If observability record persistence fails after execution attempt, then the system shall withhold captain-visible completion and either retry persistence or mark turn state `failed` with reason `TRACE_PERSISTENCE_FAILURE`.
- [ ] **CREWCMD-OBS-006**: Where replay tooling executes a turn record, the system shall run replay in an isolated simulation context that does not mutate canonical campaign state.
- [ ] **CREWCMD-OBS-007**: When replay tooling replays the same `turn_id` record multiple times, the system shall preserve canonical campaign state idempotence across all replay runs.
- [ ] **CREWCMD-OBS-008**: Where observability record persistence fails after committed execution, the system shall perform bounded retry attempts before marking turn state `failed` with reason `TRACE_PERSISTENCE_FAILURE` and emitting a captain-visible persistence-failure notice.
- [ ] **CREWCMD-OBS-009**: For each processed turn instance, the observability record shall include the plan generator prompt package hash.
- [ ] **CREWCMD-OBS-010**: For each processed turn instance, the system shall emit canonical turn outcome classification for response composition consumers.
