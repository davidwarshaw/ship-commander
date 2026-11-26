# Presentation Layer Specs

## Data Binding and Validation

- [ ] **PRESENT-BIND-001**: When rendering a turn, the system shall bind `CaptainTurnOutput` and projection inputs into presentation view models using stable render keys.
- [ ] **PRESENT-BIND-001A**: Where canonical outcome classification is provided by orchestration, the system shall bind it alongside `CaptainTurnOutput` for presentation badges and filtering controls.
- [ ] **PRESENT-BIND-002**: If required command-log payload is missing, then the system shall render an operational failure presentation state and shall not render normal turn sections.
- [ ] **PRESENT-BIND-003**: Where projection inputs are missing or malformed, the system shall attach diagnostics markers and render degraded projection state without fabricating data.
- [ ] **PRESENT-BIND-004**: The system shall require fixed-key `CaptainTurnOutput` contract fields and shall treat missing required keys as input contract violations.
- [ ] **PRESENT-BIND-005**: The system shall normalize validated command-log and projection payloads into shared client presentation-state slices before React and scene adapters consume updates.
- [ ] **PRESENT-BIND-006**: Before strict fixed-key validation, the system shall apply a fallback shaping layer that populates required output keys with safe empty/default values when possible.
- [ ] **PRESENT-BIND-007**: The Vite development server shall bind to a local-network host interface (non-loopback) so the app is reachable via local IP in addition to localhost aliases.
- [ ] **PRESENT-BIND-008**: The Vite development server shall use fixed port `5156` with strict-port behavior and shall not auto-fallback to alternate ports.
- [ ] **PRESENT-BIND-009**: The system shall load bridge crew roster data from local JSON definition keyed by crew member records.
- [ ] **PRESENT-BIND-010**: When a command-log line includes a dialog speaker token, the system shall resolve that token against crew-definition dialog handles and canonical crew fields before applying crew-tag typography.
- [ ] **PRESENT-BIND-011**: The production build configuration shall accept repository-scoped base-path override input for static hosting targets such as GitHub Pages project sites.
- [ ] **PRESENT-BIND-012**: The repository shall include a GitHub Actions workflow that builds browser assets and deploys the generated `dist` artifact to GitHub Pages in the same repository.

## Chakra Provider and Alias Integration

- [ ] **PRESENT-CHAKRA-001**: The system shall wrap the full app shell in exactly one root provider exported as `Provider` from `@/components/ui/provider`.
- [ ] **PRESENT-CHAKRA-002**: If `@/components/ui/provider` module path or required `Provider` export is missing, then startup/build shall fail with explicit configuration error.
- [ ] **PRESENT-CHAKRA-003**: TypeScript and Vite alias resolution for `@/*` shall resolve to the same source-root mapping.
- [ ] **PRESENT-CHAKRA-004**: The Vite tsconfig-path synchronization plugin shall be configured in Vite plugin chain for alias-based imports used by presentation/provider modules.
- [ ] **PRESENT-CHAKRA-005**: Where Chakra component defaults conflict with documented presentation visual constraints, configured project styling policy shall take precedence.
- [ ] **PRESENT-CHAKRA-006**: Chakra control events shall be adapted to existing presentation view-model value contracts for provider/model ids and key-replacement input text.
- [ ] **PRESENT-CHAKRA-007**: If provider/model option catalogs are unavailable, then related selectors shall render disabled with deterministic placeholder state until valid options are available.
- [ ] **PRESENT-CHAKRA-008**: Presentation components shall render Chakra primitives instead of raw HTML elements wherever Chakra-equivalent primitives are available.
- [ ] **PRESENT-CHAKRA-009**: Raw HTML elements in presentation components shall be limited to required DOM integration points (for example Three.js mount/ref surfaces) where Chakra abstraction is not viable.
- [ ] **PRESENT-CHAKRA-010**: The Chakra theme system shall define reusable text styles named `body`, `caption`, and `header`.
- [ ] **PRESENT-CHAKRA-011**: Presentation text shall use `body` text style by default; header text shall use `header`, and command-log speaker captions shall use `caption`.

## Command Log Rendering

- [ ] **PRESENT-LOG-001**: The system shall render command-log sections in canonical order from `CaptainTurnOutput`.
- [ ] **PRESENT-LOG-002**: The system shall preserve crew role attribution and provided reason references in rendered command-log entries.
- [ ] **PRESENT-LOG-003**: For identical `CaptainTurnOutput` inputs, the system shall render identical structural command-log output ordering.
- [ ] **PRESENT-LOG-004**: The left command pane shall render sections in fixed top-to-bottom order: Settings accordion, simulation time, bridge crew list, command log, captain command input form.
- [ ] **PRESENT-LOG-005**: The bridge crew list shall render each roster entry with `name`, `rank`, and `position` fields from crew-definition JSON.
- [ ] **PRESENT-LOG-006**: The system shall render crew typography with shared `CrewTag` component, using full identity output for roster contexts and reduced compact identity output for resolved crew dialog lines in command log.
- [ ] **PRESENT-LOG-007**: The bridge crew section shall render behind a dedicated collapsible accordion item in the command pane.
- [ ] **PRESENT-LOG-008**: The bridge crew list shall use `CrewInfo` item typography with explicit visual hierarchy and spacing between identity line (rank + name) and duty-position line.
- [ ] **PRESENT-LOG-009**: For resolved crew dialog lines, command-log rendering shall structurally separate speaker-tag block from message-text block so speaker identity is visually distinct from dialog content.
- [ ] **PRESENT-LOG-010**: Command-log compact crew tags shall render abbreviated rank, last name only, and crew position in that order.

## Tactical and Status Projections

- [ ] **PRESENT-PROJ-001**: The system shall render tactical wireframe projection from canonical simulation snapshot projection data and shall not source tactical facts from non-canonical inputs.
- [ ] **PRESENT-PROJ-002**: The system shall render systems/status panels from canonical ship and mission projection data using consistent threshold bands and labels.
- [ ] **PRESENT-PROJ-003**: Where current turn output includes trace-linked entities, the system shall highlight corresponding entities/subsystems in projections when they are present in projection data.
- [ ] **PRESENT-PROJ-004**: If trace-linked highlights reference missing or stale projection entities, then the system shall suppress misleading highlights and render stale/unavailable indication.
- [ ] **PRESENT-PROJ-005**: The system shall update tactical scene graph state through presentation adapters that consume normalized projection slices rather than raw transport payloads.
- [ ] **PRESENT-PROJ-006**: The system shall render tactical solar-system projection from canonical system payload containing system name, handedness, star metadata, and planet orbit metadata.
- [ ] **PRESENT-PROJ-007**: The system shall render ship tactical position as a labeled marker with heading-and-speed vector derived from canonical ship kinematics payload.
- [ ] **PRESENT-PROJ-008**: The system shall render each planet orbit as wireframe ellipse-line geometry using canonical orbit `radiusX` and `radiusY` values.
- [ ] **PRESENT-PROJ-009**: The system shall support tactical camera pan and bounded zoom interactions without mutating canonical simulation/projection state.
- [ ] **PRESENT-PROJ-010**: The system shall load tactical solar-system definitions from local JSON files keyed by canonical `system.id`.
- [ ] **PRESENT-PROJ-011**: If tactical solar-system JSON for canonical `system.id` is missing or malformed, then the system shall render tactical unavailable/degraded notice and shall not fabricate star/planet/orbit geometry.
- [ ] **PRESENT-PROJ-012**: If canonical ship tactical payload is invalid or incomplete, then the system shall suppress ship vector rendering, retain valid non-ship tactical geometry, and render ship-kinematics unavailable notice.
- [ ] **PRESENT-PROJ-013**: If system handedness is `clockwise`, then tactical orbit progression shall use negative angular progression; if handedness is `counterclockwise`, then tactical orbit progression shall use positive angular progression.
- [ ] **PRESENT-PROJ-014**: Pan and zoom interactions shall mutate only tactical camera transform state and shall not mutate canonical tactical entity coordinates or metadata.
- [ ] **PRESENT-PROJ-015**: The system shall render tactical projection in a three-dimensional scene with perspective camera framing for star, planets, ship marker, and orbit geometry.
- [ ] **PRESENT-PROJ-016**: The system shall render ship position from canonical 3D coordinates (`x`, `y`, `z`) and shall align heading/speed vector to that 3D frame.
- [ ] **PRESENT-PROJ-017**: The system shall render prior ship positions as a connected tactical trail line ordered oldest-to-newest.
- [ ] **PRESENT-PROJ-018**: The system shall retain ship trail history with bounded length and shall discard oldest points when capacity is exceeded.
- [ ] **PRESENT-PROJ-019**: If ship trail payload is invalid or missing while current ship kinematics are valid, then the system shall suppress trail rendering only and shall preserve ship marker/vector rendering with trail-unavailable notice.
- [ ] **PRESENT-PROJ-020**: Camera pan/zoom interactions in tactical mode shall not append, reorder, or otherwise mutate ship trail history state.
- [ ] **PRESENT-PROJ-021**: When current ship position payload is valid, the tactical camera focal target shall be centered on the ship position each render frame.
- [ ] **PRESENT-PROJ-022**: Tactical pointer-drag controls shall orbit camera azimuth/polar angles around the ship-centered focal target, and wheel zoom shall change only orbital camera radius.
- [ ] **PRESENT-PROJ-023**: Camera-orbit interaction state changes shall not mutate canonical tactical entity positions, labels, orbit geometry, ship vector inputs, or ship trail history.
- [ ] **PRESENT-PROJ-024**: The system shall render status view ship as an orbitable and zoomable 3D wireframe using canonical ship-definition payload geometry.
- [ ] **PRESENT-PROJ-025**: The system shall render configured important points as labeled markers at canonical 3D coordinates on the status ship wireframe.
- [ ] **PRESENT-PROJ-026**: The system shall render status metadata fields from canonical ship-definition payload including `size`, `maxSpeed`, `armament`, `crewSize`, and `launchableVessels`.
- [ ] **PRESENT-PROJ-027**: The system shall load status ship definitions from local JSON files keyed by canonical ship id.
- [ ] **PRESENT-PROJ-028**: If status ship-definition JSON is missing or malformed, then the system shall render status unavailable/degraded notice and shall not fabricate ship wireframe, labels, or metadata output.
- [ ] **PRESENT-PROJ-029**: Status pointer-drag controls shall orbit camera azimuth/polar around status ship focal target, and status wheel zoom shall change only orbital camera radius.
- [ ] **PRESENT-PROJ-030**: Status camera-orbit interaction state changes shall not mutate canonical ship wireframe geometry, important-point coordinates, or status metadata values loaded from ship-definition payload.
- [ ] **PRESENT-PROJ-031**: Tactical camera orbit state shall persist camera pose across tactical component remount and tactical/status mode switching.
- [ ] **PRESENT-PROJ-032**: Status camera orbit state shall persist camera pose across status component remount and tactical/status mode switching.
- [ ] **PRESENT-PROJ-033**: Tactical view shall render a corner reset-camera control that restores tactical default camera pose to top-down ecliptic framing with nearest-planet view.
- [ ] **PRESENT-PROJ-034**: Status view shall render a corner reset-camera control that restores status default camera pose to right-angle ship profile with bow-left/stern-right orientation and near-fit zoom.

## Debug Simulation Projection

- [ ] **PRESENT-DBG-001**: The system shall render an ECS debug view mode parallel to tactical and status views.
- [ ] **PRESENT-DBG-002**: The ECS debug view shall list all entities and support expanding each entity entry for details.
- [ ] **PRESENT-DBG-003**: Within an expanded ECS entity, the debug view shall list expandable component sections and render each component's current values.
- [ ] **PRESENT-DBG-004**: ECS debug values shall be derived from canonical simulation runtime state consistent with tactical projection state.
- [ ] **PRESENT-DBG-005**: The system shall render a debug-only LLM trace view mode parallel to tactical, status, ECS debug, and systems debug views.
- [ ] **PRESENT-DBG-006**: The LLM debug view shall list per-turn provider call traces including provider id, model id, phase (`request`, `response`, or `error`), and timestamp.
- [ ] **PRESENT-DBG-007**: The LLM debug view shall render response/error messages from LLM generation attempts without exposing API key material.
- [ ] **PRESENT-DBG-008**: The LLM debug view shall render `systemPrompt`, `messages`, `requestBody`, `responseText`, and `responseBody` payload fields for provider traces and shall attempt pretty-print formatting for embedded JSON response text.
- [ ] **PRESENT-DBG-009**: In development mode, the command pane shall render a debug-only `Run test script` control that executes a local JSON captain-order script.
- [ ] **PRESENT-DBG-010**: Script-run execution shall submit each scripted order sequentially, wait for step completion, and evaluate per-step assertions against updated command-log/system-state conditions.
- [ ] **PRESENT-DBG-011**: Script-run execution shall use the active configured LLM provider/model settings and shall not override scripted turns to a mock provider.
- [ ] **PRESENT-DBG-012**: The system shall render a systems debug view mode parallel to tactical and status views.
- [ ] **PRESENT-DBG-013**: The systems debug view shall list all crewed systems and support expanding each system entry for details.
- [ ] **PRESENT-DBG-014**: Within an expanded systems entry, the debug view shall render assigned crew identity, allowed action descriptors, and internal state snapshot.

## Mode Toggle and Shared Interaction State

- [ ] **PRESENT-MODE-001**: The system shall keep command log primary/visible in all secondary view modes as configured by policy.
- [ ] **PRESENT-MODE-002**: When switching between tactical and status modes, the system shall preserve shared focus anchor when representable in the destination mode.
- [ ] **PRESENT-MODE-003**: If shared focus anchor is not representable in destination mode, then the system shall clear mode-specific focus and preserve turn focus index.
- [ ] **PRESENT-MODE-004**: Mode switching shall not alter turn outcome classification or recompute response-composer outputs.
- [ ] **PRESENT-MODE-005**: If destination projection mode is stale relative to command-log turn snapshot, the system shall allow mode toggle and display stale warning state.
- [ ] **PRESENT-MODE-006**: When switching from tactical mode to status mode and back to tactical mode, the system shall restore prior tactical camera orbit azimuth, polar angle, and zoom radius.
- [ ] **PRESENT-MODE-007**: Tactical camera-orbit persistence for mode switching shall use shared presentation interaction state and shall not be reset by tactical component remount lifecycle.
- [ ] **PRESENT-MODE-008**: In narrow/mobile viewports, the system shall stack command panel and active projection vertically with command panel rendered above the projection pane.
- [ ] **PRESENT-MODE-009**: The projection-mode switcher shall include debug view selection alongside tactical and status modes.
- [ ] **PRESENT-MODE-010**: In development mode, the projection-mode switcher shall include ECS debug, systems debug, and LLM debug selections alongside tactical and status modes.

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
- [ ] **PRESENT-SET-007**: The system shall allow settings edits and save actions from any active tab without writer-lock ownership gating.
- [ ] **PRESENT-SET-008**: On save action, the system shall persist the active tab's provider/model/API key settings payload directly to localStorage.
- [ ] **PRESENT-SET-008A**: For concurrent cross-tab settings saves, the most recent successful localStorage write shall define persisted settings state.
- [ ] **PRESENT-SET-008B**: The system shall not render read-only or ownership-loss notices for settings controls.
- [ ] **PRESENT-SET-008C**: The system shall not render `Claim writer lock` controls in the settings UI.
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
