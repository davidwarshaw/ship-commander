export type PlanningSettings = {
  providerId: string;
  apiKey: string;
  modelId: string;
};

export type LLMDebugEvent = {
  turnId: string;
  timestamp: number;
  phase: "request" | "response" | "error";
  providerId: string;
  modelId: string;
  message: string;
  payload?: unknown;
};

export type TurnInput = {
  turnId: string;
  captainMessage: string;
  snapshotId: string;
  simTick: number;
  projectionSnapshotTick: number;
  planningSettings: PlanningSettings;
  generationPolicy?: {
    connectivityRequired?: boolean;
  };
};

export type CrewAction = {
  actionId: string;
  family: string;
  params: Record<string, unknown>;
};

export type CrewPlan = {
  planId: string;
  role: string;
  goal: string;
  actions: CrewAction[];
  contingencies: string[];
  confidence: number;
  rationale: string;
  clarificationOnly?: boolean;
};

export type PlanningResult = {
  status: "ok" | "error" | "clarification_required";
  plans: CrewPlan[];
  planningClarificationNeeded: boolean;
  planningOperationalError: boolean;
  planningReasons: string[];
  planningErrorReason?: string;
  debugEvents: LLMDebugEvent[];
};

export type ArbitrationResult = {
  status: "ok" | "error";
  acceptedActions: CrewAction[];
  rejectedActions: Array<{ actionId?: string; planId: string; reasonCode: string }>;
  clarificationNeeded: boolean;
  unresolvedAmbiguities: string[];
  operationalError: boolean;
  operationalErrorReason?: string;
};

export type ExecutionResult = {
  status: "ok" | "error";
  reasonCode?: string;
  transactionStatus: "committed" | "rolled_back";
  updatedSystemStatus?: Record<string, string>;
};

export type ComposedResponse = {
  outcomeClassification: "completed" | "clarification_required" | "operational_failure";
  outcomeSummary: string;
  crewLines: string[];
  clarificationPrompts: string[];
  operationalNotices: string[];
};
