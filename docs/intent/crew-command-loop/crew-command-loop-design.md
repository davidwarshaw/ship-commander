---
parent: high-level-design
prefix: CREWCMD
---

# Crew Command Loop

## Context and Design Philosophy

This component owns one complete captain-command turn: interpreting the captain's natural-language order, producing structured crew plans, validating and arbitrating those plans, executing accepted action primitives in the simulation engine, and returning round outcomes as crew dialogue plus state views.

The design optimizes for three properties:
- **Simulation safety**: no world-state mutation bypasses simulation rules.
- **Explainability**: every accepted or rejected action can be traced to plan evidence and policy checks.
- **Replayability**: committed execution can be reproduced from persisted inputs and decisions.

## Runtime Platform

Iteration 1 executes the command loop in a browser-hosted React + TypeScript runtime:
- turn intake and orchestration run in client application logic
- shared turn/simulation UI state is coordinated through Zustand
- tactical rendering runs through Three.js adapters fed by post-turn projection state
- Vite provides module/runtime packaging for development and browser delivery

This segment remains simulation-authoritative even when hosted client-side: presentation is a consumer of turn outputs, not a source of truth.

## Turn Lifecycle

### 1) Command Intake

Input for each turn:
- captain message text
- current simulation snapshot identifier
- current ship status summary
- active mission context

A `turn_id` is created at intake and becomes the primary correlation key across plan generation, arbitration, execution, and response output.

Turn processing is **single-active-turn per command channel**. A new captain command received while a prior turn is unresolved is queued and receives `status=queued` until the active turn reaches `completed` or `failed`.

For browser iteration 1, a command channel maps to the active client gameplay session state scope. Single-active-turn invariants are enforced in the session store regardless of UI mode.
For multi-tab browser access to the same local session, a single-writer tab lock owns active-turn mutation rights; non-owner tabs are read-only observers for turn-state mutation paths.

Before a queued turn starts planning, the system checks **material context drift** between queued-at snapshot and current snapshot. If drift crosses configured thresholds (mission objective change, contact topology change, critical ship-state change), the queued turn requires captain reconfirmation before entering planning.

### 2) Crew Plan Generation

The LLM receives a role-scoped prompt package and emits one or more **crew plans**. A crew plan includes:
- `role` (e.g., helm, tactical, engineering, operations)
- `goal` (normalized intent statement)
- `actions[]` (ordered candidate action primitives with parameters)
- `contingencies[]` (branch conditions and alternatives)
- `confidence` (model-reported confidence)
- `rationale` (brief tactical explanation)

Plan-generation integration signals:
- `planning_clarification_needed` with machine-readable reasons
- `planning_operational_error` with reason code when applicable

If output fails schema validation, the system requests one model retry with explicit error guidance. On repeated failure, the turn transitions to clarification (captain-visible request for restatement).

Precedence for planning vs arbitration outcomes:
1. If `planning_operational_error=true`, the turn follows mode/channel policy to either fail operationally or route to captain clarification/retry.
2. If no arbitration-ready plans exist and `planning_clarification_needed=true`, the turn routes to `awaiting_clarification` without entering arbitration.
3. If arbitration executes, arbitration output remains authoritative for accepted/rejected action selection and final `clarification_needed` semantics.

Semantic field constraints are validated with schema checks:
- `confidence` must be numeric and in `[0.0, 1.0]`
- `actions[]` must be non-empty for non-clarification plans
- each action parameter must satisfy declared range/domain constraints

### 3) Plan Validation and Arbitration

Validation checks each candidate action against:
- action schema and parameter type validity
- role permissions (which role can propose which action families)
- simulation preconditions (energy, cooldowns, position, lock states, etc.)
- temporal constraints (action ordering feasibility)

Arbitration resolves conflicts across plans:
- resource contention (same finite subsystem/resource)
- mutually exclusive intents (e.g., stealth profile vs. high-emission scan)
- ordering conflicts (action A invalidates precondition for action B)

Resolution policy:
1. Keep plans that satisfy hard constraints.
2. Prefer higher mission-priority alignment.
3. Break remaining ties by configurable weighted score over confidence, operational risk, and mission-priority contribution.
4. If no safe set exists, return clarification rather than partial unsafe execution.

If a safe accepted set exists, execute it and explicitly report rejected actions and reason codes in the captain-facing response.

When action-level role-permission checks fail within a plan, the system performs **action-level rejection** (not whole-plan rejection) unless all actions in the plan are rejected; if all are rejected, the plan is marked rejected with reason code `PLAN_EMPTY_AFTER_VALIDATION`.

Outputs:
- `accepted_actions[]` (ordered execution list)
- `rejected_actions[]` with machine-readable reason codes
- `clarification_needed` boolean with prompts if true

Integration ownership:
- The plan-validator-arbiter segment is authoritative for arbitration reason-code taxonomy and `clarification_needed` derivation semantics.
- Crew-command-loop mirrors those invariants as integration contract requirements and does not redefine taxonomy semantics independently.
- Crew-command-loop is authoritative for canonical per-turn outcome classification consumed by response-composer when provided.

`clarification_needed` is derived invariantly:
- `true` iff `accepted_actions[]` is empty OR at least one unresolved ambiguity reason exists.
- `false` iff `accepted_actions[]` is non-empty and no unresolved ambiguity reason exists.

### 4) Simulation Execution

If `clarification_needed = false`, accepted actions execute as a single round transaction boundary:
- apply action primitives in resolved order
- advance simulation clock one round
- produce state deltas and event log entries

Execution-time feasibility guard:
- Before each action apply, re-check required dynamic preconditions.
- If a precondition fails at runtime, abort the transaction, roll back staged mutations, and return clarification with reason `RUNTIME_PRECONDITION_INVALIDATED`.

Execution is deterministic with respect to:
- starting snapshot
- accepted action list + parameters
- deterministic seed metadata for any stochastic subsystem

If required deterministic seed metadata is missing or invalid, execution does not start; the turn enters failed state with reason `DETERMINISM_METADATA_INVALID`, and no world-state mutation occurs.

### 5) Response Composition

Round outputs are converted into captain-facing results:
- concise command outcome summary
- crew response lines grounded in accepted/rejected actions
- explicit mention of rejected actions when relevant
- follow-up clarification questions when needed

The command log is canonical for narrative output. Tactical 3D wireframe view and ship-status view are projection layers sourced from the same post-round state.

Clarification re-entry path:
- A captain clarification response creates a **new** `turn_id` with `parent_turn_id` pointing to the unresolved turn.
- The unresolved turn transitions to `awaiting_clarification_resolved`.
- Hashing and observability are per turn instance, preserving one record per captain utterance.
- Clarification chains are capped at three re-entry turns per originating turn. If unresolved after the third re-entry, the active turn is marked `failed` with reason `CLARIFICATION_LIMIT_EXCEEDED`.

## Turn State Machine

States:
- `received`
- `planning`
- `validating`
- `arbitrating`
- `awaiting_clarification`
- `executing`
- `completed`
- `failed`
- `queued` (for later commands behind an active turn)

Transitions:
- `received -> planning -> validating -> arbitrating`
- `arbitrating -> awaiting_clarification` when clarification is needed
- `arbitrating -> executing` when accepted action set is safe and non-empty
- `executing -> completed` on successful committed transaction
- `executing -> failed` on execution fault after rollback
- any active state -> `failed` on non-recoverable contract/system error
- `queued -> received` when prior active turn completes/fails

Invariants:
- At most one active turn (`planning|validating|arbitrating|awaiting_clarification|executing`) per command channel.
- A turn in `completed` has an immutable `RoundExecutionRecord`.
- A turn in `awaiting_clarification` performs no state mutation.

## Data Contracts

| Contract | Producer | Consumer | Purpose |
|---|---|---|---|
| `CaptainTurnInput` | command intake | plan generation | Captures captain order and round context |
| `CrewPlan` | LLM plan generation | validator + arbiter | Structured, role-scoped intent and actions |
| `ArbitrationResult` | validator + arbiter | simulation + response composer | Defines accepted/rejected actions and clarification state |
| `RoundExecutionRecord` | simulation engine | response composer + replay tooling | Captures deterministic execution evidence |
| `CaptainTurnOutput` | response composer | UI/log renderer | Delivers final turn narrative and status payloads |

Additional contract rules:
- `ArbitrationResult` must include canonical references to source `plan_id` for every accepted/rejected action.
- `RoundExecutionRecord` includes `transaction_status` = `committed | rolled_back`.
- `CaptainTurnInput` snapshot id must match current canonical simulation snapshot at execution start; mismatch returns `SNAPSHOT_STALE` and routes to clarification.
- Execution-gate `SNAPSHOT_STALE` semantics are owned by simulation-engine-turn-execution and mirrored here as orchestration contract behavior.

## Crewed System Action Catalog

Crew-operated subsystems expose a shared crewed-system base contract:
- each subsystem can register one crew member in charge
- each subsystem declares action methods and action metadata (name + description)
- orchestration can enumerate subsystem action metadata without invoking actions
- each turn tick applies crewed-system settings to ship entity state before simulation increment systems run
- each subsystem can render assigned crew identity plus aliases as a printable string for diagnostics/debugging

Iteration 1 introduces:
- `CrewedSystem` base abstraction
- `HelmSystem` concrete subsystem with helm action methods and action metadata

## Error Handling and Recovery

- **Schema failure (plan output)**: one retry, then clarification request.
- **Validation failure (all actions invalid)**: no execution; return reasons + clarification.
- **Partial execution risk detected pre-run**: abort full execution and request clarification.
- **Simulation execution fault**: fail loud, preserve turn record, emit captain-visible operational failure notice.
- **Runtime precondition invalidation**: rollback and clarification (no partial commit).
- **Execution policy version mismatch**: fail before mutation with reason `EXECUTION_POLICY_VERSION_MISMATCH`.
- **Stale snapshot**: no execution; request clarification/reissue against current state.
- **Arbiter dependency unavailable**: mark turn failed with reason `ARBITER_DEPENDENCY_UNAVAILABLE` and emit captain-visible operational failure notice.
- **Trace persistence failure**: block captain-visible completion and mark turn failed (`TRACE_PERSISTENCE_FAILURE`) unless retry succeeds.
- **Rollback internal fault**: mark turn `failed` and emit captain-visible operational failure notice with rollback diagnostics reference.

Trace persistence retry policy:
- Retry trace persistence with bounded attempts before declaring failure.
- If all retries fail after a committed execution, the turn is marked `failed` with `TRACE_PERSISTENCE_FAILURE` and the captain receives explicit persistence-failure notice.

No silent degradation path is allowed for state mutation.

## Observability and Traceability

Each turn stores:
- `turn_id`, input payload hash, and snapshot id
- prompt package hash
- generated plans (including rejected alternatives)
- arbitration reasons and selected set
- accepted action list
- round deltas and emitted events
- response payload returned to player

This record supports replay, debugging, and evaluation of command interpretation quality.

Record persistence rules:
- The observability record is persisted atomically with turn completion state.
- If execution commits but trace write fails, completion is withheld until persistence succeeds or turn is marked failed.
- Replays run in isolated simulation contexts and do not mutate canonical campaign state.
- Replay of the same `turn_id` is idempotent with respect to canonical state.

## Configuration Surface

This component expects runtime-configurable policy values:
- arbitration weighted-score coefficients (`confidence_weight`, `risk_weight`, `priority_weight`)
- material-context-drift thresholds for queued-turn reconfirmation
- trace persistence retry bounds (attempt count and backoff strategy)

These values are configuration inputs and do not alter contract semantics defined in this LLD.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Turn reasoning shape | LLM emits structured crew plans before execution | Direct extraction of executable actions; freeform narrative with post-hoc extraction | Plan-first preserves contingencies and rationale for arbitration while keeping execution bounded by simulation constraints. |
| Conflict handling | Explicit arbitration phase before simulation | First-valid-plan wins; independent per-role execution then merge | Pre-execution arbitration prevents contradictory action bundles and avoids invalid partial world transitions. |
| Validation strictness | Hard-fail invalid action sets into clarification | Best-effort execution of valid subset with silent drops | Clarification preserves captain trust and keeps command outcomes explainable when intent is ambiguous or unsafe. |
| Determinism boundary | Deterministic simulation execution with potentially variable planning/dialogue | Fully deterministic end-to-end including fixed plan text; fully emergent state mutation | Matches project tenet: tactical conversation can vary, but committed state transitions must be replayable. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Arbitration happens before simulation execution, not during.
2. ✅ Clarification is preferred to unsafe or contradictory execution.

### Deferred
1. Crew role taxonomy and permission matrix granularity.
2. Confidence calibration strategy (raw model value vs. normalized score).
3. Mission-priority policy source (static config vs. dynamic mission director).

## References

- `docs/high-level-design.md`
