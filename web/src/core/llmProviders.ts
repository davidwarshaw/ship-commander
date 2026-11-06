import { CrewPlan } from "./types";

export type ProviderGenerationRequest = {
  captainMessage: string;
  modelId: string;
  apiKey: string;
};

export type ProviderGenerationResult =
  | {
      status: "ok";
      plans: CrewPlan[];
    }
  | {
      status: "clarification_required";
      reasons: string[];
    }
  | {
      status: "error";
      reason: string;
    };

export type LLMProviderAdapter = {
  id: string;
  supportedModels: string[];
  generatePlans: (request: ProviderGenerationRequest) => Promise<ProviderGenerationResult>;
};

function isProviderAdapter(value: unknown): value is LLMProviderAdapter {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LLMProviderAdapter>;
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.supportedModels) &&
    typeof candidate.generatePlans === "function"
  );
}

const mockLocalProvider: LLMProviderAdapter = {
  id: "mock-local",
  supportedModels: ["mock-v1"],
  generatePlans: async ({ captainMessage, apiKey }) => {
    if (!apiKey.trim()) {
      return { status: "error", reason: "PROVIDER_AUTH_REJECTED" };
    }

    const message = captainMessage.trim().toLowerCase();
    const plans: CrewPlan[] = [];
    if (message.includes("scan")) {
      plans.push({
        planId: "P-OPS-SCAN",
        role: "operations",
        goal: "Acquire local contact data.",
        actions: [{ actionId: "A-SCAN-1", family: "scan_local_space", params: {} }],
        contingencies: [],
        confidence: 0.84,
        rationale: "Direct scan directive."
      });
    }
    if (message.includes("hold")) {
      plans.push({
        planId: "P-HELM-HOLD",
        role: "helm",
        goal: "Maintain current position and profile.",
        actions: [{ actionId: "A-HOLD-1", family: "hold_position", params: {} }],
        contingencies: [],
        confidence: 0.82,
        rationale: "Formation hold requested."
      });
    }
    if (message.includes("raise shields") || message.includes("shields up")) {
      plans.push({
        planId: "P-ENG-SHIELD",
        role: "engineering",
        goal: "Increase shield strength.",
        actions: [{ actionId: "A-SHIELD-1", family: "raise_shields", params: { amount: 5 } }],
        contingencies: [],
        confidence: 0.78,
        rationale: "Defensive posture directive."
      });
    }

    if (plans.length === 0) {
      return { status: "clarification_required", reasons: ["AMBIGUOUS_INTENT"] };
    }

    return { status: "ok", plans };
  }
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_TIMEOUT_MS = 15000;
const ANTHROPIC_MAX_TOKENS = 600;

// @spec LLMGEN-VAL-014, LLMGEN-VAL-015, LLMGEN-ERR-010
function normalizeClaudeTextToPlans(text: string): ProviderGenerationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: "error", reason: "PROVIDER_RESPONSE_INVALID" };
  }
  const fencePrefix = "```json";
  const fenceSuffix = "```";
  const candidate =
    trimmed.startsWith(fencePrefix) && trimmed.endsWith(fenceSuffix)
      ? trimmed.slice(fencePrefix.length, trimmed.length - fenceSuffix.length).trim()
      : trimmed;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!Array.isArray(parsed)) {
      return { status: "error", reason: "PROVIDER_RESPONSE_INVALID" };
    }
    return { status: "ok", plans: parsed as CrewPlan[] };
  } catch {
    return { status: "error", reason: "PROVIDER_RESPONSE_INVALID" };
  }
}

// @spec LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013, LLMGEN-ERR-011, LLMGEN-ERR-012, LLMGEN-ERR-013, LLMGEN-ERR-014, LLMGEN-ERR-015
const anthropicClaudeProvider: LLMProviderAdapter = {
  id: "anthropic-claude",
  supportedModels: ["claude-3-5-sonnet-latest"],
  generatePlans: async ({ captainMessage, modelId, apiKey }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          messages: [
            {
              role: "user",
              content: `Return only JSON array of CrewPlan objects for command: ${captainMessage}`
            }
          ]
        }),
        signal: controller.signal
      });

      if (response.status === 401 || response.status === 403) {
        return { status: "error", reason: "PROVIDER_AUTH_REJECTED" };
      }
      if (response.status === 429) {
        return { status: "error", reason: "PROVIDER_RATE_LIMITED" };
      }
      if (response.status >= 500) {
        return { status: "error", reason: "PROVIDER_UNAVAILABLE" };
      }
      if (!response.ok) {
        return { status: "error", reason: "PROVIDER_REQUEST_INVALID" };
      }

      const payload = (await response.json()) as {
        stop_reason?: string;
        content?: Array<{ type?: string; text?: string }>;
      };
      if (payload.stop_reason === "refusal" || payload.stop_reason === "max_tokens") {
        return { status: "error", reason: "PROVIDER_REFUSAL_OR_TRUNCATED" };
      }
      const textBlock = payload.content?.find((block) => block.type === "text" && typeof block.text === "string");
      if (!textBlock?.text) {
        return { status: "error", reason: "PROVIDER_RESPONSE_INVALID" };
      }
      return normalizeClaudeTextToPlans(textBlock.text);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { status: "error", reason: "PROVIDER_TIMEOUT" };
      }
      return { status: "error", reason: "MODEL_SERVICE_UNREACHABLE" };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
};

const providerRegistry: Record<string, unknown> = {
  "mock-local": mockLocalProvider,
  "anthropic-claude": anthropicClaudeProvider
};

// @spec LLMGEN-PROV-001, LLMGEN-PROV-002, LLMGEN-PROV-005
export function llmProviders(providerId: string): LLMProviderAdapter | null {
  const adapter = providerRegistry[providerId];
  if (!isProviderAdapter(adapter)) return null;
  return adapter;
}
