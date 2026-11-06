---
parent: high-level-design
prefix: PLANARB
---

# Plan Validator + Arbiter

## Context and Design Philosophy

This component transforms generated crew plans into a safe, explainable execution decision for a single command turn. It validates action proposals against contract and world constraints, resolves cross-plan conflicts, and emits a deterministic `ArbitrationResult` consumed by simulation execution and response composition.

Design priorities:
- **Safety first**: reject unsafe or contradictory actions rather than forcing partial execution.
- **Explainable outcomes**: every rejection and acceptance is traceable to explicit reason codes and source plan/action ids.
- **Deterministic arbitration**: for identical validated inputs and policy configuration, the accepted action set is identical.

## Runtime Platform

Iteration 1 executes arbitration in browser runtime as part of the client-side turn pipeline. Inputs are read from session state, arbitration results are written back to Zustand-managed orchestration state, and no arbitration step mutates simulation or presentation state directly.
Arbitration and simulation execution may be split across main-thread and worker runtimes when messaging guarantees deterministic ordered delivery of arbitration outputs to execution consumers.

## Scope and Boundaries

In scope:
- action-level schema and semantic validation
- role-permission enforcement
- conflict detection across candidate actions
- tie-breaking and accepted-set selection
- `clarification_needed` derivation and ambiguity reporting

Out of scope:
- LLM prompt shaping and plan generation
- simulation mutation or transaction handling
- captain-facing prose generation and UI formatting

## Inputs and Outputs

### Inputs

- `CaptainTurnInput` context subset needed for validation (snapshot id, mission context, command channel)
- `CrewPlan[]` candidate plans with `plan_id`, `role`, `goal`, `actions[]`, `contingencies[]`, `confidence`, `rationale`
- policy configuration (`confidence_weight`, `risk_weight`, `priority_weight`, permission matrix)
- simulation-query adapters for precondition checks

### Outputs

- `ArbitrationResult` containing:
  - `accepted_actions[]` (ordered)
  - `rejected_actions[]` with reason codes and source `plan_id`/`action_id`
  - `unresolved_ambiguities[]`
  - `clarification_needed`
  - `operational_error` (boolean) with `operational_error_reason` when true
  - scoring/selection metadata for auditability

Ownership note:
- This component is authoritative for arbitration reason-code taxonomy and `clarification_needed` derivation semantics.
- `crew-command-loop` mirrors these invariants at integration-contract level and references this segment for taxonomy definitions.

## Validation Pipeline

### Stage 1: Contract and Semantic Validation

For each candidate plan/action:
- verify required fields and action parameter types
- enforce semantic ranges/domain constraints
- enforce confidence in `[0.0, 1.0]`
- reject non-clarification plans with empty `actions[]`

Invalid actions are rejected at action granularity; the enclosing plan remains eligible with remaining valid actions. If all actions are rejected, mark plan rejection reason `PLAN_EMPTY_AFTER_VALIDATION`.

### Stage 2: Role-Permission Validation

Each action is checked against the role-permission matrix:
- role must be authorized for action family
- role-specific parameter restrictions are enforced

Unauthorized actions are rejected with `ROLE_PERMISSION_DENIED`.

### Stage 3: Feasibility Validation

Each remaining action is checked against snapshot-scoped preconditions:
- resource availability and lock/cooldown constraints
- positional/target constraints
- temporal ordering feasibility inside and across plans

Failed actions are rejected with precise reason codes (for example, `RESOURCE_UNAVAILABLE`, `TEMPORAL_ORDER_CONFLICT`, `PRECONDITION_UNSATISFIED`).

## Conflict Detection and Arbitration

### Conflict Model

Conflicts are represented as explicit relationships between validated actions:
- **resource contention**: incompatible concurrent claims on finite subsystem capacity
- **intent exclusivity**: mutually exclusive tactical postures
- **ordering invalidation**: one action invalidates another action's required precondition

### Selection Policy

1. Build the feasible candidate action pool after validation stages.
2. Construct conflict sets and remove combinations that violate hard constraints.
3. Score remaining candidates by weighted policy:
   - mission-priority contribution
   - operational risk (inverse weight direction)
   - model confidence
4. Select the highest-score safe action set.
5. If no safe set exists, emit no accepted actions and require clarification.

Tie-breaking (deterministic order):
1. higher mission-priority contribution
2. lower operational risk
3. higher confidence
4. stable lexical order by `plan_id`, then `action_id`

When tie-break step 4 materially determines the selected set, arbitration metadata includes a tie-break rationale payload for captain-visible explanation by downstream response composition.

## Clarification Derivation and Ambiguity Handling

`clarification_needed` is derived as:
- `true` iff `accepted_actions[]` is empty OR `unresolved_ambiguities[]` is non-empty
- `false` otherwise

Unresolved ambiguity reasons include:
- insufficient disambiguation between equally safe intent interpretations
- missing captain constraints required to choose between materially different outcomes
- stale contextual assumptions that cannot be safely inferred

When clarification is required, the output includes:
- machine-readable reason codes
- concise clarification prompts keyed to unresolved ambiguities

## Determinism and Traceability Requirements

- Arbitration is pure with respect to validated inputs, policy config, and deterministic sort keys.
- Every accepted and rejected action carries canonical `plan_id` and `action_id`.
- The component emits audit metadata (scores, filtered alternatives, conflict reasons) sufficient to reconstruct why the accepted set won.
- The component never mutates simulation state.

## Failure Handling

- malformed input contract: fail turn path with explicit contract error reason
- configuration invalid (missing weights/permission matrix): fail turn path with configuration error reason
- simulation-query adapter unavailable: emit `operational_error=true` with reason `ARBITER_DEPENDENCY_UNAVAILABLE` and no accepted actions
- internal arbitration exception: fail loud with diagnostic reason and no accepted actions

No silent fallback is allowed.

## Configuration Surface

Runtime configuration includes:
- weighted scoring coefficients: `confidence_weight`, `risk_weight`, `priority_weight`
- role-permission matrix
- conflict policy toggles for optional tactical doctrines (if enabled by mission profile)
- ambiguity thresholds for "must clarify" escalation
- client dependency policy for simulation-query adapter availability and timeout behavior

Configuration changes affect arbitration outcomes but do not change output contract shape.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Rejection granularity | Action-level rejection with plan-level collapse only when empty | Whole-plan rejection on first invalid action | Action-level rejection preserves safe intent while still surfacing invalid proposals clearly. |
| Conflict resolution timing | Pre-execution arbitration over full validated set | First-valid action wins; sequential acceptance in arrival order | Full-set arbitration prevents order-dependent drift and reduces contradictory bundles reaching execution. |
| No-safe-set behavior | Clarification instead of best-effort partial commit | Execute highest-confidence subset even when ambiguities remain | Clarification preserves captain trust and avoids irreversible state transitions based on underspecified intent. |
| Deterministic ties | Fixed lexicographic tie-break after policy metrics | Randomized or nondeterministic tie resolution | Stable tie resolution is required for replayability and audit consistency. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Action-level role-permission failures do not automatically invalidate entire plans.
2. ✅ Clarification is mandatory when no safe accepted set exists.

### Deferred
1. Exact operational risk scoring function and normalization approach.
2. Mission-priority signal source of truth (static mission config vs dynamic director service).
3. Extent of doctrine-specific conflict policy toggles needed for initial release.

## References

- `docs/high-level-design.md`
- `docs/intent/crew-command-loop/crew-command-loop-design.md`
