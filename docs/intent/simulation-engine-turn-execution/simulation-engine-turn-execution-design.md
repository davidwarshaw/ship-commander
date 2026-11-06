---
parent: high-level-design
prefix: SIMEXEC
---

# Simulation Engine Turn Execution

## Context and Design Philosophy

This component executes accepted action primitives as a single turn-round transaction and advances authoritative world state. It is the sole mutator of canonical simulation state for command turns.

Design priorities:
- **Deterministic state transition**: identical inputs produce identical state deltas.
- **Transactional safety**: no partial commit when execution faults occur.
- **Auditability**: every commit/rollback is reconstructable from execution records.

## Runtime Platform

Iteration 1 executes in browser runtime with fixed-step simulation progression decoupled from render frame updates. This segment may run on the main thread or a dedicated worker, but deterministic tick semantics are invariant across placement.
Under browser resource pressure, fixed-step tick determinism is prioritized and render frames may be dropped before simulation tick semantics are altered.

## Scope and Boundaries

In scope:
- execution of ordered accepted actions from arbitration
- runtime precondition re-check before each action apply
- transaction commit/rollback behavior for round execution
- round clock advancement and state-delta/event emission
- `RoundExecutionRecord` creation for committed/rolled-back outcomes

Out of scope:
- plan generation and arbitration policy decisions
- captain-facing language generation
- UI projection rendering

## Inputs and Outputs

### Inputs

- canonical starting snapshot id
- ordered `accepted_actions[]` with parameters and source references
- deterministic seed metadata for stochastic subsystems
- execution policy config (round duration, subsystem toggles)

### Outputs

- `RoundExecutionRecord` containing:
  - `transaction_status` (`committed` or `rolled_back`)
  - applied action sequence (or rollback point)
  - emitted event log entries
  - state deltas
  - execution fault or invalidation reason, when present
- post-round canonical snapshot id on commit
- projection entity taxonomy/version metadata required for cross-mode focus-anchor mappings in presentation

## Execution Pipeline

### Stage 1: Execution Gate Validation

Before mutation starts:
- verify `CaptainTurnInput.snapshot_id` matches current canonical snapshot
- verify deterministic seed metadata is present/valid for required stochastic paths
- verify accepted action list is non-empty and execution-eligible

Gate failures produce no mutation and return explicit reason (`SNAPSHOT_STALE`, `DETERMINISM_METADATA_INVALID`, or contract error).

Integration ownership:
- This component is authoritative for execution-gate emission semantics of `SNAPSHOT_STALE`.
- Crew-command-loop mirrors these semantics as integration contract requirements.

### Stage 2: Transaction Start and Ordered Apply

The engine opens a round transaction boundary and applies accepted actions in arbitration order.

Before each action apply:
- re-check dynamic runtime preconditions against current staged state
- if precondition fails, abort execution and roll back transaction with reason `RUNTIME_PRECONDITION_INVALIDATED`

Action apply rules:
- action handlers are side-effect confined to the transaction context until commit
- deterministic seed streams are consumed in stable order per action subsystem

### Stage 3: Round Finalization

If all action applies succeed:
- advance simulation clock by one round
- finalize derived subsystem updates
- emit state deltas and event log entries
- commit transaction and publish new canonical snapshot

If any non-recoverable execution fault occurs:
- roll back all staged mutations
- preserve fault diagnostics
- return `transaction_status=rolled_back`

## Determinism Contract

Execution is deterministic for a given:
- starting canonical snapshot
- ordered accepted action list and parameters
- deterministic seed metadata
- execution policy configuration version

Nondeterministic operations (for example map iteration order or wall-clock reads) are prohibited inside action-apply and delta-emit paths for committed turns.

## Error Handling and Recovery

- `SNAPSHOT_STALE`: reject execution at gate; no mutation
- `DETERMINISM_METADATA_INVALID`: reject execution at gate; no mutation
- `RUNTIME_PRECONDITION_INVALIDATED`: rollback and return clarification-path signal upstream
- execution handler fault: rollback and return operational failure upstream
- persistence handoff failure after commit signaling: surface to orchestration as trace/persistence failure path
- execution policy version mismatch at gate: reject execution before mutation with reason `EXECUTION_POLICY_VERSION_MISMATCH`
- rollback internal fault: surface explicit rollback-failure diagnostics and require upstream turn failure handling

No silent downgrade to partial commit is allowed.

## Data and State Invariants

- Canonical state mutates only at successful transaction commit.
- Rolled-back turns do not advance simulation clock.
- Every execution attempt emits exactly one `RoundExecutionRecord`.
- A committed record is immutable and replayable.
- Replay runs are isolated from canonical campaign state.

## Configuration Surface

Runtime configuration includes:
- execution policy version id
- round duration/step parameters
- subsystem execution toggles
- deterministic seed schema version
- runtime precondition strictness profile
- client-runtime placement policy (main-thread vs worker-hosted execution)

Configuration may change outcomes but does not change execution contract shape.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Transaction model | Single round transaction with all-or-nothing commit | Per-action partial commits; compensating-action model | All-or-nothing commit preserves replay integrity and prevents inconsistent intermediate canonical states. |
| Runtime guards | Re-check preconditions before each action apply | Validate once before round then trust | Mid-round rechecks catch invalidations introduced by earlier actions and avoid unsafe continuation. |
| Determinism boundary | Deterministic execution, variable planning upstream | Deterministic planning + execution; fully emergent execution | Matches HLD tenet that committed state transitions must be replayable while language behavior may vary. |
| Fault response | Rollback on any non-recoverable execution fault | Best-effort continue with failed-action markers | Rollback avoids ambiguous partially-mutated world states and simplifies correctness guarantees. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Command-turn execution uses a single transaction boundary per round.
2. ✅ Runtime precondition invalidation triggers rollback, not partial continuation.

### Deferred
1. Granularity of fault diagnostics exposed to captain vs internal logs.
2. Performance strategy for high action-count rounds under strict determinism.
3. Subsystem-specific deterministic seed partitioning strategy.

## References

- `docs/high-level-design.md`
- `docs/intent/crew-command-loop/crew-command-loop-design.md`
