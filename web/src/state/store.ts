import { create } from "zustand";
import { processTurnTS } from "../core/crewCommandLoop";
import { PlanningSettings, TurnInput } from "../core/types";

type LogEntry = { id: string; text: string };
type ViewMode = "tactical" | "status";
type ShipPosition = { x: number; y: number; z: number };
type TacticalCameraOrbit = { azimuth: number; polar: number; radius: number };
type StatusCameraOrbit = { azimuth: number; polar: number; radius: number };

type CommanderState = {
  sessionTabId: string;
  lockOwnerTabId: string | null;
  isLockOwner: boolean;
  viewMode: ViewMode;
  commandLog: LogEntry[];
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
  llmSettings: PlanningSettings;
  apiKeyInput: string;
  apiKeyEdited: boolean;
  unsavedLLMSettings: boolean;
  settingsNotice: string | null;
  initializeSessionLock: () => void;
  claimWriterLock: () => void;
  setViewMode: (viewMode: ViewMode) => void;
  setLLMProvider: (providerId: string) => void;
  setLLMModel: (modelId: string) => void;
  setLLMApiKeyInput: (apiKey: string) => void;
  saveLLMSettings: () => void;
  submitCommand: (commandText: string) => Promise<void>;
  reportDroppedRenderFrame: () => void;
  setTacticalCameraOrbit: (orbit: TacticalCameraOrbit) => void;
  resetTacticalCameraOrbit: () => void;
  setStatusCameraOrbit: (orbit: StatusCameraOrbit) => void;
  resetStatusCameraOrbit: () => void;
};

const SESSION_LOCK_KEY = "ship-commander.session.lock-owner";
const LLM_SETTINGS_KEY = "ship-commander.llm.settings";
const DEFAULT_TACTICAL_CAMERA_ORBIT: TacticalCameraOrbit = { azimuth: 0, polar: 0.24, radius: 7.5 };
const DEFAULT_STATUS_CAMERA_ORBIT: StatusCameraOrbit = { azimuth: Math.PI / 2, polar: Math.PI / 2, radius: 7 };
const DEFAULT_LLM_SETTINGS: PlanningSettings = {
  providerId: "mock-local",
  apiKey: "local-dev-key",
  modelId: "mock-v1"
};
const PROVIDER_MODELS: Record<string, string[]> = {
  "mock-local": ["mock-v1"],
  "anthropic-claude": ["claude-3-5-sonnet-latest"]
};

function defaultModelForProvider(providerId: string): string {
  const models = PROVIDER_MODELS[providerId];
  return models?.[0] ?? DEFAULT_LLM_SETTINGS.modelId;
}

function sanitizeSettingsCandidate(candidate: unknown): { settings: PlanningSettings; diagnostics: boolean } {
  if (!candidate || typeof candidate !== "object") {
    return { settings: { ...DEFAULT_LLM_SETTINGS }, diagnostics: true };
  }
  const value = candidate as Partial<PlanningSettings>;
  const providerId =
    typeof value.providerId === "string" && PROVIDER_MODELS[value.providerId]
      ? value.providerId
      : DEFAULT_LLM_SETTINGS.providerId;
  const modelId =
    typeof value.modelId === "string" && PROVIDER_MODELS[providerId]?.includes(value.modelId)
      ? value.modelId
      : defaultModelForProvider(providerId);
  const apiKey = typeof value.apiKey === "string" ? value.apiKey : DEFAULT_LLM_SETTINGS.apiKey;
  const diagnostics =
    providerId !== value.providerId || modelId !== value.modelId || typeof value.apiKey !== "string";
  return {
    settings: { providerId, modelId, apiKey },
    diagnostics
  };
}

function makeTabId() {
  return `tab-${Math.random().toString(36).slice(2, 10)}`;
}

export const useCommanderStore = create<CommanderState>((set, get) => ({
  sessionTabId: makeTabId(),
  lockOwnerTabId: null,
  isLockOwner: false,
  viewMode: "tactical",
  commandLog: [
    { id: "1", text: "Captain: Hold formation and scan local space." },
    { id: "2", text: "Ops: Acknowledged. Running passive scan sweep." }
  ],
  systemStatus: {
    hull: "100%",
    shields: "92%",
    reactors: "Nominal",
    crewReadiness: "Green"
  },
  simTick: 0,
  simulationTimeMinutes: 0,
  projectionSnapshotTick: 0,
  staleProjection: false,
  renderFramesDropped: 0,
  activeSystemId: "sol",
  shipName: "SCV Aegis",
  shipPosition: { x: 0, y: 0, z: -4 },
  shipTrail: [
    { x: -0.72, y: -0.1, z: -4.34 },
    { x: -0.36, y: -0.05, z: -4.17 },
    { x: 0, y: 0, z: -4 }
  ],
  tacticalCameraOrbit: { ...DEFAULT_TACTICAL_CAMERA_ORBIT },
  statusCameraOrbit: { ...DEFAULT_STATUS_CAMERA_ORBIT },
  shipHeadingRadians: 0.45,
  shipSpeed: 0.24,
  llmSettings: { ...DEFAULT_LLM_SETTINGS },
  apiKeyInput: "",
  apiKeyEdited: false,
  unsavedLLMSettings: false,
  settingsNotice: null,
  initializeSessionLock: () => {
    const tabId = get().sessionTabId;
    const currentOwner = window.localStorage.getItem(SESSION_LOCK_KEY);
    if (!currentOwner) {
      window.localStorage.setItem(SESSION_LOCK_KEY, tabId);
      set({ lockOwnerTabId: tabId, isLockOwner: true });
    } else {
      set({ lockOwnerTabId: currentOwner, isLockOwner: currentOwner === tabId });
    }
    try {
      const persisted = window.localStorage.getItem(LLM_SETTINGS_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        const { settings, diagnostics } = sanitizeSettingsCandidate(parsed);
        set({
          llmSettings: settings,
          settingsNotice: diagnostics ? "LLM settings normalized from persisted values." : null
        });
      }
    } catch {
      set({
        llmSettings: { ...DEFAULT_LLM_SETTINGS },
        settingsNotice: "LLM settings read failed; loaded defaults."
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key === SESSION_LOCK_KEY) {
        const owner = event.newValue;
        set({ lockOwnerTabId: owner, isLockOwner: owner === get().sessionTabId });
        return;
      }
      if (event.key !== LLM_SETTINGS_KEY || !event.newValue) return;
      const state = get();
      if (state.unsavedLLMSettings) {
        set({ settingsNotice: "Incoming settings update detected; local unsaved draft preserved." });
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        const { settings, diagnostics } = sanitizeSettingsCandidate(parsed);
        set({
          llmSettings: settings,
          apiKeyInput: "",
          apiKeyEdited: false,
          settingsNotice: diagnostics ? "LLM settings normalized from incoming update." : null
        });
      } catch {
        set({ settingsNotice: "Incoming settings update was invalid and ignored." });
      }
    });
  },
  claimWriterLock: () => {
    const tabId = get().sessionTabId;
    window.localStorage.setItem(SESSION_LOCK_KEY, tabId);
    set({ lockOwnerTabId: tabId, isLockOwner: true });
  },
  setViewMode: (viewMode) => {
    set({ viewMode });
  },
  setLLMProvider: (providerId) => {
    if (!get().isLockOwner) {
      set({ settingsNotice: "Read-only tab cannot edit LLM settings." });
      return;
    }
    if (!PROVIDER_MODELS[providerId]) return;
    const nextModelId = defaultModelForProvider(providerId);
    set((state) => ({
      llmSettings: {
        ...state.llmSettings,
        providerId,
        modelId: nextModelId
      },
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved."
    }));
  },
  setLLMModel: (modelId) => {
    if (!get().isLockOwner) {
      set({ settingsNotice: "Read-only tab cannot edit LLM settings." });
      return;
    }
    const providerId = get().llmSettings.providerId;
    if (!PROVIDER_MODELS[providerId]?.includes(modelId)) return;
    set((state) => ({
      llmSettings: {
        ...state.llmSettings,
        modelId
      },
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved."
    }));
  },
  setLLMApiKeyInput: (apiKey) => {
    if (!get().isLockOwner) {
      set({ settingsNotice: "Read-only tab cannot edit LLM settings." });
      return;
    }
    set({
      apiKeyInput: apiKey,
      apiKeyEdited: true,
      unsavedLLMSettings: true,
      settingsNotice: "LLM settings draft is unsaved."
    });
  },
  saveLLMSettings: () => {
    const state = get();
    if (!state.isLockOwner) {
      set({ settingsNotice: "Read-only tab cannot save LLM settings." });
      return;
    }
    const owner = window.localStorage.getItem(SESSION_LOCK_KEY);
    if (owner !== state.sessionTabId) {
      set({
        isLockOwner: false,
        lockOwnerTabId: owner,
        settingsNotice: "Writer lock changed; settings save rejected."
      });
      return;
    }
    const nextSettings: PlanningSettings = {
      ...state.llmSettings,
      apiKey: state.apiKeyEdited ? state.apiKeyInput : state.llmSettings.apiKey
    };
    try {
      window.localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(nextSettings));
      set({
        llmSettings: nextSettings,
        apiKeyEdited: false,
        apiKeyInput: "",
        unsavedLLMSettings: false,
        settingsNotice: null
      });
    } catch {
      set({
        llmSettings: nextSettings,
        settingsNotice: "LLM settings save failed; unsaved draft retained.",
        unsavedLLMSettings: true
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
      lockOwnerTabId: state.lockOwnerTabId,
      isLockOwner: state.isLockOwner,
      simTick: state.simTick,
      projectionSnapshotTick: state.projectionSnapshotTick,
      generationPolicy: {
        connectivityRequired: true
      },
      planningSettings
    };
    const turnOutput = await processTurnTS(turnInput, state.systemStatus);
    set((state) => ({
      shipPosition: {
        x: state.shipPosition.x + Math.cos(state.shipHeadingRadians) * state.shipSpeed,
        y: Math.sin((state.simTick + 1) * 0.1) * 0.35,
        z: state.shipPosition.z + Math.sin(state.shipHeadingRadians) * state.shipSpeed
      },
      shipTrail: [
        ...state.shipTrail,
        {
          x: state.shipPosition.x + Math.cos(state.shipHeadingRadians) * state.shipSpeed,
          y: Math.sin((state.simTick + 1) * 0.1) * 0.35,
          z: state.shipPosition.z + Math.sin(state.shipHeadingRadians) * state.shipSpeed
        }
      ].slice(-120),
      commandLog: [
        ...state.commandLog,
        { id: `${now}-captain`, text: `Captain: ${trimmed}` },
        ...turnOutput.commandLogLines.map((text, index) => ({ id: `${now}-resp-${index}`, text }))
      ],
      systemStatus: turnOutput.nextSystemStatus,
      simTick: state.simTick + 1,
      simulationTimeMinutes: state.simulationTimeMinutes + 1,
      projectionSnapshotTick: state.simTick + 1,
      staleProjection: false
    }));
  },
  reportDroppedRenderFrame: () => {
    set((state) => ({ renderFramesDropped: state.renderFramesDropped + 1 }));
  },
  setTacticalCameraOrbit: (orbit) => {
    set({
      tacticalCameraOrbit: {
        azimuth: orbit.azimuth,
        polar: Math.min(Math.max(orbit.polar, 0.2), Math.PI - 0.2),
        radius: Math.min(Math.max(orbit.radius, 6), 48)
      }
    });
  },
  resetTacticalCameraOrbit: () => {
    set({
      tacticalCameraOrbit: { ...DEFAULT_TACTICAL_CAMERA_ORBIT }
    });
  },
  setStatusCameraOrbit: (orbit) => {
    set({
      statusCameraOrbit: {
        azimuth: orbit.azimuth,
        polar: Math.min(Math.max(orbit.polar, 0.2), Math.PI - 0.2),
        radius: Math.min(Math.max(orbit.radius, 5), 30)
      }
    });
  },
  resetStatusCameraOrbit: () => {
    set({
      statusCameraOrbit: { ...DEFAULT_STATUS_CAMERA_ORBIT }
    });
  }
}));
