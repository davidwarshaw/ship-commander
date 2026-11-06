# Response Composer Specs

## Outcome Classification

- [ ] **RESPCOMP-CLASS-001**: When composing a turn response, the system shall classify outcome path as `completed`, `clarification_required`, or `operational_failure` from planning, arbitration, and execution evidence.
- [ ] **RESPCOMP-CLASS-002**: The system shall apply classification precedence in this order: operational failure signals, then clarification-required signals, then committed completion.
- [ ] **RESPCOMP-CLASS-003**: Where orchestration provides canonical turn outcome classification, the system shall use that classification as authoritative over locally-derived evidence classification.

## Evidence Mapping

- [ ] **RESPCOMP-EVID-001**: The system shall construct a normalized evidence mapping from accepted actions, rejected actions with reason codes, ambiguities, and execution events/deltas before narrative assembly.
- [ ] **RESPCOMP-EVID-002**: The system shall not assert any captain-visible factual claim that is not traceable to mapped turn evidence.
- [ ] **RESPCOMP-EVID-003**: Where arbitration metadata indicates materially decisive deterministic tie-break behavior, the system shall include tie-break rationale evidence in response composition inputs.
- [ ] **RESPCOMP-EVID-004**: Where tie-break rationale evidence exists, the system shall expose it in captain-facing output only when response policy marks tie-break rationale visibility enabled for the current mode/channel.

## Narrative Assembly

- [ ] **RESPCOMP-NARR-001**: The system shall assemble response sections in deterministic order: outcome summary, crew role lines, rejected-action explanations, then clarification prompts or operational notices.
- [ ] **RESPCOMP-NARR-002**: Where one or more rejected actions exist, the system shall include explicit rejected-action explanations with machine-readable reason references.
- [ ] **RESPCOMP-NARR-003**: Where clarification is required, the system shall include bounded clarification prompts that target unresolved ambiguity reasons.
- [ ] **RESPCOMP-NARR-004**: Where operational failure applies, the system shall include an explicit operational notice block separate from normal crew dialogue.
- [ ] **RESPCOMP-NARR-005**: The system shall preserve role attribution on each generated crew line.

## Output Contract and Traceability

- [ ] **RESPCOMP-OUT-001**: The system shall emit `CaptainTurnOutput` containing `outcome_summary`, `crew_lines[]`, `rejected_action_explanations[]`, `clarification_prompts[]`, and `operational_notices[]` with omitted sections represented by empty collections where not applicable.
- [ ] **RESPCOMP-OUT-002**: The system shall include source reference mappings from output sections to source action/event identifiers used to produce them.
- [ ] **RESPCOMP-OUT-003**: For identical evidence inputs and fixed response policy profile, the system shall produce identical structural output shape and section ordering.
- [ ] **RESPCOMP-OUT-004**: The system shall publish `CaptainTurnOutput` as a fixed-key browser-facing contract for command-log and projection presentation consumers.

## Clarification and Failure Messaging

- [ ] **RESPCOMP-MSG-001**: Clarification prompts shall not request information already present in turn context.
- [ ] **RESPCOMP-MSG-002**: Operational notices shall name failure class and captain-visible effect.
- [ ] **RESPCOMP-MSG-003**: Where mode/channel policy allows retry or reissue, operational notices shall include retry/reissue guidance.
- [ ] **RESPCOMP-MSG-004**: Operational notices shall include diagnostics reference id for support and audit flows.
- [ ] **RESPCOMP-MSG-005**: Where multiple failure classes apply in one turn, the system shall select captain-facing primary failure class using response policy and shall include secondary failure class references in the operational notice.

## Error Handling

- [ ] **RESPCOMP-ERR-001**: If required response-composition evidence inputs are missing, then the system shall emit operational notice and a minimal safe response payload without success claims.
- [ ] **RESPCOMP-ERR-002**: If reason-code mapping configuration is missing or malformed for a referenced reason, then the system shall emit operational notice including mapping error class.
- [ ] **RESPCOMP-ERR-003**: If composition runtime/template execution fails, then the system shall emit operational failure response payload with diagnostics reference id.
- [ ] **RESPCOMP-ERR-004**: If no humanized mapping exists for a referenced reason code, then the system shall emit a generic human-readable failure label plus the raw reason code.
