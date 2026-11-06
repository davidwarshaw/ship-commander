# LLM Plan Generator Specs

## Prompt Package Assembly

- [ ] **LLMGEN-PROMPT-001**: When a captain turn enters planning, the system shall build a prompt package that includes captain command text, snapshot id, mission context, ship status summary, role instructions, and output contract requirements.
- [ ] **LLMGEN-PROMPT-002**: The system shall include only context fields required for role planning and action-parameter grounding in the prompt package.
- [ ] **LLMGEN-PROMPT-003**: The system shall include explicit uncertainty-handling guidance instructing the model to prefer clarification-oriented plans over fabricated assumptions.
- [ ] **LLMGEN-PROMPT-004**: When a prompt package is assembled, the system shall persist a prompt package hash in generation metadata.

## Plan Generation Contract

- [ ] **LLMGEN-PLAN-001**: The system shall emit plans in structured `CrewPlan[]` form and shall not emit arbitration-ready output as freeform text.
- [ ] **LLMGEN-PLAN-002**: Where a generated crew plan is emitted, the system shall require fields `plan_id`, `role`, `goal`, `actions[]`, `contingencies[]`, `confidence`, and `rationale`.
- [ ] **LLMGEN-PLAN-003**: For each generated plan in a turn, the system shall ensure `plan_id` is unique within that turn.
- [ ] **LLMGEN-PLAN-004**: Where command scope is narrow, the system may emit a reduced role subset, and shall include explicit omission rationale for roles not represented.
- [ ] **LLMGEN-PLAN-005**: Where a clarification-oriented plan is emitted, the system shall include explicit ambiguity reasons in the plan output payload.
- [ ] **LLMGEN-PLAN-006**: Where mission policy designates critical roles requiring explicit no-op coverage, the system shall emit explicit no-op plans for omitted critical roles.

## Provider Adapter Dispatch

- [ ] **LLMGEN-PROV-001**: Before model dispatch, the system shall resolve the selected provider id to a registered provider adapter implementing the shared `LLMProvider` interface.
- [ ] **LLMGEN-PROV-002**: If selected provider id does not resolve to exactly one valid adapter implementation, then the system shall emit configuration error outcome and no arbitration-ready plans.
- [ ] **LLMGEN-PROV-003**: The system shall require a non-empty selected model id supported by the selected provider adapter before dispatch.
- [ ] **LLMGEN-PROV-004**: If selected model id is empty or unsupported by selected provider adapter, then the system shall emit configuration error outcome and no arbitration-ready plans.
- [ ] **LLMGEN-PROV-005**: For each planning attempt, the system shall dispatch provider calls through the shared adapter interface and shall not invoke provider-specific transport logic from orchestration paths.
- [ ] **LLMGEN-PROV-006**: For each planning attempt, the system shall persist provider id and selected model id in generation metadata.
- [ ] **LLMGEN-PROV-007**: At turn intake, the system shall capture selected provider id, API key, and selected model id as immutable planning settings for that turn's generation attempts.
- [ ] **LLMGEN-PROV-008**: Where selected provider id is `anthropic-claude`, the system shall dispatch model generation using Anthropic Messages API (`POST /v1/messages`) through provider adapter boundary.
- [ ] **LLMGEN-PROV-009**: Where selected provider id is `anthropic-claude`, the system shall send API key via `x-api-key` header and include required Anthropic API version header.
- [ ] **LLMGEN-PROV-010**: Where selected provider id is `anthropic-claude`, the system shall include selected model id and captain-turn content in request payload and require model text output to contain JSON plan payload.
- [ ] **LLMGEN-PROV-011**: Where selected provider id is `anthropic-claude`, the system shall send `Content-Type: application/json` and `anthropic-version` header set to adapter-supported value.
- [ ] **LLMGEN-PROV-012**: Where selected provider id is `anthropic-claude`, the system shall encode captain command as one user message text content block using provider-compatible JSON-safe escaping.
- [ ] **LLMGEN-PROV-013**: Where selected provider id is `anthropic-claude`, the system shall include fixed `max_tokens` value in request payload per runtime policy.
- [ ] **LLMGEN-PROV-014**: For iteration-1 browser runtime, the system shall allow direct client dispatch to Anthropic Messages API using captured API key settings.

## Validation and Regeneration

- [ ] **LLMGEN-VAL-001**: The system shall validate generated plans for required fields, confidence bounds, non-empty action lists for non-clarification plans, and action parameter type/range/domain constraints.
- [ ] **LLMGEN-VAL-002**: If first-pass schema or semantic validation fails, then the system shall perform one regeneration attempt using structured validation-error guidance.
- [ ] **LLMGEN-VAL-003**: If schema or semantic validation fails after the regeneration attempt, then the system shall return a clarification-required planning outcome and no arbitration-ready plans.
- [ ] **LLMGEN-VAL-004**: The system shall not emit any unvalidated plan as arbitration-ready output.
- [ ] **LLMGEN-VAL-005**: Where plan confidence is below configured arbitration floor threshold, the system shall exclude that plan from arbitration-ready output.
- [ ] **LLMGEN-VAL-006**: If normalized adapter output payload is malformed before schema/semantic plan validation, then the system shall emit generation error outcome and shall not enter regeneration.
- [ ] **LLMGEN-VAL-007**: If duplicate `plan_id` values are present within a planning attempt, then the system shall treat the attempt as validation failure and apply bounded regeneration policy.
- [ ] **LLMGEN-VAL-008**: Where clarification-oriented plans are emitted, the system shall require explicit ambiguity reasons; where non-clarification plans are emitted, the system shall require non-empty actions.
- [ ] **LLMGEN-VAL-009**: If a planning attempt returns a mix of valid and invalid plans, then the system shall treat the attempt as failed and perform one whole-attempt regeneration.
- [ ] **LLMGEN-VAL-010**: If all structurally and semantically valid plans are excluded by confidence floor, then the system shall emit clarification-required outcome and no arbitration-ready plans.
- [ ] **LLMGEN-VAL-011**: During regeneration for a turn, the system shall keep provider id and selected model id fixed across attempts.
- [ ] **LLMGEN-VAL-012**: If plan-count limit conflicts with required critical-role no-op coverage policy, then the system shall prioritize critical-role coverage and fail validation when both constraints cannot be satisfied.
- [ ] **LLMGEN-VAL-013**: Where selected provider id is `anthropic-claude`, the system shall extract normalization candidate text from text content blocks only; if no text block exists then the system shall emit generation error outcome.
- [ ] **LLMGEN-VAL-014**: Where selected provider id is `anthropic-claude`, the system may strip Markdown code-fence wrappers around response text before JSON parse; non-JSON surrounding prose shall fail normalization.
- [ ] **LLMGEN-VAL-015**: If parsed Anthropic response JSON root is not an array of plan objects, then the system shall emit generation error outcome and no arbitration-ready plans.

## Ambiguity and Clarification Behavior

- [ ] **LLMGEN-CLAR-001**: If captain intent yields multiple materially different tactical interpretations without sufficient constraints, then the system shall produce a clarification-oriented planning outcome.
- [ ] **LLMGEN-CLAR-002**: If required target or entity resolution is missing and would alter action safety or objective alignment, then the system shall produce a clarification-oriented planning outcome.
- [ ] **LLMGEN-CLAR-003**: If contradictory intent clauses are present in the same captain utterance, then the system shall produce a clarification-oriented planning outcome.

## Metadata, Determinism Boundaries, and Failures

- [ ] **LLMGEN-OBS-001**: For each planning attempt, the system shall persist generation metadata including model/version identifier, attempt count, and validation-error feedback used for regeneration.
- [ ] **LLMGEN-OBS-002**: The system shall treat structural contract validity and traceability requirements as invariant even when generated wording varies across runs.
- [ ] **LLMGEN-OBS-003**: The system shall emit `planning_clarification_needed` and `planning_operational_error` outcome flags with machine-readable reasons for turn orchestration.
- [ ] **LLMGEN-ERR-001**: If model/provider timeout prevents valid plan generation, then the system shall apply mode/channel timeout policy that either emits operational generation error or routes to captain clarification/retry outcome.
- [ ] **LLMGEN-ERR-002**: If role catalogs or action schema catalogs are malformed or unavailable, then the system shall emit a configuration error and no arbitration-ready plans.
- [ ] **LLMGEN-ERR-003**: If client runtime cannot reach model-service dependency, then the system shall apply configured connectivity policy and emit either operational generation error or clarification/retry outcome with no arbitration-ready plans.
- [ ] **LLMGEN-ERR-004**: Where connectivity failure and clarification-eligible signals coexist for a planning attempt, the system shall classify operational generation failure as the primary planning outcome status.
- [ ] **LLMGEN-ERR-005**: If API key for selected provider is missing or empty, then the system shall emit configuration error outcome and no arbitration-ready plans.
- [ ] **LLMGEN-ERR-006**: If selected provider adapter registration exists but does not satisfy required adapter contract, then the system shall emit configuration error outcome and no arbitration-ready plans.
- [ ] **LLMGEN-ERR-007**: If selected provider rejects authentication for supplied API key, then the system shall emit operational generation error outcome with auth-rejection reason.
- [ ] **LLMGEN-ERR-008**: If provider dispatch times out after request send attempt, then the system shall emit operational generation error and shall not issue an automatic second provider call in the same planning attempt.
- [ ] **LLMGEN-ERR-009**: If ambiguity-eligible planning signals coexist with provider/auth/connectivity/configuration failure in a planning attempt, then the system shall classify operational generation failure as the primary planning outcome status.
- [ ] **LLMGEN-OBS-004**: The system shall exclude API key material from generation metadata, trace records, and telemetry payloads.
- [ ] **LLMGEN-ERR-010**: If Anthropic provider response text cannot be normalized into valid JSON plan payload, then the system shall emit generation error outcome and no arbitration-ready plans.
- [ ] **LLMGEN-ERR-011**: If Anthropic provider responds with authentication failure, then the system shall emit operational generation error with auth-rejection reason.
- [ ] **LLMGEN-ERR-012**: If Anthropic provider responds with rate-limit status, then the system shall emit operational generation error with rate-limit reason.
- [ ] **LLMGEN-ERR-013**: If Anthropic provider responds with provider-side server failure, then the system shall emit operational generation error with provider-unavailable reason.
- [ ] **LLMGEN-ERR-014**: If Anthropic provider returns refusal response or truncated/incomplete output for planning request, then the system shall emit operational generation error and no arbitration-ready plans.
- [ ] **LLMGEN-ERR-015**: If Anthropic provider dispatch exceeds configured adapter timeout, then the system shall emit operational generation error and no arbitration-ready plans.
