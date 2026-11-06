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

    # @spec LLMGEN-ERR-003, RESPCOMP-OUT-004
    def test_required_browser_dependencies_declared(self) -> None:
        package_path = REPO_ROOT / "package.json"
        self.assertTrue(package_path.exists(), "package.json missing.")
        package_json = json.loads(package_path.read_text())
        deps = {}
        deps.update(package_json.get("dependencies", {}))
        deps.update(package_json.get("devDependencies", {}))

        for dep in ("react", "react-dom", "three", "zustand", "vite", "typescript"):
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

    # @spec PRESENT-CHAKRA-003, PRESENT-CHAKRA-004
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

    # @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-002
    def test_root_uses_provider_wrapper(self) -> None:
        main_source = (REPO_ROOT / "web" / "src" / "main.tsx").read_text()
        provider_source = (REPO_ROOT / "web" / "src" / "components" / "ui" / "provider.tsx").read_text()
        self.assertIn('from "@/components/ui/provider"', main_source)
        self.assertIn("<Provider>", main_source)
        self.assertIn("ChakraProvider", provider_source)

    # @spec PRESENT-CHAKRA-006, PRESENT-SET-001
    def test_app_uses_chakra_control_primitives(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("@chakra-ui/react", app_source)
        self.assertIn("Button", app_source)
        self.assertIn("Input", app_source)
        self.assertIn("NativeSelect", app_source)
        self.assertNotIn("<Select", app_source)

    # @spec CREWCMD-CORE-006, SIMEXEC-DET-004
    def test_browser_runtime_source_files_exist(self) -> None:
        self.assertTrue((REPO_ROOT / "web" / "src" / "main.tsx").exists(), "Missing web/src/main.tsx.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "App.tsx").exists(), "Missing web/src/App.tsx.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "state" / "store.ts").exists(), "Missing Zustand store module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "tactical" / "TacticalCanvas.tsx").exists(), "Missing Three.js tactical canvas module.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "crewCommandLoop.ts").exists(), "Missing TS crew command loop.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "llmPlanGenerator.ts").exists(), "Missing TS LLM plan generator.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "planValidatorArbiter.ts").exists(), "Missing TS plan validator/arbiter.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "simulationEngine.ts").exists(), "Missing TS simulation engine.")
        self.assertTrue((REPO_ROOT / "web" / "src" / "core" / "responseComposer.ts").exists(), "Missing TS response composer.")

    # @spec CREWCMD-CORE-007, SIMEXEC-DET-004
    def test_store_includes_tab_lock_and_command_driven_tick(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("initializeSessionLock", store_source)
        self.assertIn("claimWriterLock", store_source)
        self.assertIn("SESSION_LOCK_KEY", store_source)
        self.assertIn("simTick", store_source)
        self.assertIn("simulationTimeMinutes", store_source)
        self.assertIn("submitCommand", store_source)
        self.assertIn("viewMode", store_source)
        self.assertIn("processTurnTS", store_source)
        self.assertNotIn("setInterval", store_source)

    # @spec PRESENT-PROJ-005, SIMEXEC-DET-004
    def test_tactical_canvas_consumes_tick_state(self) -> None:
        tactical_source = (REPO_ROOT / "web" / "src" / "tactical" / "TacticalCanvas.tsx").read_text()
        self.assertIn("simTick", tactical_source)
        self.assertIn("reportDroppedRenderFrame", tactical_source)

    # @spec PRESENT-MODE-001, PRESENT-MODE-005
    def test_app_includes_mode_toggle_and_projection_state(self) -> None:
        app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
        self.assertIn("setViewMode", app_source)
        self.assertIn("Projection tick", app_source)
        self.assertIn("Stale projection", app_source)
        self.assertIn("Simulation time", app_source)

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

    # @spec LLMGEN-PROV-001, LLMGEN-PROV-005, LLMGEN-ERR-009
    def test_llm_plan_generator_uses_provider_adapter_dispatch(self) -> None:
        llm_source = (REPO_ROOT / "web" / "src" / "core" / "llmPlanGenerator.ts").read_text()
        self.assertIn("llmProviders", llm_source)
        self.assertIn("planningSettings", llm_source)
        self.assertIn("planningOperationalError", llm_source)

    # @spec LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013
    def test_anthropic_provider_adapter_contract_is_implemented(self) -> None:
        provider_source = (REPO_ROOT / "web" / "src" / "core" / "llmProviders.ts").read_text()
        self.assertIn("anthropic-claude", provider_source)
        self.assertIn("/v1/messages", provider_source)
        self.assertIn("x-api-key", provider_source)
        self.assertIn("anthropic-version", provider_source)
        self.assertIn("max_tokens", provider_source)

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
        self.assertIn("claude-3-5-sonnet-latest", store_source)

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
    def test_store_defines_localstorage_settings_key_and_writer_gated_save(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("ship-commander.llm.settings", store_source)
        self.assertIn("localStorage.getItem", store_source)
        self.assertIn("localStorage.setItem", store_source)
        self.assertIn("isLockOwner", store_source)

    # @spec PRESENT-SET-005A, PRESENT-SET-009, PRESENT-SET-010, PRESENT-ERR-004A
    def test_store_contains_settings_merge_and_snapshot_rules(self) -> None:
        store_source = (REPO_ROOT / "web" / "src" / "state" / "store.ts").read_text()
        self.assertIn("unsaved", store_source)
        self.assertIn("storage", store_source)
        self.assertIn("planningSettings", store_source)


if __name__ == "__main__":
    unittest.main()
