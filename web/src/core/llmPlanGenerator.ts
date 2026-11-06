import { CrewPlan, PlanningResult, TurnInput } from "./types";
import { llmProviders } from "./llmProviders";

// @spec LLMGEN-PROMPT-001, LLMGEN-PROMPT-002, LLMGEN-PLAN-001, LLMGEN-PLAN-002, LLMGEN-PROV-001, LLMGEN-PROV-003, LLMGEN-PROV-005, LLMGEN-PROV-007, LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013, LLMGEN-ERR-003, LLMGEN-ERR-004, LLMGEN-ERR-005, LLMGEN-ERR-009, LLMGEN-ERR-010, LLMGEN-ERR-015
export async function generateCrewPlansTS(input: TurnInput): Promise<PlanningResult> {
  const message = input.captainMessage.trim();
  if (!message) {
    return {
      status: "clarification_required",
      plans: [],
      planningClarificationNeeded: true,
      planningOperationalError: false,
      planningReasons: ["EMPTY_COMMAND"]
    };
  }

  const providerId = input.planningSettings.providerId.trim();
  const modelId = input.planningSettings.modelId.trim();
  const apiKey = input.planningSettings.apiKey.trim();

  if (!providerId || !modelId || !apiKey) {
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_PROVIDER_UNCONFIGURED"
    };
  }

  const provider = llmProviders(providerId);
  if (!provider) {
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_PROVIDER_UNREGISTERED"
    };
  }

  if (!provider.supportedModels.includes(modelId)) {
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_UNSUPPORTED"
    };
  }

  if (input.generationPolicy?.connectivityRequired && message.toLowerCase().includes("offline")) {
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: "MODEL_SERVICE_UNREACHABLE"
    };
  }

  const providerResult = await provider.generatePlans({ captainMessage: message, modelId, apiKey });
  if (providerResult.status === "error") {
    return {
      status: "error",
      plans: [],
      planningClarificationNeeded: false,
      planningOperationalError: true,
      planningReasons: [],
      planningErrorReason: providerResult.reason
    };
  }

  if (providerResult.status === "clarification_required") {
    return {
      status: "clarification_required",
      plans: [],
      planningClarificationNeeded: true,
      planningOperationalError: false,
      planningReasons: providerResult.reasons
    };
  }

  const plans: CrewPlan[] = providerResult.plans;

  return {
    status: "ok",
    plans,
    planningClarificationNeeded: false,
    planningOperationalError: false,
    planningReasons: []
  };
}
