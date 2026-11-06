# Presentation Layer Specs

## Data Binding and Validation

- [ ] **PRESENT-BIND-001**: When rendering a turn, the system shall bind `CaptainTurnOutput` and projection inputs into presentation view models using stable render keys.
- [ ] **PRESENT-BIND-001A**: Where canonical outcome classification is provided by orchestration, the system shall bind it alongside `CaptainTurnOutput` for presentation badges and filtering controls.
- [ ] **PRESENT-BIND-002**: If required command-log payload is missing, then the system shall render an operational failure presentation state and shall not render normal turn sections.
- [ ] **PRESENT-BIND-003**: Where projection inputs are missing or malformed, the system shall attach diagnostics markers and render degraded projection state without fabricating data.
- [ ] **PRESENT-BIND-004**: The system shall require fixed-key `CaptainTurnOutput` contract fields and shall treat missing required keys as input contract violations.
- [ ] **PRESENT-BIND-005**: The system shall normalize validated command-log and projection payloads into shared client presentation-state slices before React and scene adapters consume updates.
- [ ] **PRESENT-BIND-006**: Before strict fixed-key validation, the system shall apply a fallback shaping layer that populates required output keys with safe empty/default values when possible.

## Chakra Provider and Alias Integration

- [ ] **PRESENT-CHAKRA-001**: The system shall wrap the full app shell in exactly one root provider exported as `Provider` from `@/components/ui/provider`.
- [ ] **PRESENT-CHAKRA-002**: If `@/components/ui/provider` module path or required `Provider` export is missing, then startup/build shall fail with explicit configuration error.
- [ ] **PRESENT-CHAKRA-003**: TypeScript and Vite alias resolution for `@/*` shall resolve to the same source-root mapping.
- [ ] **PRESENT-CHAKRA-004**: The Vite tsconfig-path synchronization plugin shall be configured in Vite plugin chain for alias-based imports used by presentation/provider modules.
- [ ] **PRESENT-CHAKRA-005**: Where Chakra component defaults conflict with documented presentation visual constraints, configured project styling policy shall take precedence.
- [ ] **PRESENT-CHAKRA-006**: Chakra control events shall be adapted to existing presentation view-model value contracts for provider/model ids and key-replacement input text.
- [ ] **PRESENT-CHAKRA-007**: If provider/model option catalogs are unavailable, then related selectors shall render disabled with deterministic placeholder state until valid options are available.

## Command Log Rendering

- [ ] **PRESENT-LOG-001**: The system shall render command-log sections in canonical order from `CaptainTurnOutput`.
- [ ] **PRESENT-LOG-002**: The system shall preserve crew role attribution and provided reason references in rendered command-log entries.
- [ ] **PRESENT-LOG-003**: For identical `CaptainTurnOutput` inputs, the system shall render identical structural command-log output ordering.

## Tactical and Status Projections

- [ ] **PRESENT-PROJ-001**: The system shall render tactical wireframe projection from canonical simulation snapshot projection data and shall not source tactical facts from non-canonical inputs.
- [ ] **PRESENT-PROJ-002**: The system shall render systems/status panels from canonical ship and mission projection data using consistent threshold bands and labels.
- [ ] **PRESENT-PROJ-003**: Where current turn output includes trace-linked entities, the system shall highlight corresponding entities/subsystems in projections when they are present in projection data.
- [ ] **PRESENT-PROJ-004**: If trace-linked highlights reference missing or stale projection entities, then the system shall suppress misleading highlights and render stale/unavailable indication.
- [ ] **PRESENT-PROJ-005**: The system shall update tactical scene graph state through presentation adapters that consume normalized projection slices rather than raw transport payloads.

## Mode Toggle and Shared Interaction State

- [ ] **PRESENT-MODE-001**: The system shall keep command log primary/visible in all secondary view modes as configured by policy.
- [ ] **PRESENT-MODE-002**: When switching between tactical and status modes, the system shall preserve shared focus anchor when representable in the destination mode.
- [ ] **PRESENT-MODE-003**: If shared focus anchor is not representable in destination mode, then the system shall clear mode-specific focus and preserve turn focus index.
- [ ] **PRESENT-MODE-004**: Mode switching shall not alter turn outcome classification or recompute response-composer outputs.
- [ ] **PRESENT-MODE-005**: If destination projection mode is stale relative to command-log turn snapshot, the system shall allow mode toggle and display stale warning state.

## LLM Settings Controls and Persistence

- [ ] **PRESENT-SET-001**: The system shall render settings controls for `providerId`, `modelId`, and API key in the command panel.
- [ ] **PRESENT-SET-001A**: The system shall render LLM settings controls inside a collapsible Settings accordion section in the command panel.
- [ ] **PRESENT-SET-001B**: The system shall render settings notices and unsaved-draft helper text inside the Settings accordion section.
- [ ] **PRESENT-SET-002**: On initialization, the system shall hydrate persisted LLM settings from localStorage and validate hydrated provider/model values against available provider/model catalogs.
- [ ] **PRESENT-SET-002A**: The system shall persist and hydrate LLM settings from fixed localStorage key `ship-commander.llm.settings`.
- [ ] **PRESENT-SET-003**: If hydrated provider/model values are malformed or unsupported, then the system shall replace them with configured defaults and render a settings diagnostics notice.
- [ ] **PRESENT-SET-003A**: During settings hydration, the system shall ignore unknown fields in persisted settings payload and shall validate only required known settings fields.
- [ ] **PRESENT-SET-003B**: Where hydration/default correction occurs, reopened Settings accordion shall display corrected values and diagnostics state without requiring refresh.
- [ ] **PRESENT-SET-004**: If selected provider changes and current selected model is unsupported by that provider, then the system shall reset selected model to provider default before save.
- [ ] **PRESENT-SET-004A**: When provider change invalidates current model selection, the system shall apply model reset immediately in draft state.
- [ ] **PRESENT-SET-005**: The system shall mask API key value in UI input rendering.
- [ ] **PRESENT-SET-005A**: Where masked API key display is shown and no explicit replacement key is entered, the system shall preserve existing persisted API key value on save.
- [ ] **PRESENT-SET-005B**: Empty key input and unchanged masked placeholder values shall not overwrite persisted API key value.
- [ ] **PRESENT-SET-005C**: Browser autofill values for key input shall be treated as explicit replacement only when user triggers save action.
- [ ] **PRESENT-SET-006**: The system shall persist provider/model/API key settings under one serialized localStorage object key and shall not split persistence across multiple keys.
- [ ] **PRESENT-SET-007**: Where active tab is not writer-lock owner, the system shall render settings controls read-only and block local edits from mutating in-memory settings draft.
- [ ] **PRESENT-SET-008**: If writer ownership is lost before or during settings save, then the system shall reject save and render read-only operational notice.
- [ ] **PRESENT-SET-008A**: If writer ownership is lost mid-interaction, then local edits shall remain as unsaved draft and settings save shall stay blocked until ownership is reacquired.
- [ ] **PRESENT-SET-008B**: Ownership-loss/read-only notices shall remain visible when Settings accordion is collapsed.
- [ ] **PRESENT-SET-009**: If owner tab has unsaved local settings edits, then incoming storage-event settings updates shall not overwrite local draft until user saves or resets.
- [ ] **PRESENT-SET-010**: At command submit, the system shall capture an immutable validated settings snapshot before applying pending storage-event updates, and planning for that turn shall use only the captured snapshot.
- [ ] **PRESENT-SET-010A**: Where unsaved local settings draft exists, submit-time snapshot capture shall use draft values even when Settings accordion is collapsed.
- [ ] **PRESENT-SET-010B**: Settings accordion toggle events shall not alter captured settings snapshot for in-flight submit operations.
- [ ] **PRESENT-SET-011**: The system shall exclude API key material from command-log lines, diagnostics output, and telemetry payloads.
- [ ] **PRESENT-SET-012**: Settings validation shall not block command submit; if captured settings are invalid, planning shall receive them and emit operational error outcome per planning policy.
- [ ] **PRESENT-SET-013**: Expanding or collapsing the Settings accordion shall not mutate settings values, shall not reset unsaved drafts, and shall not alter submit-time settings snapshot behavior.
- [ ] **PRESENT-SET-013A**: If Settings accordion collapses while focus is inside settings controls, then reopening shall restore focus to first invalid interactive control or provider-selector fallback.
- [ ] **PRESENT-SET-013B**: Settings accordion shall initialize in collapsed state on first render.

## Snapshot Consistency and Freshness

- [ ] **PRESENT-SNAP-001**: The system shall ensure rendered projections correspond to the same canonical snapshot associated with displayed command-log turn output.
- [ ] **PRESENT-SNAP-002**: If projection snapshot differs from command-log turn snapshot, then the system shall render stale-projection notice and suppress turn-linked projection highlights.

## Error Handling and Telemetry

- [ ] **PRESENT-ERR-001**: If tactical projection rendering fails, then the system shall preserve command-log rendering and status-mode availability.
- [ ] **PRESENT-ERR-002**: If status projection rendering fails, then the system shall preserve command-log rendering and tactical-mode availability.
- [ ] **PRESENT-ERR-003**: Telemetry emission failures for mode toggles or render diagnostics shall not block captain-visible rendering.
- [ ] **PRESENT-ERR-004**: Where operational notices are present, the system shall apply policy-configured notice priority behavior to either pin notices at top or preserve strict response section order.
- [ ] **PRESENT-ERR-004A**: Where settings persistence/validity notices and stale-projection warnings coexist, the system shall pin settings notices above stale-projection warnings.
- [ ] **PRESENT-ERR-005**: If localStorage read for settings fails due to runtime/security/quota exception, then the system shall load default settings into in-memory state, render settings-read-failure notice, and continue rendering.
- [ ] **PRESENT-ERR-006**: If localStorage settings write fails, then the system shall preserve in-memory settings draft, preserve prior persisted settings object, and render unsaved-settings notice.
- [ ] **PRESENT-ERR-006A**: Unsaved-settings notice after settings write failure shall be rendered inside Settings accordion section.
