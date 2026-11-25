---
parent: high-level-design
prefix: LLMGEN
---

# LLM Plan Generator

## Context and Design Philosophy

This component converts a captain's natural-language command plus current mission/simulation context into structured, role-scoped crew plans for arbitration. It is proposal-authoritative but never execution-authoritative: output quality determines tactical usefulness, while simulation safety remains downstream.

Design priorities:
- **Structured over stylistic output**: schema-valid plans with explicit action candidates and contingencies are preferred over rich prose.
- **Role-grounded intent decomposition**: each plan expresses one crew role's tactical contribution to the captain's intent.
- **Predictable recovery**: validation failures trigger bounded regeneration, then captain clarification.

## Runtime Platform

Iteration 1 runs in a browser-hosted React + TypeScript runtime. Plan generation may call a remote model service, but prompt assembly, validation, retry policy, and outcome-flag publication execute in client application logic and update Zustand-managed turn state.

## Scope and Boundaries

In scope:
- prompt package assembly from captain input and current context
- role-scoped plan generation
- schema and semantic validation of generated plans
- bounded regeneration on validation failure
- generation metadata required for traceability

Out of scope:
- permission/precondition arbitration across plans
- simulation state mutation and turn execution
- captain-facing narrative rendering

## Inputs and Outputs

### Inputs

- `CaptainTurnInput` fields: captain message text, snapshot id, mission context, ship status summary, command channel metadata
- role catalog and role-specific instruction fragments
- action schema catalog with parameter constraints
- generation policy configuration (model selection profile, temperature/top-p policy, retry budget)
- active LLM settings: provider id, API key, and selected model id

### Outputs

- `CrewPlan[]` where each plan includes:
  - `plan_id`
  - `role`
  - `goal`
  - `actions[]` with typed parameters
  - `contingencies[]`
  - `confidence`
  - `rationale`
- generation metadata:
  - prompt package hash
  - model/version identifier
  - attempt count
  - validation error feedback used for regeneration (if any)
- planning outcome flags:
  - `planning_clarification_needed` with machine-readable reasons
  - `planning_operational_error` with reason code when applicable

Integration precedence:
1. If `planning_operational_error=true`, turn orchestration treats operational failure as primary by default and applies mode/channel policy for recovery behavior.
2. If no arbitration-ready plans exist and `planning_clarification_needed=true`, turn orchestration routes to clarification before arbitration.
3. If arbitration runs, arbitration-level clarification semantics remain authoritative for the accepted/rejected action decision.

## Generation Pipeline

### Stage 1: Prompt Package Assembly

The component assembles a deterministic prompt payload from:
- normalized captain command text
- mission and ship-state context summary
- game preamble describing Ship Commander and planner role
- crew roster with aliases, assigned systems, and allowed system actions
- role instructions and allowed action families
- output contract/schema requirements

Prompt assembly rules:
- include only context fields needed for role planning and action-parameter grounding
- include explicit uncertainty-handling instruction: prefer clarification-oriented plans over fabricated assumptions
- bind output format requirements to machine-parseable schema shape
- for Anthropic adapter dispatch, include a system prompt that explicitly defines `CrewPlan[]` field shape and JSON-only output constraint

### Stage 2: Role-Scoped Plan Generation

Generation can emit one plan per relevant role, or a reduced role subset when the command scope is narrow. The planner may omit roles with no tactical contribution when omission is explicitly justified.

Role omission policy is mission-context dependent:
- some mission profiles allow omission as neutral behavior
- other profiles require explicit no-op plans for designated critical roles

Each plan must:
- map role activity to a concrete command goal contribution
- produce ordered action candidates
- include contingencies for plausible near-term divergence

### Stage 2A: Provider Adapter Dispatch

Before issuing a model call, this component resolves the active provider adapter from a typed registry keyed by provider id. Dispatch contract:
- request payload: normalized prompt package plus selected model identifier
- auth payload: API key read from client settings state
- response payload: provider-normalized planning candidate content and provider metadata

Dispatch invariants:
- generation orchestration code calls provider adapters only through the shared `LLMProvider` interface
- provider-specific HTTP details (headers, endpoint shape, response mapping) are isolated to adapters
- the selected provider and model id are recorded in generation metadata for traceability
- before dispatch, the system validates that the resolved registry entry implements the required adapter interface; invalid entries are treated as configuration errors

Anthropic Claude adapter contract:
- provider id `anthropic-claude` dispatches to Anthropic Messages API endpoint (`POST /v1/messages`)
- adapter sends API key using `x-api-key` header and includes required version header
- adapter sends `Content-Type: application/json`
- adapter request body includes selected model id, deterministic instruction scaffold in `system`, captain-turn content as user message, and fixed `max_tokens` budget
- adapter request body includes a structured output tool schema (`input_schema`) and explicit `tool_choice` targeting CrewPlan payload emission
- adapter expects JSON plan payload in model text output and normalizes it into `CrewPlan[]` contract
- malformed or non-JSON model text output is classified as adapter output normalization error

Anthropic request/response handling rules:
- required version header is `anthropic-version` and must be set to configured supported value for the adapter
- direct browser dispatch must include `anthropic-dangerous-direct-browser-access: true`
- direct browser dispatch is supported for iteration 1 and uses client-side API key from persisted settings
- non-2xx responses are normalized to operational generation errors with reason mapping (`AUTH_REJECTED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_REQUEST_INVALID`)
- adapter extracts JSON candidate text from text content blocks only; missing text content blocks are normalization errors
- adapter prefers tool-use structured output (`tool_use` with CrewPlan schema input) and falls back to text-block normalization only when tool output is absent
- adapter may strip Markdown code-fence wrappers around JSON candidate text; non-JSON surrounding prose is not accepted
- parsed JSON root must be an array of plan objects; non-array roots are normalization errors
- structural field/type checks for plan payload remain stage-3 validation responsibility after adapter normalization
- refusal responses and truncated/incomplete outputs are operational generation errors and do not produce arbitration-ready plans
- captain message is encoded as a single user message content block using JSON-safe escaping rules required by provider payload schema
- adapter applies fixed request timeout and classifies timeout as operational generation error

Provider/model validation rules:
- selected provider id must resolve to exactly one registered adapter
- selected model id must be non-empty and supported by the selected adapter profile
- unsupported or empty model id produces configuration error status and no arbitration-ready plans

Settings persistence ownership:
- this segment consumes provider/key settings supplied by presentation/state layers
- this segment does not own settings UI or localStorage write behavior
- planning captures provider/key/model settings at turn start and uses that immutable snapshot for all attempts in the turn

### Stage 3: Contract and Semantic Validation

Validator checks:
- required fields present for each plan
- `confidence` numeric in `[0.0, 1.0]`
- non-clarification plans have non-empty `actions[]`
- action parameters satisfy declared type/range/domain constraints

Validation failure handling:
1. first failure returns structured error guidance to the generation step
2. perform one regeneration attempt
3. on repeated failure, return clarification-required outcome to turn orchestration

Validation scope and precedence:
- adapter output normalization is validated before schema/semantic plan validation
- malformed normalized adapter payload is classified as generation error and does not enter regeneration
- duplicate `plan_id` values in a turn are schema-contract violations and trigger regeneration on first pass
- clarification-oriented plans must include explicit ambiguity reasons; non-clarification plans must include non-empty actions
- when a response contains a mix of valid and invalid plans, the component performs one whole-attempt regeneration using structured error guidance
- if all plans that pass structural/semantic validation are below confidence floor, outcome is clarification-required with no arbitration-ready plans

No unvalidated plan may be emitted as arbitration-ready output.

Confidence handling boundary:
- this component enforces a configurable hard confidence floor for arbitration-ready plans
- plans above floor pass through with confidence preserved for downstream weighted arbitration
- confidence-floor filtering occurs after structural and semantic validation
- when filtered result is empty, clarification-required outcome is emitted with machine-readable low-confidence reason

## Clarification-Oriented Planning Behavior

When captain intent is materially ambiguous, the component may emit clarification-oriented plans rather than speculative action bundles. Clarification-oriented plans must still be schema-valid and include explicit ambiguity reasons to support downstream captain prompts.

Ambiguity triggers include:
- multiple materially different tactical interpretations with insufficient captain constraints
- missing target/entity resolution that would alter action safety or objective alignment
- contradictory intent clauses in the same captain utterance

## Determinism, Variability, and Traceability

- Textual plan wording may vary between runs.
- Structural contract validity and traceability requirements do not vary.
- Every emitted plan has stable `plan_id` uniqueness within turn scope.
- Generation metadata is persisted so arbitration/execution outcomes can be traced to generation inputs and attempts.

## Failure Handling

- schema parse failure: trigger bounded regeneration
- semantic validation failure: trigger bounded regeneration
- repeated failure after retry budget: emit clarification-required outcome with validation summary
- model/provider failure or timeout: emit operational generation error and no arbitration-ready plans
- malformed role/action catalogs: emit configuration error and no arbitration-ready plans
- missing/empty API key for selected provider: emit configuration error and no arbitration-ready plans
- unknown provider id or missing adapter registration: emit configuration error and no arbitration-ready plans
- invalid adapter contract implementation: emit configuration error and no arbitration-ready plans
- provider authentication rejection for supplied API key: emit operational generation error with auth-rejection reason
- adapter timeout after dispatch attempt: emit operational generation error; no automatic second provider call in the same attempt
- where ambiguity signals and provider/connectivity/auth/configuration failures coexist, operational generation failure remains the primary planning outcome

Regeneration invariants:
- provider id and selected model id remain fixed across regeneration attempts for a turn
- each attempt records prompt hash, provider id, model id, attempt count, and validation/error feedback used
- if max plan count would exclude required critical-role no-op coverage, critical-role no-op requirement takes precedence and the attempt fails validation
- API key material is excluded from persisted generation metadata, traces, and telemetry payloads

No silent fallback to freeform text is allowed.

## Configuration Surface

Runtime configuration includes:
- provider adapter registry keyed by provider id
- selected provider id and selected model id
- provider API key sourced from persisted client settings
- model profile per command channel or mission mode
- stochasticity controls (`temperature`, `top_p`) with bounded ranges
- regeneration retry budget (default 1)
- role enablement policy by mission context
- critical-role no-op requirement policy by mission context
- operational timeout handling policy by mode/channel
- confidence floor threshold for arbitration-ready plan eligibility
- maximum generated plan count per turn
- client network policy for model-service connectivity and timeout behavior

Configuration changes influence generation behavior but do not change the `CrewPlan` contract.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Output shape | Structured `CrewPlan[]` contract per role | Freeform role dialogue with downstream extraction | Structured outputs reduce ambiguity and improve downstream validation/arbitration reliability. |
| Retry policy | Single bounded regeneration on validation failure | Unlimited retries; no retries | One retry captures common recoverable formatting/constraint misses without unbounded latency. |
| Ambiguity strategy | Allow clarification-oriented plans | Force concrete action plans for every command | Clarification-first behavior avoids speculative plans that create unsafe or misleading arbitration inputs. |
| Role participation | Relevance-based role inclusion with explicit omission rationale | Always emit all roles | Relevance-based inclusion reduces noise and avoids artificial actions from uninvolved roles. |
| Provider integration boundary | Typed `LLMProvider` interface + adapter registry | Provider-specific branching in generation orchestration | Adapter isolation keeps provider API differences out of orchestration and improves extensibility/testability. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Generation is proposal-authoritative only; execution authority remains downstream.
2. ✅ Validation failures use bounded regeneration before clarification escalation.

### Deferred
1. Confidence calibration strategy (raw model confidence vs normalized post-processor score).
2. Policy for cross-role coherence prompts vs independent role generation.
3. Prompt-context compression strategy under long mission histories.

## References

- `docs/high-level-design.md`
- `docs/intent/crew-command-loop/crew-command-loop-design.md`
