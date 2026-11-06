---
parent: high-level-design
prefix: RESPCOMP
---

# Response Composer

## Context and Design Philosophy

This component converts turn outcomes into captain-facing command-log responses grounded in simulation and arbitration evidence. It is narrative-authoritative for turn communication but not state-authoritative.

Design priorities:
- **Evidence-grounded narration**: every outcome statement is traceable to accepted/rejected actions, reason codes, and execution events.
- **Operational clarity**: failures and clarifications are explicit, actionable, and non-ambiguous.
- **Consistent command voice**: crew-role output remains role-consistent while preserving tactical precision.

## Runtime Platform

Iteration 1 runs in a browser-hosted React + TypeScript application. Response composition executes in client runtime logic and publishes `CaptainTurnOutput` into Zustand-managed state for presentation consumers.

## Scope and Boundaries

In scope:
- compose captain-facing outcome summary for each turn
- map arbitration and execution reasons to captain-visible explanations
- produce crew dialogue lines tied to role actions and events
- produce clarification prompts when clarification is required
- package response payload for command log and projection consumers

Out of scope:
- plan generation, arbitration, and simulation mutation
- UI layout/rendering decisions
- persistence/replay mechanics

## Inputs and Outputs

### Inputs

- `CaptainTurnInput` (captain utterance and turn context)
- canonical turn outcome classification from orchestration when present
- `ArbitrationResult` (accepted/rejected actions, reason codes, ambiguity metadata)
- `RoundExecutionRecord` when execution was attempted
- planning outcome flags (`planning_clarification_needed`, `planning_operational_error`) and reasons
- mode/channel response policy configuration

### Outputs

- `CaptainTurnOutput` containing:
  - `outcome_summary`
  - `crew_lines[]` with role attribution
  - `rejected_action_explanations[]`
  - `clarification_prompts[]` when applicable
  - `operational_notices[]` for failures/degraded flows
  - trace references to source action/event ids used in generated text

`CaptainTurnOutput` is a browser-facing fixed-key contract consumed by command-log and projection presentation layers.

## Composition Pipeline

### Stage 1: Outcome Classification

Classify turn path from input evidence:
- **completed**: execution committed
- **clarification_required**: planning/arbitration/execution routed to clarification
- **operational_failure**: dependency, execution, rollback, or persistence failures

Classification precedence:
1. canonical turn outcome classification from orchestration, when provided
2. otherwise, operational failure signals
3. then clarification-required signals
4. then committed completion

### Stage 2: Evidence Mapping

Build a normalized evidence graph for text generation:
- accepted actions and resulting events/deltas
- rejected actions and reason codes
- ambiguity and clarification reasons
- operational failure diagnostics references

Only evidence nodes present in the turn record may be narrated as facts.

### Stage 3: Narrative Assembly

Generate response sections in deterministic order:
1. concise outcome summary
2. crew role lines describing accepted outcomes
3. explicit rejected-action explanations when any rejections occurred
4. clarification prompts, or operational notice block when applicable

Narrative rules:
- no invented state or inferred action success beyond evidence graph
- mention decisive tie-break rationale when arbitration metadata marks material impact and response policy marks it captain-visible
- preserve actionable wording for captain follow-up

### Stage 4: Output Packaging

Package composed sections into `CaptainTurnOutput` with:
- stable identifiers for section blocks
- source-reference mappings for audit/replay tooling
- compatibility fields for command-log-first rendering and secondary projections

## Clarification and Failure Messaging

Clarification messaging:
- enumerate unresolved ambiguities using plain tactical language
- ask bounded follow-up questions that unblock planning/arbitration
- avoid requesting information already present in turn context

Operational failure messaging:
- name failure class and captain-visible effect
- indicate whether retry/reissue is available by mode policy
- include diagnostics reference id for support/audit flows
- when multiple failure classes apply, choose captain-facing primary failure class by response policy and include secondary class references in the same notice block

Reason-code mapping fallback:
- if a humanized reason mapping is missing, emit a generic human-readable label plus the raw machine reason code

## Determinism and Variability

- Wording may vary across runs, but factual content set must match input evidence.
- Section ordering and required block presence are deterministic by outcome classification.
- For identical evidence and fixed response policy profile, structural output shape is identical.

## Error Handling

- missing required evidence inputs: emit operational notice and minimal safe fallback output
- malformed reason-code mapping configuration: emit operational notice with mapping error class
- composition-time template/runtime exception: emit operational failure response payload and diagnostics reference

No success-shaped fallback is allowed when outcome evidence is incomplete.

## Configuration Surface

Runtime configuration includes:
- response policy profile by mode/channel
- tone/verbosity bounds for captain-facing text
- reason-code to explanation mapping catalog
- clarification prompt templates and limits
- crew-role voice style constraints
- policy hooks for notice-priority and tie-break visibility in browser UI contexts

Configuration changes language style/format but do not alter source evidence requirements.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Composition basis | Evidence-graph-driven response assembly | Freeform generation from raw turn text | Evidence mapping constrains hallucination risk and keeps rejection/failure reporting auditable. |
| Outcome ordering | Deterministic section order | Dynamic section ordering per style model | Stable order improves readability and testing while still allowing phrasing variability. |
| Clarification messaging | Bounded tactical follow-up questions | Broad open-ended clarification prompts | Targeted prompts reduce captain burden and accelerate turn recovery. |
| Failure communication | Explicit operational notice block | Implicit failure hints in crew dialogue | Explicit notices prevent ambiguous interpretations of failed turns. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Response composition is evidence-bound and cannot assert unobserved facts.
2. ✅ Operational failure messaging is explicit and separate from normal crew dialogue.

### Deferred
1. Localization strategy for reason-code explanation catalogs.
2. Adaptive verbosity policy by player preference and mission phase.
3. Cross-turn dialogue continuity memory boundaries.

## References

- `docs/high-level-design.md`
- `docs/intent/crew-command-loop/crew-command-loop-design.md`
- `docs/intent/plan-validator-arbiter/plan-validator-arbiter-design.md`
- `docs/intent/simulation-engine-turn-execution/simulation-engine-turn-execution-design.md`
