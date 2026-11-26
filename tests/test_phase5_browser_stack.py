from pathlib import Path
import json
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]


class TestPhase5BrowserStack(unittest.TestCase):
    # @spec PRESENT-BIND-005, PRESENT-PROJ-005
    def test_vite_react_ts_project_files_exist(self) -> None:
        self.assertTrue((REPO_ROOT / "package.json").exists(), "Expected package.json for Vite/React project.")
        self.assertTrue((REPO_ROOT / "tsconfig.json").exists(), "Expected tsconfig.json for TypeScript project.")
        self.assertTrue((REPO_ROOT / "vite.config.ts").exists(), "Expected vite.config.ts for Vite configuration.")
        self.assertTrue((REPO_ROOT / "index.html").exists(), "Expected index.html entrypoint for browser runtime.")

    # @spec LLMGEN-ERR-003, RESPCOMP-OUT-004, SIMEXEC-ECS-001
    def test_required_browser_dependencies_declared(self) -> None:
        package_path = REPO_ROOT / "package.json"
        self.assertTrue(package_path.exists(), "package.json missing.")
        package_json = json.loads(package_path.read_text())
        deps = {}
        deps.update(package_json.get("dependencies", {}))
        deps.update(package_json.get("devDependencies", {}))

        for dep in ("react", "react-dom", "three", "zustand", "vite", "typescript", "bitecs"):
            self.assertIn(dep, deps, f"Missing required dependency: {dep}")

    # @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-004
    def test_chakra_dependencies_declared(self) -> None:
        package_path = REPO_ROOT / "package.json"
        package_json = json.loads(package_path.read_text())
        deps = {}
        deps.update(package_json.get("dependencies", {}))
        deps.update(package_json.get("devDependencies", {}))
        self.assertIn("@chakra-ui/react", deps)
        self.assertIn("@emotion/react", deps)
        self.assertIn("vite-tsconfig-paths", deps)

    # @spec PRESENT-CHAKRA-003, PRESENT-CHAKRA-004, PRESENT-BIND-007, PRESENT-BIND-008, PRESENT-BIND-011
    def test_tsconfig_and_vite_include_alias_path_sync(self) -> None:
        tsconfig = json.loads((REPO_ROOT / "tsconfig.json").read_text())
        compiler_options = tsconfig.get("compilerOptions", {})
        self.assertEqual(compiler_options.get("target"), "ESNext")
        self.assertEqual(compiler_options.get("module"), "ESNext")
        self.assertEqual(compiler_options.get("moduleResolution"), "Bundler")
        self.assertTrue(compiler_options.get("skipLibCheck"))
        self.assertIn("paths", compiler_options)
        self.assertEqual(compiler_options["paths"].get("@/*"), ["./web/src/*"])
        vite_source = (REPO_ROOT / "vite.config.ts").read_text()
        self.assertIn("vite-tsconfig-paths", vite_source)
        self.assertIn("tsconfigPaths()", vite_source)
        self.assertIn("server", vite_source)
        self.assertIn("host: true", vite_source)
        self.assertIn("port: 5156", vite_source)
        self.assertIn("strictPort: true", vite_source)
        self.assertIn("VITE_BASE_PATH", vite_source)
        self.assertIn("base:", vite_source)

    # @spec PRESENT-BIND-012
    def test_github_pages_workflow_exists_and_deploys_dist(self) -> None:
        workflow_path = REPO_ROOT / ".github" / "workflows" / "deploy-pages.yml"
        self.assertTrue(workflow_path.exists(), "Expected GitHub Pages deployment workflow.")
        workflow_source = workflow_path.read_text()
        self.assertIn("actions/configure-pages", workflow_source)
        self.assertIn("actions/upload-pages-artifact", workflow_source)
        self.assertIn("actions/deploy-pages", workflow_source)
        self.assertIn("dist", workflow_source)
        self.assertIn("VITE_BASE_PATH", workflow_source)
        self.assertIn("/ship-commander/", workflow_source)

    # @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-002, PRESENT-CHAKRA-010
    def test_root_uses_provider_wrapper(self) -> None:
        main_source = (REPO_ROOT / "web" / "src" / "main.tsx").read_text()
        provider_source = (REPO_ROOT / "web" / "src" / "components" / "ui" / "provider.tsx").read_text()
        system_source = (REPO_ROOT / "web" / "src" / "components" / "ui" / "system.ts").read_text()
        self.assertIn('from "@/components/ui/provider"', main_source)
        self.assertIn("<Provider>", main_source)
        self.assertIn("ChakraProvider", provider_source)
        self.assertIn("shipCommanderSystem", provider_source)
        self.assertIn("textStyles", system_source)
        self.assertIn("body", system_source)
        self.assertIn("caption", system_source)
        self.assertIn("header", system_source)

    # @spec PRESENT-CHAKRA-006, PRESENT-CHAKRA-008, PRESENT-CHAKRA-009, PRESENT-CHAKRA-011, PRESENT-SET-001
    def test_app_uses_chakra_control_primitives(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("@chakra-ui/react", app_source)
        self.assertIn("Box", app_source)
        self.assertIn("Heading", app_source)
        self.assertIn("List.Root", app_source)
        self.assertIn("Text", app_source)
        self.assertIn("Button", app_source)
        self.assertIn("Input", app_source)
        self.assertIn("NativeSelect", app_source)
        self.assertNotIn("<Select", app_source)
        self.assertNotIn("<aside", app_source)
        self.assertNotIn("<main", app_source)
        self.assertNotIn("<h2", app_source)
        self.assertNotIn("<ul", app_source)
        self.assertNotIn("<li", app_source)
        self.assertNotIn("<form", app_source)
        self.assertIn('textStyle="body"', app_source)
        self.assertIn('textStyle="header"', app_source)

    # @spec PRESENT-LOG-006, PRESENT-CHAKRA-008
    def test_crew_tag_uses_chakra_typography(self) -> None:
        crew_tag_source = (REPO_ROOT / "web" / "src" / "components" / "CrewTag.tsx").read_text()
        self.assertIn("@chakra-ui/react", crew_tag_source)
        self.assertIn("Text", crew_tag_source)
        self.assertNotIn("<span", crew_tag_source)

    # @spec CREWCMD-CORE-006, SIMEXEC-DET-004, SIMEXEC-ECS-001
    def test_browser_runtime_source_files_exist(self) -> None:
        self.assertTrue((REPO_ROOT / "web" / "src" / "main.tsx").exists(), "Missing web/src/main.tsx.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "App.tsx").exists(), "Missing web/src/App.tsx.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "state" / "store.ts").exists(), "Missing Zustand store module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "tactical" / "TacticalCanvas.tsx").exists(), "Missing Three.js tactical canvas module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "crewCommandLoop.ts").exists(), "Missing TS crew command loop.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "crewSystems.ts").exists(), "Missing crewed systems module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "llmSystemPromptContext.ts").exists(), "Missing LLM system prompt context module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "llmPlanGenerator.ts").exists(), "Missing TS LLM plan generator.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "planValidatorArbiter.ts").exists(), "Missing TS plan validator/arbiter.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "simulationEngine.ts").exists(), "Missing TS simulation engine.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "simulationEcs.ts").exists(), "Missing TS ECS simulation module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "responseComposer.ts").exists(), "Missing TS response composer.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "testing" / "orderScriptCatalog.ts").exists(), "Missing order-script catalog.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "data" / "test-scripts" / "smoke-orders.json").exists(), "Missing default order test script JSON.")

    # @spec CREWCMD-CORE-007, SIMEXEC-DET-004, SIMEXEC-ECS-002, SIMEXEC-ECS-003, SIMEXEC-ECS-004
    def test_store_includes_command_driven_tick_state(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        simulation_ecs_source = (REPO_ROOT / "web" / "src" / "core" / "simulationEcs.ts").read_text()
        self.assertIn("initializeSessionLock", store_source)
        self.assertIn("simTick", store_source)
        self.assertIn("simulationTimeMinutes", store_source)
        self.assertIn("submitCommand", store_source)
        self.assertIn("viewMode", store_source)
        self.assertIn("processTurnTS", store_source)
        self.assertIn("createSimulationRuntime", store_source)
        self.assertIn("advanceTick", store_source)
        self.assertIn("ecsDebugSnapshot", store_source)
        self.assertIn("systemDebugSnapshot", store_source)
        self.assertIn("applyCrewedSystemsToShip", simulation_ecs_source)
        self.assertIn("getEcsDebugSnapshot", simulation_ecs_source)
        self.assertIn("getSystemDebugSnapshot", simulation_ecs_source)
        self.assertNotIn("setInterval", store_source)

    # @spec CREWCMD-SYS-001, CREWCMD-SYS-002, CREWCMD-SYS-003, CREWCMD-SYS-004, CREWCMD-SYS-005, CREWCMD-SYS-006
    def test_crewed_system_base_and_helm_subclass_contract(self) -> None:
        systems_source = (REPO_ROOT / "web" / "src" / "core" / "crewSystems.ts").read_text()
        self.assertIn("abstract class CrewedSystem", systems_source)
        self.assertIn("registerCrewMemberInCharge", systems_source)
        self.assertIn("listActions", systems_source)
        self.assertIn("formatAssignedCrewMember", systems_source)
        self.assertIn("aliases:", systems_source)
        self.assertIn("dialogHandles", systems_source)
        self.assertIn("updateShipEntity", systems_source)
        self.assertIn("class HelmSystem extends CrewedSystem", systems_source)
        self.assertIn("holdPosition", systems_source)
        self.assertIn("orbitPlanet", systems_source)

    # @spec CREWCMD-CORE-006
    def test_command_loop_has_no_writer_lock_gate(self) -> None:
        command_loop_source = (REPO_ROOT / "web" / "src" / "core" / "crewCommandLoop.ts").read_text()
        self.assertNotIn("Acquire writer lock", command_loop_source)
        self.assertNotIn("isLockOwner", command_loop_source)

    # @spec PRESENT-SET-008C
    def test_settings_do_not_render_claim_lock_action(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertNotIn("claimWriterLock", app_source)
        self.assertNotIn("Claim writer lock", app_source)

    # @spec PRESENT-PROJ-005, SIMEXEC-DET-004
    def test_tactical_canvas_consumes_tick_state(self) -> None:
        tactical_source = (REPO_ROOT / "web" / "src" / "tactical" / "TacticalCanvas.tsx").read_text()
        self.assertIn("simTick", tactical_source)
        self.assertIn("reportDroppedRenderFrame", tactical_source)

    # @spec PRESENT-LOG-004, PRESENT-LOG-005, PRESENT-LOG-007, PRESENT-MODE-001
    def test_app_renders_left_pane_sections_in_required_order(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("Settings", app_source)
        self.assertIn("Simulation time", app_source)
        self.assertIn("Bridge Crew", app_source)
        self.assertIn("Command Log", app_source)
        self.assertIn("Captain command", app_source)
        self.assertIn("crew-list-accordion", app_source)
        self.assertIn('value="crew-list"', app_source)

        settings_index = app_source.find("Settings")
        sim_time_index = app_source.find("Simulation time")
        bridge_crew_index = app_source.find("Bridge Crew")
        command_log_index = app_source.find("Command Log")
        command_input_index = app_source.find("Captain command")

        self.assertLess(settings_index, sim_time_index)
        self.assertLess(sim_time_index, bridge_crew_index)
        self.assertLess(bridge_crew_index, command_log_index)
        self.assertLess(command_log_index, command_input_index)

    # @spec PRESENT-MODE-001, PRESENT-MODE-009, PRESENT-MODE-010, PRESENT-DBG-001
    def test_app_includes_mode_toggle_controls(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("setViewMode", app_source)
        self.assertIn("Tactical", app_source)
        self.assertIn("Status", app_source)
        self.assertIn("ECS Debug", app_source)
        self.assertIn("System Debug", app_source)
        self.assertIn("LLM Debug", app_source)
        self.assertIn("import.meta.env.DEV", app_source)
        self.assertIn("view-mode-toggle", app_source)
        self.assertIn("Run test script", app_source)

    # @spec PRESENT-DBG-001, PRESENT-DBG-002, PRESENT-DBG-003, PRESENT-DBG-004, PRESENT-DBG-005, PRESENT-DBG-006, PRESENT-DBG-007, PRESENT-DBG-008, PRESENT-DBG-012, PRESENT-DBG-013, PRESENT-DBG-014
    def test_debug_views_render_ecs_system_and_llm_diagnostics(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        ecs_debug_source = (REPO_ROOT / "web" / "src" / "debug" / "DebugEcsView.tsx").read_text()
        systems_debug_source = (REPO_ROOT / "web" / "src" / "debug" / "DebugSystemsView.tsx").read_text()
        llm_debug_source = (REPO_ROOT / "web" / "src" / "debug" / "DebugLLMView.tsx").read_text()
        self.assertIn("DebugEcsView", app_source)
        self.assertIn("DebugSystemsView", app_source)
        self.assertIn("DebugLLMView", app_source)
        self.assertIn("ecsDebugSnapshot", ecs_debug_source)
        self.assertIn("entities", ecs_debug_source)
        self.assertIn("components", ecs_debug_source)
        self.assertIn("Accordion.Root", ecs_debug_source)
        self.assertIn("systemDebugSnapshot", systems_debug_source)
        self.assertIn("assignedCrew", systems_debug_source)
        self.assertIn("actions", systems_debug_source)
        self.assertIn("internalState", systems_debug_source)
        self.assertIn("llmDebugLog", llm_debug_source)
        self.assertIn("entries", llm_debug_source)
        self.assertIn("entry.phase", llm_debug_source)
        self.assertIn("systemPrompt", llm_debug_source)
        self.assertIn("messages", llm_debug_source)
        self.assertIn("requestBody", llm_debug_source)
        self.assertIn("responseText", llm_debug_source)
        self.assertIn("tryFormatEmbeddedJson", llm_debug_source)

    # @spec PRESENT-BIND-009, PRESENT-LOG-005, PRESENT-BIND-010
    def test_bridge_crew_catalog_and_json_shape(self) -> None:
        catalog_source = (REPO_ROOT / "web" / "src" / "crew" / "crewCatalog.ts").read_text()
        self.assertIn("bridge-crew.json", catalog_source)
        self.assertIn("name", catalog_source)
        self.assertIn("rank", catalog_source)
        self.assertIn("position", catalog_source)
        self.assertIn("dialogHandles", catalog_source)
        self.assertIn("resolveCrewMemberBySpeakerToken", catalog_source)
        self.assertIn("getBridgeCrewDefinition", catalog_source)

        crew_sample_path = REPO_ROOT / "web" / "src" / "data" / "crew" / "bridge-crew.json"
        crew_sample = json.loads(crew_sample_path.read_text())
        self.assertIn("crew", crew_sample)
        self.assertGreaterEqual(len(crew_sample["crew"]), 1)
        self.assertIn("name", crew_sample["crew"][0])
        self.assertIn("rank", crew_sample["crew"][0])
        self.assertIn("position", crew_sample["crew"][0])
        self.assertIn("dialogHandles", crew_sample["crew"][0])

    # @spec PRESENT-LOG-006, PRESENT-LOG-008, PRESENT-LOG-009, PRESENT-LOG-010, PRESENT-BIND-010
    def test_crew_tag_component_and_command_log_usage(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        crew_tag_source = (REPO_ROOT / "web" / "src" / "components" / "CrewTag.tsx").read_text()
        crew_info_source = (REPO_ROOT / "web" / "src" / "components" / "CrewInfo.tsx").read_text()
        self.assertIn("CrewTag", app_source)
        self.assertIn("CrewInfo", app_source)
        self.assertIn("resolveCrewMemberBySpeakerToken", app_source)
        self.assertIn("split", app_source)
        self.assertIn("Bridge Crew", app_source)
        self.assertIn("Command Log", app_source)
        self.assertIn("variant", crew_tag_source)
        self.assertIn("compact", crew_tag_source)
        self.assertIn("RANK_ABBREVIATIONS", crew_tag_source)
        self.assertIn("split", crew_tag_source)
        self.assertIn("position", crew_tag_source)
        self.assertIn("lastName", crew_tag_source)
        self.assertIn("command-log-line", app_source)
        self.assertIn("command-log-speaker", app_source)
        self.assertIn("command-log-message", app_source)

        self.assertIn("rank", crew_tag_source)
        self.assertIn("name", crew_tag_source)
        self.assertIn("position", crew_tag_source)
        self.assertIn("crew-tag", crew_tag_source)
        self.assertIn("crew-info", crew_info_source)
        self.assertIn("crew-info-identity", crew_info_source)
        self.assertIn("crew-info-position", crew_info_source)

    # @spec PRESENT-MODE-008
    def test_mobile_layout_stacks_command_and_projection_vertically(self) -> None:
        styles_source = (REPO_ROOT / "web" / "src" / "styles.css").read_text()
        self.assertIn("@media (max-width: 900px)", styles_source)
        self.assertIn(".app-shell", styles_source)
        self.assertIn("grid-template-columns: 1fr;", styles_source)
        self.assertIn("grid-template-rows: auto 1fr;", styles_source)

    # @spec LLMGEN-PROV-001, LLMGEN-PROV-005
    def test_llm_provider_adapter_module_exists(self) -> None:
        self.assertTrue(
            (REPO_ROOT / "web" / "src" / "core" / "llmProviders.ts").exists(),
            "Missing provider adapter module for pluggable LLM APIs."
        )

    # @spec LLMGEN-PROV-006, LLMGEN-PROV-007, LLMGEN-OBS-004
    def test_turn_input_includes_immutable_planning_settings_snapshot(self) -> None:
        types_source = (REPO_ROOT / "web" / "src" / "core" / "types.ts").read_text()
        self.assertIn("planningSettings", types_source)
        self.assertIn("providerId", types_source)
        self.assertIn("apiKey", types_source)
        self.assertIn("modelId", types_source)

    # @spec LLMGEN-PROV-001, LLMGEN-PROV-005, LLMGEN-ERR-009, LLMGEN-PROMPT-006
    def test_llm_plan_generator_uses_provider_adapter_dispatch(self) -> None:
        llm_source = (REPO_ROOT / "web" / "src" / "core" / "llmPlanGenerator.ts").read_text()
        self.assertIn("llmProviders", llm_source)
        self.assertIn("planningSettings", llm_source)
        self.assertIn("planningOperationalError", llm_source)
        self.assertIn("buildCrewPlanSystemPrompt", llm_source)
        self.assertIn("systemPrompt", llm_source)

    # @spec LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013, LLMGEN-PROV-015, LLMGEN-PROV-016, LLMGEN-PROMPT-005, LLMGEN-PROMPT-006
    def test_anthropic_provider_adapter_contract_is_implemented(self) -> None:
        provider_source = (REPO_ROOT / "web" / "src" / "core" / "llmProviders.ts").read_text()
        self.assertIn("anthropic-claude", provider_source)
        self.assertIn("/v1/messages", provider_source)
        self.assertIn("x-api-key", provider_source)
        self.assertIn("anthropic-version", provider_source)
        self.assertIn("anthropic-dangerous-direct-browser-access", provider_source)
        self.assertIn("claude-sonnet-4-6", provider_source)
        self.assertIn("max_tokens", provider_source)
        self.assertIn("system: systemPrompt", provider_source)
        self.assertIn("CrewPlan", provider_source)
        self.assertIn("input_schema", provider_source)
        self.assertIn("tool_choice", provider_source)
        self.assertIn("tool_use", provider_source)
        self.assertIn("responseText", provider_source)
        self.assertIn("responseBody", provider_source)
        self.assertIn("systemPrompt", provider_source)

    # @spec LLMGEN-PROMPT-006
    def test_llm_system_prompt_context_includes_game_and_crew_systems(self) -> None:
        prompt_source = (REPO_ROOT / "web" / "src" / "core" / "llmSystemPromptContext.ts").read_text()
        self.assertIn("Game context preamble", prompt_source)
        self.assertIn("bridge planning agent", prompt_source)
        self.assertIn("Crew and assigned systems", prompt_source)
        self.assertIn("aliases:", prompt_source)
        self.assertIn("allowed actions", prompt_source)

    # @spec LLMGEN-VAL-014, LLMGEN-VAL-015, LLMGEN-ERR-010, LLMGEN-ERR-014
    def test_anthropic_response_normalization_rules_are_present(self) -> None:
        provider_source = (REPO_ROOT / "web" / "src" / "core" / "llmProviders.ts").read_text()
        self.assertIn("```json", provider_source)
        self.assertIn("JSON.parse", provider_source)
        self.assertIn("Array.isArray", provider_source)
        self.assertIn("PROVIDER_RESPONSE_INVALID", provider_source)

    # @spec PRESENT-SET-001, LLMGEN-PROV-003
    def test_provider_settings_include_anthropic_option_and_model(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("anthropic-claude", app_source)
        self.assertIn("claude-sonnet-4-6", store_source)

    # @spec PRESENT-SET-001, PRESENT-SET-005, PRESENT-SET-012
    def test_app_includes_llm_settings_controls(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("LLM Provider", app_source)
        self.assertIn("Model", app_source)
        self.assertIn("API Key", app_source)

    # @spec PRESENT-SET-001A, PRESENT-SET-001B, PRESENT-SET-013B
    def test_app_wraps_llm_settings_in_collapsed_accordion(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("Accordion", app_source)
        self.assertIn("Settings", app_source)
        self.assertIn("defaultValue", app_source)
        self.assertIn("[]", app_source)

    # @spec PRESENT-SET-002A, PRESENT-SET-006, PRESENT-SET-007, PRESENT-SET-008
    def test_store_defines_localstorage_settings_key_and_save_path(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("ship-commander.llm.settings", store_source)
        self.assertIn("localStorage.getItem", store_source)
        self.assertIn("localStorage.setItem", store_source)
        self.assertNotIn("SESSION_LOCK_KEY", store_source)
        self.assertNotIn("isLockOwner", store_source)
        self.assertIn("llmDebugLog", store_source)
        self.assertIn("runDevOrderTestScript", store_source)
        self.assertIn("devScriptRunStatus", store_source)
        self.assertIn("provider: ${get().llmSettings.providerId}", store_source)

    # @spec PRESENT-SET-005A, PRESENT-SET-009, PRESENT-SET-010, PRESENT-ERR-004A
    def test_store_contains_settings_merge_and_snapshot_rules(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("unsaved", store_source)
        self.assertIn("storage", store_source)
        self.assertIn("planningSettings", store_source)
        self.assertIn("llmDebugEvents", store_source)

    # @spec PRESENT-DBG-006, PRESENT-DBG-007
    def test_llm_generator_emits_debug_events(self) -> None:
        generator_source = (REPO_ROOT / "web" / "src" / "core" / "llmPlanGenerator.ts").read_text()
        self.assertIn("debugEvents", generator_source)
        self.assertIn("pushDebug", generator_source)
        self.assertIn("request", generator_source)
        self.assertIn("response", generator_source)
        self.assertIn("error", generator_source)
        self.assertIn("outputContract=CrewPlan[]", generator_source)
        self.assertIn("systemPrompt=enabled", generator_source)

    # @spec PRESENT-DBG-009, PRESENT-DBG-010
    def test_dev_order_script_catalog_and_json_shape(self) -> None:
        catalog_source = (REPO_ROOT / "web" / "src" / "testing" / "orderScriptCatalog.ts").read_text()
        self.assertIn("smoke-orders.json", catalog_source)
        self.assertIn("getOrderTestScript", catalog_source)
        self.assertIn("simTickDeltaAtLeast", catalog_source)
        self.assertIn("commandLogIncludes", catalog_source)
        self.assertIn("systemStatusEquals", catalog_source)

        script_sample = json.loads((REPO_ROOT / "web" / "src" / "data" / "test-scripts" / "smoke-orders.json").read_text())
        self.assertIn("id", script_sample)
        self.assertIn("name", script_sample)
        self.assertIn("steps", script_sample)
        self.assertGreaterEqual(len(script_sample["steps"]), 1)
        self.assertIn("order", script_sample["steps"][0])
        self.assertIn("expect", script_sample["steps"][0])
        self.assertIn("commandLogIncludes", script_sample["steps"][0]["expect"])

    # @spec PRESENT-PROJ-006, PRESENT-PROJ-010, PRESENT-PROJ-011
    def test_local_solar_system_json_catalog_exists_with_required_fields(self) -> None:
        catalog_dir = REPO_ROOT / "web" / "src" / "data" / "solar-systems"
        self.assertTrue(catalog_dir.exists(), "Expected local solar-system catalog directory.")
        self.assertTrue(catalog_dir.is_dir(), "Solar-system catalog path must be a directory.")
        system_files = sorted(catalog_dir.glob("*.json"))
        self.assertGreater(len(system_files), 0, "Expected at least one solar-system definition JSON file.")

        sample = json.loads(system_files[0].read_text())
        self.assertIn("id", sample)
        self.assertIn("name", sample)
        self.assertIn("handedness", sample)
        self.assertIn(sample["handedness"], ("clockwise", "counterclockwise"))
        self.assertIn("star", sample)
        self.assertIn("planets", sample)
        self.assertIn("name", sample["star"])
        self.assertIn("size", sample["star"])
        self.assertIsInstance(sample["planets"], list)
        self.assertGreater(len(sample["planets"]), 0)
        planet = sample["planets"][0]
        self.assertIn("name", planet)
        self.assertIn("size", planet)
        self.assertIn("type", planet)
        self.assertIn("orbit", planet)
        self.assertIn("radiusX", planet["orbit"])
        self.assertIn("radiusY", planet["orbit"])

    # @spec PRESENT-PROJ-024, PRESENT-PROJ-025, PRESENT-PROJ-026, PRESENT-PROJ-027, PRESENT-PROJ-028
    def test_local_ship_json_catalog_exists_with_required_fields(self) -> None:
        catalog_dir = REPO_ROOT / "web" / "src" / "data" / "ships"
        self.assertTrue(catalog_dir.exists(), "Expected local ship catalog directory.")
        self.assertTrue(catalog_dir.is_dir(), "Ship catalog path must be a directory.")
        ship_files = sorted(catalog_dir.glob("*.json"))
        self.assertGreater(len(ship_files), 0, "Expected at least one ship definition JSON file.")

        sample = json.loads(ship_files[0].read_text())
        self.assertIn("id", sample)
        self.assertIn("name", sample)
        self.assertIn("size", sample)
        self.assertIn("maxSpeed", sample)
        self.assertIn("armament", sample)
        self.assertIn("crewSize", sample)
        self.assertIn("launchableVessels", sample)
        self.assertIn("wireframe", sample)
        self.assertIn("importantPoints", sample)
        self.assertIn("vertices", sample["wireframe"])
        self.assertIn("edges", sample["wireframe"])

    # @spec PRESENT-PROJ-007, PRESENT-PROJ-008, PRESENT-PROJ-009, PRESENT-PROJ-012, PRESENT-PROJ-014, PRESENT-PROJ-015, PRESENT-PROJ-016, PRESENT-PROJ-017, PRESENT-PROJ-019, PRESENT-PROJ-021, PRESENT-PROJ-022, PRESENT-PROJ-023, PRESENT-PROJ-031, PRESENT-PROJ-033, PRESENT-MODE-006, PRESENT-MODE-007
    def test_tactical_canvas_renders_ship_vector_orbits_and_camera_controls(self) -> None:
        tactical_source = (REPO_ROOT / "web" / "src" / "tactical" / "TacticalCanvas.tsx").read_text()
        self.assertIn("EllipseCurve", tactical_source)
        self.assertIn("BufferGeometry", tactical_source)
        self.assertIn("LineLoop", tactical_source)
        self.assertIn("ArrowHelper", tactical_source)
        self.assertIn("SphereGeometry", tactical_source)
        self.assertIn("shipTrail", tactical_source)
        self.assertIn("trailLine", tactical_source)
        self.assertIn("Line(", tactical_source)
        self.assertIn("wheel", tactical_source)
        self.assertIn("pointer", tactical_source)
        self.assertIn("camera", tactical_source)
        self.assertIn("orbitAzimuth", tactical_source)
        self.assertIn("orbitPolar", tactical_source)
        self.assertIn("orbitDistance", tactical_source)
        self.assertIn("cameraTarget.copy(shipMesh.position)", tactical_source)
        self.assertIn("setTacticalCameraOrbit", tactical_source)
        self.assertIn("savedCameraOrbit", tactical_source)
        self.assertIn("resetTacticalCameraOrbit", tactical_source)
        self.assertIn("Reset Camera", tactical_source)
        self.assertIn("tactical-camera-reset", tactical_source)
        self.assertIn("WebGL context initialization failed", tactical_source)

    # @spec PRESENT-PROJ-024, PRESENT-PROJ-025, PRESENT-PROJ-026, PRESENT-PROJ-028, PRESENT-PROJ-029, PRESENT-PROJ-030, PRESENT-PROJ-032, PRESENT-PROJ-034
    def test_status_ship_view_renders_wireframe_labels_metadata_and_orbit_controls(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        status_source = (REPO_ROOT / "web" / "src" / "status" / "StatusShipView.tsx").read_text()
        self.assertIn("StatusShipView", app_source)
        self.assertIn("LineSegments", status_source)
        self.assertIn("BufferGeometry", status_source)
        self.assertIn("importantPoints", status_source)
        self.assertIn("size", status_source)
        self.assertIn("maxSpeed", status_source)
        self.assertIn("armament", status_source)
        self.assertIn("crewSize", status_source)
        self.assertIn("launchableVessels", status_source)
        self.assertIn("wheel", status_source)
        self.assertIn("pointer", status_source)
        self.assertIn("savedCameraOrbit", status_source)
        self.assertIn("setStatusCameraOrbit", status_source)
        self.assertIn("resetStatusCameraOrbit", status_source)
        self.assertIn("Reset Camera", status_source)
        self.assertIn("status-camera-reset", status_source)

    # @spec PRESENT-PROJ-006, PRESENT-PROJ-007, PRESENT-PROJ-013, PRESENT-PROJ-016, PRESENT-PROJ-017, PRESENT-PROJ-018, PRESENT-PROJ-020, PRESENT-PROJ-031, PRESENT-PROJ-032, PRESENT-MODE-006, PRESENT-MODE-007, PRESENT-DBG-001
    def test_store_exposes_tactical_projection_state(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("activeSystemId", store_source)
        self.assertIn("shipPosition", store_source)
        self.assertIn("shipHeadingRadians", store_source)
        self.assertIn("shipSpeed", store_source)
        self.assertIn("shipTrail", store_source)
        self.assertIn("z", store_source)
        self.assertIn("slice(-", store_source)
        self.assertIn("tacticalCameraOrbit", store_source)
        self.assertIn("setTacticalCameraOrbit", store_source)
        self.assertIn("resetTacticalCameraOrbit", store_source)
        self.assertIn("statusCameraOrbit", store_source)
        self.assertIn("setStatusCameraOrbit", store_source)
        self.assertIn("resetStatusCameraOrbit", store_source)
        self.assertIn('"ecs-debug"', store_source)
        self.assertIn('"systems-debug"', store_source)


if __name__ == "__main__":
    unittest.main()
