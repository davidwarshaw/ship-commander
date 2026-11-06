# Simulation Engine Turn Execution Specs

## Execution Gate Validation

- [ ] **SIMEXEC-GATE-001**: When round execution is requested, the system shall verify that the turn input snapshot id matches the current canonical simulation snapshot id before any mutation begins.
- [ ] **SIMEXEC-GATE-002**: If snapshot ids do not match at execution gate, then the system shall emit reason `SNAPSHOT_STALE` and apply no world-state mutation.
- [ ] **SIMEXEC-GATE-003**: Where stochastic subsystems are required by accepted actions, the system shall verify deterministic seed metadata is present and valid before execution starts.
- [ ] **SIMEXEC-GATE-004**: If deterministic seed metadata is missing or invalid at execution gate, then the system shall emit reason `DETERMINISM_METADATA_INVALID` and apply no world-state mutation.
- [ ] **SIMEXEC-GATE-005**: If accepted action list is empty or contract-invalid at execution gate, then the system shall reject execution and emit an explicit contract error reason.
- [ ] **SIMEXEC-GATE-006**: If execution policy version at execution gate does not match the version assumed for the accepted action contract, then the system shall emit reason `EXECUTION_POLICY_VERSION_MISMATCH` and apply no world-state mutation.

## Transactional Action Execution

- [ ] **SIMEXEC-TX-001**: When execution gate checks pass, the system shall execute accepted actions within a single round transaction boundary.
- [ ] **SIMEXEC-TX-002**: Before each action application, the system shall re-check runtime dynamic preconditions against the current staged transaction state.
- [ ] **SIMEXEC-TX-003**: If a runtime dynamic precondition check fails during action execution, then the system shall roll back staged mutations, emit reason `RUNTIME_PRECONDITION_INVALIDATED`, and set `transaction_status=rolled_back`.
- [ ] **SIMEXEC-TX-004**: The system shall apply accepted actions in arbitration-resolved order.
- [ ] **SIMEXEC-TX-005**: Action handlers shall confine side effects to transaction-scoped staged state until transaction commit.

## Round Finalization and Commit

- [ ] **SIMEXEC-COMMIT-001**: If all accepted actions are applied successfully, the system shall advance simulation clock by one round before commit.
- [ ] **SIMEXEC-COMMIT-002**: If all accepted actions are applied successfully, the system shall emit state deltas and event log entries derived from post-round staged state and then commit transaction mutations.
- [ ] **SIMEXEC-COMMIT-003**: When transaction commit succeeds, the system shall publish a new canonical snapshot id for the post-round state.
- [ ] **SIMEXEC-COMMIT-004**: If a non-recoverable execution fault occurs before commit completion, the system shall roll back staged mutations and set `transaction_status=rolled_back`.

## Determinism and Invariants

- [ ] **SIMEXEC-DET-001**: For identical starting canonical snapshot, accepted action order/parameters, deterministic seed metadata, and execution policy version, the system shall produce identical committed state deltas and event ordering.
- [ ] **SIMEXEC-DET-002**: The system shall not use wall-clock reads or nondeterministic iteration order within action-apply or delta-emission paths for committed turns.
- [ ] **SIMEXEC-DET-003**: Fixed-step simulation progression shall remain deterministic and semantically invariant regardless of client runtime placement on main thread or worker.
- [ ] **SIMEXEC-DET-004**: Under client runtime backpressure, the system shall preserve fixed-step simulation semantics and may drop render frames before altering deterministic tick progression rules.
- [ ] **SIMEXEC-INV-001**: Canonical simulation state shall mutate only upon successful transaction commit.
- [ ] **SIMEXEC-INV-002**: A rolled-back execution attempt shall not advance simulation clock.
- [ ] **SIMEXEC-INV-003**: Each execution attempt shall emit exactly one `RoundExecutionRecord`.

## Observability and Replay

- [ ] **SIMEXEC-OBS-001**: For each execution attempt, the system shall persist a `RoundExecutionRecord` containing transaction status, action application trace, emitted events, state deltas, and failure/invalidation reason when present.
- [ ] **SIMEXEC-OBS-002**: Where `transaction_status=committed`, the persisted `RoundExecutionRecord` shall be immutable.
- [ ] **SIMEXEC-OBS-003**: Replay execution of a persisted round record shall run in isolated context that does not mutate canonical campaign state.
- [ ] **SIMEXEC-OBS-004**: Where transaction commit succeeds, the system shall emit projection entity taxonomy/version metadata with the canonical snapshot for presentation focus-anchor mapping.

## Error Handling

- [ ] **SIMEXEC-ERR-001**: If an execution handler fault occurs during transaction processing, the system shall roll back staged mutations and emit an operational failure reason upstream.
- [ ] **SIMEXEC-ERR-002**: If rollback itself encounters an internal fault, the system shall emit explicit rollback-failure diagnostics and transition control to operational failure handling upstream.
- [ ] **SIMEXEC-ERR-003**: Where a runtime invalidation emits `RUNTIME_PRECONDITION_INVALIDATED`, the system shall classify the outcome as clarification-route eligible rather than operational execution fault.
