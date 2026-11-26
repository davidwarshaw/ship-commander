import { create } from "zustand";
import { processTurnTS } from "../core/crewCommandLoop";
import {
  EcsDebugSnapshot,
  SystemDebugSnapshot,
  createSimulationRuntime,
} from "../core/simulationEcs";
import { LLMDebugEvent, PlanningSettings, TurnInput } from "../core/types";
import { getOrderTestScript } from "../testing/orderScriptCatalog";

type LogEntry = { id: string; text: string };
type ViewMode = "tactical" | "status" | "ecs-debug" | "systems-debug" | "llm-debug";
type ShipPosition = { x: number; y: number; z: number };
type TacticalCameraOrbit = { azimuth: number; polar: number; radius: number };
type StatusCameraOrbit = { azimuth: number; polar: number; radius: number };

type CommanderState = {
  sessionTabId: string;
  viewMode: ViewMode;
  commandLog: LogEntry[];
  llmDebugLog: LLMDebugEvent[];
  systemStatus: Record<string, string>;
  simTick: number;
  simulationTimeMinutes: number;
  projectionSnapshotTick: number;
  staleProjection: boolean;
  renderFramesDropped: number;
  activeSystemId: string;
  shipName: string;
  shipPosition: ShipPosition;
  shipTrail: ShipPosition[];
  tacticalCameraOrbit: TacticalCameraOrbit;
  statusCameraOrbit: StatusCameraOrbit;
  shipHeadingRadians: number;
  shipSpeed: number;
  ecsDebugSnapshot: EcsDebugSnapshot;
  systemDebugSnapshot: SystemDebugSnapshot;
  llmSettings: PlanningSettings;
  apiKeyInput: string;
  apiKeyEdited: boolean;
  unsavedLLMSettings: boolean;
  settingsNotice: string | null;
  devScriptRunStatus: "idle" | "running" | "passed" | "failed";
  devScriptRunMessage: string | null;
  initializeSessionLock: () => void;
  setViewMode: (viewMode: ViewMode) => void;
  setLLMProvider: (providerId: string) => void;
  setLLMModel: (modelId: string) => void;
  setLLMApiKeyInput: (apiKey: string) => void;
  saveLLMSettings: () => void;
  submitCommand: (commandText: string) => Promise<void>;
  runDevOrderTestScript: (scriptId?: string) => Promise<void>;
  reportDroppedRenderFrame: () => void;
  setTacticalCameraOrbit: (orbit: TacticalCameraOrbit) => void;
  resetTacticalCameraOrbit: () => void;
  setStatusCameraOrbit: (orbit: StatusCameraOrbit) => void;
  resetStatusCameraOrbit: () => void;
};

const LLM_SETTINGS_KEY = "ship-commander.llm.settings";
const DEFAULT_TACTICAL_CAMERA_ORBIT: TacticalCameraOrbit = {
  azimuth: 0,
  polar: 0.24,
  radius: 7.5,
};
const DEFAULT_STATUS_CAMERA_ORBIT: StatusCameraOrbit = {
  azimuth: Math.PI / 2,
  polar: Math.PI / 2,
  radius: 7,
};
const DEFAULT_LLM_SETTINGS: PlanningSettings = {
  providerId: "mock-local",
  apiKey: "local-dev-key",
  modelId: "mock-v1",
};
const DEFAULT_SHIP_POSITION: ShipPosition = { x: 0, y: 0, z: -4 };
const DEFAULT_SHIP_HEADING_RADIANS = 0.45;
const DEFAULT_SHIP_SPEED = 0.24;
const TICK_INCREMENT_MINUTES = 1;
const PROVIDER_MODELS: Record<string, string[]> = {
  "mock-local": ["mock-v1"],
  "anthropic-claude": ["claude-sonnet-4-6"],
};

function defaultModelForProvider(providerId: string): string {
  const models = PROVIDER_MODELS[providerId];
  return models?.[0] ?? DEFAULT_LLM_SETTINGS.modelId;
}

function sanitizeSettingsCandidate(candidate: unknown): {
  settings: PlanningSettings;
  diagnostics: boolean;
} {
  if (!candidate || typeof candidate !== "object") {
    return { settings: { ...DEFAULT_LLM_SETTINGS }, diagnostics: true };
  }
  const value = candidate as Partial<PlanningSettings>;
  const providerId =
    typeof value.providerId === "string" && PROVIDER_MODELS[value.providerId]
      ? value.providerId
      : DEFAULT_LLM_SETTINGS.providerId;
  const modelId =
    typeof value.modelId === "string" &&
    PROVIDER_MODELS[providerId]?.includes(value.modelId)
      ? value.modelId
      : defaultModelForProvider(providerId);
  const apiKey =
    typeof value.apiKey === "string"
      ? value.apiKey
      : DEFAULT_LLM_SETTINGS.apiKey;
  const diagnostics =
    providerId !== value.providerId ||
    modelId !== value.modelId ||
    typeof value.apiKey !== "string";
  return {
    settings: { providerId, modelId, apiKey },
    diagnostics,
  };
}

function makeTabId() {
  return `tab-${Math.random().toString(36).slice(2, 10)}`;
}

const simulationRuntime = createSimulationRuntime({
  activeSystemId: "sol",
  initialShipPosition: DEFAULT_SHIP_POSITION,
  initialShipHeadingRadians: DEFAULT_SHIP_HEADING_RADIANS,
  initialShipSpeed: DEFAULT_SHIP_SPEED,
  initialSimTick: 0,
});
const initialEcsDebugSnapshot = simulationRuntime.getEcsDebugSnapshot();
const initialSystemDebugSnapshot = simulationRuntime.getSystemDebugSnapshot();

export const useCommanderStore = create<CommanderState>((set, get) => ({
  sessionTabId: makeTabId(),
  viewMode: "tactical",
  commandLog: [
    { id: "1", text: "Captain: Hold formation and scan local space." },
    { id: "2", text: "Ops: Acknowledged. Running passive scan sweep." },
  ],
  llmDebugLog: [],
  systemStatus: {
    hull: "100%",
    shields: "92%",
    reactors: "Nominal",
    crewReadiness: "Green",
  },
  simTick: 0,
  simulationTimeMinutes: 0,
  projectionSnapshotTick: 0,
  staleProjection: false,
  renderFramesDropped: 0,
  activeSystemId: "sol",
  shipName: "SCV Aegis",
  shipPosition: { ...DEFAULT_SHIP_POSITION },
  shipTrail: [
    { x: -0.72, y: -0.1, z: -4.34 },
    { x: -0.36, y: -0.05, z: -4.17 },
    { ...DEFAULT_SHIP_POSITION },
  ],
  tacticalCameraOrbit: { ...DEFAULT_TACTICAL_CAMERA_ORBIT },
  statusCameraOrbit: { ...DEFAULT_STATUS_CAMERA_ORBIT },
  shipHeadingRadians: DEFAULT_SHIP_HEADING_RADIANS,
  shipSpeed: DEFAULT_SHIP_SPEED,
  ecsDebugSnapshot: initialEcsDebugSnapshot,
  systemDebugSnapshot: initialSystemDebugSnapshot,
  llmSettings: { ...DEFAULT_LLM_SETTINGS },
  apiKeyInput: "",
  apiKeyEdited: false,
  unsavedLLMSettings: false,
  settingsNotice: null,
  devScriptRunStatus: "idle",
  devScriptRunMessage: null,
  initializeSessionLock: () => {
    try {
      const persisted = window.localStorage.getItem(LLM_SETTINGS_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        const { settings, diagnostics } = sanitizeSettingsCandidate(parsed);
        set({
          llmSettings: settings,
          settingsNotice: diagnostics
            ? "LLM settings normalized from persisted values."
            : null,
        });
      }
    } catch {
      set({
        llmSettings: { ...DEFAULT_LLM_SETTINGS },
        settingsNotice: "LLM settings read failed; loaded defaults.",
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== LLM_SETTINGS_KEY || !event.newValue) return;
      const state = get();
      if (state.unsavedLLMSettings) {
        set({
          settingsNotice:
            "Incoming settings update detected; local unsaved draft preserved.",
        });
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        const { settings, diagnostics } = sanitizeSettingsCandidate(parsed);
        set({
          llmSettings: settings,
          apiKeyInput: "",
          apiKeyEdited: false,
          settingsNotice: diagnostics
            ? "LLM settings normalized from incoming update."
            : null,
        });
      } catch {
        set({
          settingsNotice: "Incoming settings update was invalid and ignored.",
        });
      }
    });
  },
  setViewMode: (viewMode) => {
    set({ viewMode });
  },
  setLLMProvider: (providerId) => {
    if (!PROVIDER_MODELS[providerId]) return;
    const nextModelId = defaultModelForProvider(providerId);
    set((state) => ({
      llmSettings: {
        ...state.llmSettings,
        providerId,
        modelId: nextModelId,
      },
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved.",
    }));
  },
  setLLMModel: (modelId) => {
    const providerId = get().llmSettings.providerId;
    if (!PROVIDER_MODELS[providerId]?.includes(modelId)) return;
    set((state) => ({
      llmSettings: {
        ...state.llmSettings,
        modelId,
      },
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved.",
    }));
  },
  setLLMApiKeyInput: (apiKey) => {
    set({
      apiKeyInput: apiKey,
      apiKeyEdited: true,
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved.",
    });
  },
  saveLLMSettings: () => {
    const state = get();
    const nextSettings: PlanningSettings = {
      ...state.llmSettings,
      apiKey: state.apiKeyEdited ? state.apiKeyInput : state.llmSettings.apiKey,
    };
    try {
      window.localStorage.setItem(
        LLM_SETTINGS_KEY,
        JSON.stringify(nextSettings),
      );
      set({
        llmSettings: nextSettings,
        apiKeyEdited: false,
        apiKeyInput: "",
        unsavedLLMSettings: false,
        settingsNotice: null,
      });
    } catch {
      set({
        llmSettings: nextSettings,
        settingsNotice: "LLM settings save failed; unsaved draft retained.",
        unsavedLLMSettings: true,
      });
    }
  },
  submitCommand: async (commandText) => {
    const trimmed = commandText.trim();
    if (!trimmed) return;
    const now = Date.now();
    const state = get();
    const planningSettings = { ...state.llmSettings };
    const turnInput: TurnInput = {
      turnId: `turn-${now}`,
      captainMessage: trimmed,
      snapshotId: `snap-${state.simTick}`,
      simTick: state.simTick,
      projectionSnapshotTick: state.projectionSnapshotTick,
      generationPolicy: {
        connectivityRequired: true,
      },
      planningSettings,
    };
    const turnOutput = await processTurnTS(turnInput, state.systemStatus);
    const tickSnapshot = simulationRuntime.advanceTick(TICK_INCREMENT_MINUTES);
    const shipSpeed = Math.sqrt(
      tickSnapshot.shipVelocity.x * tickSnapshot.shipVelocity.x +
        tickSnapshot.shipVelocity.y * tickSnapshot.shipVelocity.y +
        tickSnapshot.shipVelocity.z * tickSnapshot.shipVelocity.z,
    );
    const shipHeadingRadians = Math.atan2(
      tickSnapshot.shipVelocity.z,
      tickSnapshot.shipVelocity.x,
    );
    set((state) => ({
      shipPosition: tickSnapshot.shipPosition,
      shipTrail: [
        ...state.shipTrail,
        tickSnapshot.shipPosition,
      ].slice(-120),
      commandLog: [
        ...state.commandLog,
        { id: `${now}-captain`, text: `Captain: ${trimmed}` },
        ...turnOutput.commandLogLines.map((text, index) => ({
          id: `${now}-resp-${index}`,
          text,
        })),
      ],
      llmDebugLog: [...state.llmDebugLog, ...turnOutput.llmDebugEvents].slice(
        -200,
      ),
      systemStatus: turnOutput.nextSystemStatus,
      shipHeadingRadians,
      shipSpeed,
      simTick: state.simTick + TICK_INCREMENT_MINUTES,
      simulationTimeMinutes: tickSnapshot.worldTimeMinutes,
      projectionSnapshotTick: state.simTick + TICK_INCREMENT_MINUTES,
      staleProjection: false,
      ecsDebugSnapshot: simulationRuntime.getEcsDebugSnapshot(),
      systemDebugSnapshot: simulationRuntime.getSystemDebugSnapshot(),
    }));
  },
  runDevOrderTestScript: async (scriptId = "smoke-orders") => {
    if (get().devScriptRunStatus === "running") return;
    const script = getOrderTestScript(scriptId);
    if (!script) {
      set({
        devScriptRunStatus: "failed",
        devScriptRunMessage: `Script "${scriptId}" not found or invalid.`,
      });
      return;
    }

    set({
      devScriptRunStatus: "running",
      devScriptRunMessage: `Running script: ${script.name} (provider: ${get().llmSettings.providerId})`,
    });

    try {
      for (const step of script.steps) {
        const before = get();
        const beforeTick = before.simTick;
        const beforeLogCount = before.commandLog.length;

        await before.submitCommand(step.order);

        if (typeof step.waitMs === "number" && step.waitMs > 0) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, step.waitMs),
          );
        }

        const after = get();
        const newLogEntries = after.commandLog
          .slice(beforeLogCount)
          .map((entry) => entry.text);

        if (
          typeof step.expect?.simTickDeltaAtLeast === "number" &&
          after.simTick - beforeTick < step.expect.simTickDeltaAtLeast
        ) {
          throw new Error(
            `step=${step.id} simTickDelta expected >= ${step.expect.simTickDeltaAtLeast}`,
          );
        }

        if (Array.isArray(step.expect?.commandLogIncludes)) {
          for (const expectedFragment of step.expect.commandLogIncludes) {
            if (
              !newLogEntries.some((line) => line.includes(expectedFragment))
            ) {
              throw new Error(
                `step=${step.id} missing commandLog fragment "${expectedFragment}"`,
              );
            }
          }
        }

        if (step.expect?.systemStatusEquals) {
          for (const [statusKey, expectedValue] of Object.entries(
            step.expect.systemStatusEquals,
          )) {
            if (after.systemStatus[statusKey] !== expectedValue) {
              throw new Error(
                `step=${step.id} systemStatus[${statusKey}] expected "${expectedValue}" got "${after.systemStatus[statusKey] ?? "undefined"}"`,
              );
            }
          }
        }
      }

      set({
        devScriptRunStatus: "passed",
        devScriptRunMessage: `Script "${script.name}" passed.`,
      });
    } catch (error) {
      set({
        devScriptRunStatus: "failed",
        devScriptRunMessage:
          error instanceof Error ? error.message : "Script run failed.",
      });
    }
  },
  reportDroppedRenderFrame: () => {
    set((state) => ({ renderFramesDropped: state.renderFramesDropped + 1 }));
  },
  setTacticalCameraOrbit: (orbit) => {
    set({
      tacticalCameraOrbit: {
        azimuth: orbit.azimuth,
        polar: Math.min(Math.max(orbit.polar, 0.2), Math.PI - 0.2),
        radius: Math.min(Math.max(orbit.radius, 6), 48),
      },
    });
  },
  resetTacticalCameraOrbit: () => {
    set({
      tacticalCameraOrbit: { ...DEFAULT_TACTICAL_CAMERA_ORBIT },
    });
  },
  setStatusCameraOrbit: (orbit) => {
    set({
      statusCameraOrbit: {
        azimuth: orbit.azimuth,
        polar: Math.min(Math.max(orbit.polar, 0.2), Math.PI - 0.2),
        radius: Math.min(Math.max(orbit.radius, 5), 30),
      },
    });
  },
  resetStatusCameraOrbit: () => {
    set({
      statusCameraOrbit: { ...DEFAULT_STATUS_CAMERA_ORBIT },
    });
  },
}));
