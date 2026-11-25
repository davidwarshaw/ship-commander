import { CrewPlan, LLMDebugEvent, PlanningResult, TurnInput } from "./types";
import { buildCrewPlanSystemPrompt } from "./llmSystemPromptContext";
import { llmProviders } from "./llmProviders";

// @spec LLMGEN-PROMPT-001, LLMGEN-PROMPT-002, LLMGEN-PLAN-001, LLMGEN-PLAN-002, LLMGEN-PROV-001, LLMGEN-PROV-003, LLMGEN-PROV-005, LLMGEN-PROV-007, LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013, LLMGEN-ERR-003, LLMGEN-ERR-004, LLMGEN-ERR-005, LLMGEN-ERR-009, LLMGEN-ERR-010, LLMGEN-ERR-015
export async function generateCrewPlansTS(input: TurnInput): Promise<PlanningResult> {
  const providerId = input.planningSettings.providerId.trim();
  const modelId = input.planningSettings.modelId.trim();
  const debugEvents: LLMDebugEvent[] = [];
  const pushDebug = (phase: LLMDebugEvent["phase"], message: string, payload?: unknown) => {
    debugEvents.push({
      turnId: input.turnId,
      timestamp: Date.now(),
      phase,
      providerId: providerId || "unknown",
      modelId: modelId || "unknown",
      message,
      payload
    });
  };
  const message = input.captainMessage.trim();
  if (!message) {
    return {
      status: "clarification_required",
      plans: [],
      planningClarificationNeeded: true,
      planningOperationalError: false,
      planningReasons: ["EMPTY_COMMAND"],
      debugEvents
    };
  }

  const apiKey = input.planningSettings.apiKey.trim();
  const systemPrompt = buildCrewPlanSystemPrompt();
  pushDebug(
    "request",
    `provider=${providerId} model=${modelId} outputContract=CrewPlan[] systemPrompt=enabled command=${JSON.stringify(message)} connectivityRequired=${Boolean(input.generationPolicy?.connectivityRequired)}`,
    {
      command: message,
      outputContract: "CrewPlan[]",
      systemPrompt,
      connectivityRequired: Boolean(input.generationPolicy?.connectivityRequired)
    }
  );

  if (!providerId || !modelId || !apiKey) {
    pushDebug("error", "MODEL_PROVIDER_UNCONFIGURED");
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_PROVIDER_UNCONFIGURED",
      debugEvents
    };
  }

  const provider = llmProviders(providerId);
  if (!provider) {
    pushDebug("error", "MODEL_PROVIDER_UNREGISTERED");
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_PROVIDER_UNREGISTERED",
      debugEvents
    };
  }

  if (!provider.supportedModels.includes(modelId)) {
    pushDebug("error", `MODEL_UNSUPPORTED supported=[${provider.supportedModels.join(",")}]`);
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_UNSUPPORTED",
      debugEvents
    };
  }

  if (input.generationPolicy?.connectivityRequired && message.toLowerCase().includes("offline")) {
    pushDebug("error", "MODEL_SERVICE_UNREACHABLE");
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_SERVICE_UNREACHABLE",
      debugEvents
    };
  }

  const providerResult = await provider.generatePlans({
    captainMessage: message,
    modelId,
    apiKey,
    systemPrompt
  });
  if (providerResult.status === "error") {
    pushDebug("error", providerResult.reason, providerResult.debug);
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: providerResult.reason,
      debugEvents
    };
  }

  if (providerResult.status === "clarification_required") {
    pushDebug(
      "response",
      `clarification_required reasons=[${providerResult.reasons.join(",")}]`,
      providerResult.debug
    );
    return {
      status: "clarification_required",
      plans: [],
      planningClarificationNeeded: true,
      planningOperationalError: false,
      planningReasons: providerResult.reasons,
      debugEvents
    };
  }

  const plans: CrewPlan[] = providerResult.plans;
  pushDebug("response", `ok planCount=${plans.length}`, providerResult.debug);

  return {
    status: "ok",
    plans,
    planningClarificationNeeded: false,
    planningOperationalError: false,
    planningReasons: [],
    debugEvents
  };
}
