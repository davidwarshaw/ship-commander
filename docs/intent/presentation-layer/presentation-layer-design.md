---
parent: high-level-design
prefix: PRESENT
---

# Presentation Layer

## Context and Design Philosophy

This component renders captain-visible turn information through a command-log-first interface with a toggle between tactical wireframe and systems/status projections. It is presentation-authoritative only; all displayed facts originate from canonical turn and simulation outputs.

Design priorities:
- **Command log primacy**: command dialogue is the authoritative interaction surface.
- **Projection consistency**: tactical and status views are synchronized projections of the same canonical post-turn state.
- **Mode-switch continuity**: changing view mode never changes turn semantics or hidden state.
- **Browser-native responsiveness**: rendering and state updates remain stable in a React + Three.js browser runtime.

## Runtime Platform

Iteration 1 implementation targets a browser single-page application:
- **React + TypeScript**: command log, status panels, controls, and app shell
- **Chakra UI**: component primitives and provider-composed UI theming/runtime context
- **Three.js**: tactical wireframe scene rendering
- **Zustand**: shared state boundary for turn output, projection snapshots, focus state, and UI mode
- **Vite**: development/build pipeline and module runtime

## Scope and Boundaries

In scope:
- command log rendering from `CaptainTurnOutput`
- tactical 3D local-space wireframe projection from simulation state
- ship systems/status projection from simulation and crew readiness state
- mode toggle behavior and shared selection/context state
- LLM provider settings controls (provider/model selection and API key entry)
- persistence of LLM provider settings in browser localStorage
- presentation-level error/empty/degraded state handling
- browser client integration points between React view tree, Zustand store slices, and Three.js scene adapters
- Chakra provider integration at root app composition boundary
- Chakra-based control composition for command/settings interactions

Out of scope:
- generation/arbitration/execution decisions
- narrative text composition logic
- simulation-state mutation

## Inputs and Outputs

### Inputs

- `CaptainTurnOutput` blocks and trace-linked metadata
- canonical turn outcome classification from orchestration
- canonical post-turn simulation snapshot/projection models
- ship systems readiness and mission-state projection data
- UI mode policy configuration (default mode, accessibility options)
- available LLM provider/model options for settings controls

### Outputs

- rendered command log timeline
- rendered tactical wireframe scene
- rendered systems/status panels
- synchronized interaction state (selection/focus anchors) across modes
- presentation telemetry events for mode changes and render failures
- stable browser view-model contracts for React components and Three.js adapters
- persisted LLM provider settings (`providerId`, `modelId`, `apiKey`) in localStorage-backed settings state

## Rendering Pipeline

### Stage 1: Data Binding and Validation

Bind incoming output/state payloads to presentation view models:
- verify required log and projection fields
- map source identifiers to stable render keys
- attach diagnostics markers for missing or stale projection inputs
- normalize payloads into Zustand presentation slices before render subscribers consume updates
- apply strict fallback shaping layer that fills required contract keys before strict contract validation

Root composition rules:
- React root wraps app shell with exactly one composed provider (`ChakraProvider`-based wrapper generated from Chakra snippet conventions)
- canonical provider wrapper import path is `@/components/ui/provider` and must export `Provider`
- provider wrapper is imported through path alias mapping used by build and TypeScript configuration
- if provider module path/export contract is missing, build/start fails explicitly (no fallback provider path)

If required command log payload is missing, render operational notice state instead of partial normal output.

### Stage 2: Command Log Rendering

Render ordered turn entries:
- captain input line
- outcome summary
- crew lines by role
- rejected action explanations
- clarification prompts or operational notices

Rendering rules:
- preserve canonical section ordering from `CaptainTurnOutput`
- preserve role attribution and reason-code references where provided
- support deterministic replay rendering from persisted turn output
- render outcome badges/filters from canonical outcome classification when provided, while retaining `CaptainTurnOutput` section content as primary narrative payload

### Stage 3: Tactical and Status Projections

Tactical projection:
- render local-space wireframe entities from canonical snapshot projection model
- apply deterministic symbolization/theme constraints for black-and-white aesthetic
- highlight event-relevant entities referenced in current turn output when available
- update Three.js scene graph through adapter functions that consume normalized store slices rather than raw payloads

Status projection:
- render ship subsystem health/readiness, mission objective state, and crew readiness indicators
- maintain consistent threshold bands and labels across turns

### Stage 4: Mode Toggle and Shared Interaction State

Mode behavior:
- command log remains visible/primary in all modes per policy
- toggling between tactical/status views preserves shared focus anchor where representable
- mode switch does not trigger reclassification or recomposition of turn outcomes
- stale-projection mode toggles remain allowed, with visible stale warning state

Shared interaction state includes:
- selected entity or subsystem
- current turn focus index
- active diagnostics panel state

### Stage 5: LLM Settings Controls and Persistence

Settings controls are rendered in the command panel as a pulldown/input group:
- the entire LLM settings section (controls, settings notices, unsaved-draft helper text) is grouped under a collapsible **Settings** accordion section to reduce command-panel visual load
- provider selector
- model selector scoped to selected provider
- API key input field
- controls may be implemented with Chakra form/select/button primitives while preserving existing behavior contracts
- Chakra control events are adapted to existing view-model contracts (`string` provider/model ids and explicit key-input replacement text)
- where provider/model options are unavailable, selector controls render disabled with deterministic placeholder state until options are valid
- accordion expansion/collapse does not mutate settings state, does not reset drafts, and does not change submit/snapshot semantics
- if accordion collapses while focus is inside settings controls, reopening restores focus to the first invalid/interactive control or provider selector fallback

Settings hydration and validation:
- on initialization, settings hydration validates provider id/model id against available provider/model catalogs
- malformed or unsupported persisted values are replaced with configured defaults and flagged with a settings diagnostics notice
- if selected provider changes and existing selected model is not supported by that provider, model is reset to provider default before save
- corrected hydrated/defaulted values are visible immediately when settings accordion is reopened
- provider change applies model-compatibility reset immediately in draft state (not deferred until save)

Persistence rules:
- settings are written to browser localStorage using fixed settings keys
- API key is masked in the UI input presentation
- API key remains plaintext at rest in localStorage for iteration 1 browser-only runtime
- API key is excluded from command log lines, diagnostics output, and telemetry payloads

Mutation authority:
- only writer-lock owner tabs may save settings to shared localStorage settings keys
- non-owner tabs render settings as read-only and may observe cross-tab updates through storage events
- if ownership is lost before or during save, save is rejected and a read-only operational notice is rendered
- non-owner edit attempts are blocked in UI controls and do not mutate in-memory settings draft
- if ownership is lost mid-interaction, active edits are retained as unsaved local draft and save path remains blocked until ownership is reacquired
- ownership-loss/read-only notices are rendered inside the Settings accordion section

Cross-tab ordering and merge rules:
- storage-event updates are ignored while owner tab has unsaved local settings edits; owner may save or reset to incoming values
- settings snapshot capture for command submit occurs before applying any pending cross-tab storage event updates
- submit uses the local current settings value at capture instant and remains immutable for that turn
- unsaved local draft values are the source of submit-time capture even when accordion is collapsed
- accordion toggle events do not participate in submit snapshot transaction boundary and cannot alter captured settings for in-flight submit

Turn-integrity rule:
- presentation/state captures an immutable settings snapshot at command submit and passes that snapshot to planning for the turn
- snapshot capture reads validated in-memory settings values and does not block on localStorage write completion

Persistence representation:
- provider id, model id, and API key are persisted under one serialized settings object key (`ship-commander.llm.settings`) to prevent multi-key partial writes
- hydration ignores unknown fields in persisted payload and validates only required known settings fields
- failed writes do not modify persisted object; in-memory settings remain active with explicit unsaved-state notice
- failed-save unsaved-state notice is rendered inside Settings accordion section

Submit behavior with invalid settings:
- submit remains available in read-only and writer tabs per command-loop behavior policy
- settings preflight validation does not block submit; invalid settings propagate to planning, which emits operational error outcome

API key edit semantics:
- masked key display does not imply replacement
- existing persisted key is preserved unless user explicitly enters replacement key input and saves
- empty key input or unchanged masked placeholder values do not overwrite persisted key
- browser autofill values count as explicit replacement only after user-triggered save action

Accordion defaults:
- Settings accordion defaults to collapsed state on initial render

Focus-anchor mapping rules are shared with simulation/entity taxonomy contract from projection data model; presentation applies mappings but does not define taxonomy semantics.

## Consistency and Freshness Rules

- All visual projections must correspond to the same canonical snapshot associated with displayed turn output.
- If projection data snapshot differs from command-log turn snapshot, display a stale-projection notice and suppress misleading highlights.
- Presentation never synthesizes missing simulation facts; absent data is shown as unavailable/degraded.
- `CaptainTurnOutput` fixed-key contract is required; missing required keys are treated as input contract violations, not compatibility omissions.

## Error Handling

- missing required `CaptainTurnOutput`: render operational failure presentation state
- projection render failure in one mode: preserve command log and alternate mode availability
- stale projection mismatch: render warning and disable turn-linked projection highlights
- telemetry emission failure: do not block captain-visible rendering
- localStorage settings write failure: preserve current in-memory settings state, render operational notice, and avoid partial writes
- localStorage settings read failure (security/quota/runtime exception): load defaults into in-memory settings, render settings-read-failure notice, and continue rendering

No silent substitution of fabricated tactical/status data is allowed.

## Configuration Surface

Runtime configuration includes:
- default secondary mode selection
- accessibility and contrast controls
- wireframe symbolization profile
- stale-data warning policy
- projection highlight policy tied to turn trace references
- operational notice priority policy for top-pinning vs strict section-order rendering
- localStorage keys and defaults for LLM provider settings
- notice-priority policy pinning settings persistence/validity notices above stale-projection warnings when both are present
- TypeScript path alias mapping for provider/snippet imports (`@/* -> ./web/src/*` project mapping)
- Vite tsconfig-path sync plugin for alias resolution in bundler/runtime
- alias mapping for TypeScript and Vite must resolve to the same source roots; mismatches are treated as configuration errors
- Vite path-sync plugin is required in plugin chain and is validated by build-time import resolution checks

Configuration changes rendering behavior, not authoritative turn/simulation semantics.

## Decisions & Alternatives

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Interaction primary surface | Command log first in all modes | Tactical-first with optional log overlay | Log-first preserves core command gameplay and keeps language interaction central. |
| Projection linkage | Shared snapshot consistency across log/tactical/status | Independent refresh cycles per panel | Shared snapshot consistency prevents contradictory captain cues between views. |
| Mode state behavior | Preserve shared focus anchors across mode switches | Reset focus on every mode change | Preserving anchors maintains situational continuity during tactical inspection. |
| Degraded rendering strategy | Explicit unavailable/stale notices | Best-effort inferred visuals | Explicit degraded states avoid presenting false tactical confidence. |
| Browser state model | Zustand shared store | Context-only reducer; Redux Toolkit | Zustand keeps iteration-1 state orchestration lightweight while still supporting shared selectors across React and scene adapters. |
| Scene integration boundary | React shell + Three.js adapter layer | Full imperative Three.js app with React overlays | Adapter boundary keeps UI concerns declarative while isolating scene graph mutation logic. |
| Update cadence | Fixed-step simulation data consumed by decoupled render updates | Render-frame-driven simulation updates | Decoupling protects deterministic turn semantics from frame-rate variability across devices. |
| Settings persistence | localStorage-backed provider settings with writer-lock-gated writes | Session-only memory; unrestricted cross-tab writes | Persistent settings reduce repeated setup friction while writer-lock-gated writes preserve shared-session mutation authority. |

## Open Questions & Future Decisions

### Resolved
1. ✅ Command log remains primary regardless of secondary view mode.
2. ✅ Tactical and status views are projections from canonical state, not independent truth sources.

### Deferred
1. Performance budgeting for dense local-space tactical scenes.
2. Input model for advanced tactical filtering/grouping controls.
3. Screenshot/export policy for turn replay visualization.

## References

- `docs/high-level-design.md`
- `docs/intent/crew-command-loop/crew-command-loop-design.md`
- `docs/intent/response-composer/response-composer-design.md`
