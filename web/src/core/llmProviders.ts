import { CrewPlan } from "./types";

export type ProviderGenerationRequest = {
  captainMessage: string;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
};

export type ProviderDebugPayload = {
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  responseText?: string;
  responseStatus?: number;
  responseBody?: unknown;
};

export type ProviderGenerationResult =
  | {
      status: "ok";
      plans: CrewPlan[];
      debug?: ProviderDebugPayload;
    }
  | {
      status: "clarification_required";
      reasons: string[];
      debug?: ProviderDebugPayload;
    }
  | {
      status: "error";
      reason: string;
      debug?: ProviderDebugPayload;
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
  generatePlans: async ({ captainMessage, apiKey, systemPrompt }) => {
    const debug: ProviderDebugPayload = {
      systemPrompt,
      messages: [{ role: "user", content: captainMessage }]
    };
    if (!apiKey.trim()) {
      return { status: "error", reason: "PROVIDER_AUTH_REJECTED", debug };
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
    if (message.includes("orbit") && message.includes("jupiter")) {
      plans.push({
        planId: "P-HELM-ORBIT-JUPITER",
        role: "helm",
        goal: "Establish stable orbit around Jupiter.",
        actions: [{ actionId: "A-ORBIT-1", family: "orbit_planet", params: { target: "Jupiter" } }],
        contingencies: [],
        confidence: 0.8,
        rationale: "Explicit orbit directive with target."
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
      return { status: "clarification_required", reasons: ["AMBIGUOUS_INTENT"], debug };
    }

    return { status: "ok", plans, debug };
  }
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_TIMEOUT_MS = 45000;
const ANTHROPIC_MAX_TOKENS = 1200;
const CREW_PLAN_TOOL_NAME = "crew_plan_output";
const CREW_PLAN_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          planId: { type: "string" },
          role: { type: "string" },
          goal: { type: "string" },
          actions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                actionId: { type: "string" },
                family: { type: "string" },
                params: { type: "object" }
              },
              required: ["actionId", "family", "params"]
            }
          },
          contingencies: {
            type: "array",
            items: { type: "string" }
          },
          confidence: { type: "number" },
          rationale: { type: "string" }
        },
        required: ["planId", "role", "goal", "actions", "contingencies", "confidence", "rationale"]
      }
    }
  },
  required: ["plans"]
} as const;

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

// @spec LLMGEN-PROV-008, LLMGEN-PROV-009, LLMGEN-PROV-011, LLMGEN-PROV-013, LLMGEN-PROV-015, LLMGEN-PROV-016, LLMGEN-PROMPT-005, LLMGEN-ERR-011, LLMGEN-ERR-012, LLMGEN-ERR-013, LLMGEN-ERR-014, LLMGEN-ERR-015
const anthropicClaudeProvider: LLMProviderAdapter = {
  id: "anthropic-claude",
  supportedModels: ["claude-sonnet-4-6"],
  generatePlans: async ({ captainMessage, modelId, apiKey, systemPrompt }) => {
    const requestMessages = [{ role: "user", content: `Captain command: ${captainMessage}` }];
    const requestDebug: ProviderDebugPayload = {
      systemPrompt,
      messages: requestMessages
    };
    const parsePayload = (
      payload: { stop_reason?: string; content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }> },
      responseStatus: number,
      requestSystemPrompt: string
    ): ProviderGenerationResult => {
      const debugBase: ProviderDebugPayload = {
        ...requestDebug,
        systemPrompt: requestSystemPrompt,
        responseStatus,
        responseBody: payload
      };
      if (payload.stop_reason === "refusal" || payload.stop_reason === "max_tokens") {
        return { status: "error", reason: "PROVIDER_REFUSAL_OR_TRUNCATED", debug: debugBase };
      }
      const toolUseBlock = payload.content?.find(
        (block) => block.type === "tool_use" && block.name === CREW_PLAN_TOOL_NAME
      );
      if (toolUseBlock && toolUseBlock.input && typeof toolUseBlock.input === "object") {
        const input = toolUseBlock.input as { plans?: unknown };
        if (Array.isArray(input.plans)) {
          return { status: "ok", plans: input.plans as CrewPlan[], debug: debugBase };
        }
        return { status: "error", reason: "PROVIDER_RESPONSE_INVALID", debug: debugBase };
      }
      const textBlock = payload.content?.find((block) => block.type === "text" && typeof block.text === "string");
      if (!textBlock?.text) {
        return { status: "error", reason: "PROVIDER_RESPONSE_INVALID", debug: debugBase };
      }
      const normalized = normalizeClaudeTextToPlans(textBlock.text);
      if (normalized.status === "ok") {
        return { status: "ok", plans: normalized.plans, debug: { ...debugBase, responseText: textBlock.text } };
      }
      return { status: "error", reason: normalized.reason, debug: { ...debugBase, responseText: textBlock.text } };
    };

    const send = async (systemPrompt: string) =>
      fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          system: systemPrompt,
          tools: [
            {
              name: CREW_PLAN_TOOL_NAME,
              description: "Structured CrewPlan output",
              input_schema: CREW_PLAN_TOOL_SCHEMA
            }
          ],
          tool_choice: { type: "tool", name: CREW_PLAN_TOOL_NAME },
          messages: requestMessages
        }),
        signal: controller.signal
      });

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
    try {
      const response = await send(systemPrompt);

      if (response.status === 401 || response.status === 403) {
        return { status: "error", reason: "PROVIDER_AUTH_REJECTED", debug: { ...requestDebug, responseStatus: response.status } };
      }
      if (response.status === 429) {
        return { status: "error", reason: "PROVIDER_RATE_LIMITED", debug: { ...requestDebug, responseStatus: response.status } };
      }
      if (response.status >= 500) {
        return { status: "error", reason: "PROVIDER_UNAVAILABLE", debug: { ...requestDebug, responseStatus: response.status } };
      }
      if (!response.ok) {
        return { status: "error", reason: "PROVIDER_REQUEST_INVALID", debug: { ...requestDebug, responseStatus: response.status } };
      }

      const payload = (await response.json()) as {
        stop_reason?: string;
        content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
      };
      return parsePayload(payload, response.status, systemPrompt);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { status: "error", reason: "PROVIDER_TIMEOUT", debug: requestDebug };
      }
      return { status: "error", reason: "MODEL_SERVICE_UNREACHABLE", debug: requestDebug };
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
