import smokeOrders from "../data/test-scripts/smoke-orders.json";
import { OrderTestScript } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOrderTestScript(value: unknown): OrderTestScript | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string" || !Array.isArray(value.steps)) {
    return null;
  }
  const steps = value.steps.map((step) => {
    if (!isRecord(step)) return null;
    if (typeof step.id !== "string" || typeof step.order !== "string") return null;
    if (step.waitMs !== undefined && typeof step.waitMs !== "number") return null;
    if (step.expect !== undefined && !isRecord(step.expect)) return null;
    if (isRecord(step.expect)) {
      if (step.expect.simTickDeltaAtLeast !== undefined && typeof step.expect.simTickDeltaAtLeast !== "number") {
        return null;
      }
      if (
        step.expect.commandLogIncludes !== undefined &&
        (!Array.isArray(step.expect.commandLogIncludes) ||
          !step.expect.commandLogIncludes.every((entry) => typeof entry === "string"))
      ) {
        return null;
      }
      if (
        step.expect.systemStatusEquals !== undefined &&
        (!isRecord(step.expect.systemStatusEquals) ||
          !Object.values(step.expect.systemStatusEquals).every((entry) => typeof entry === "string"))
      ) {
        return null;
      }
    }
    return {
      id: step.id,
      order: step.order,
      waitMs: typeof step.waitMs === "number" ? step.waitMs : undefined,
      expect: isRecord(step.expect)
        ? {
            simTickDeltaAtLeast:
              typeof step.expect.simTickDeltaAtLeast === "number" ? step.expect.simTickDeltaAtLeast : undefined,
            commandLogIncludes: Array.isArray(step.expect.commandLogIncludes)
              ? step.expect.commandLogIncludes.filter((entry): entry is string => typeof entry === "string")
              : undefined,
            systemStatusEquals: isRecord(step.expect.systemStatusEquals)
              ? Object.fromEntries(
                  Object.entries(step.expect.systemStatusEquals).filter(
                    ([, statusValue]) => typeof statusValue === "string"
                  )
                )
              : undefined
          }
        : undefined
    };
  });
  if (steps.some((step) => step === null)) return null;
  return {
    id: value.id,
    name: value.name,
    steps: steps as OrderTestScript["steps"]
  };
}

const ORDER_TEST_SCRIPTS: Record<string, unknown> = {
  "smoke-orders": smokeOrders
};

// @spec PRESENT-DBG-009, PRESENT-DBG-010
export function getOrderTestScript(scriptId: string): OrderTestScript | null {
  return parseOrderTestScript(ORDER_TEST_SCRIPTS[scriptId]);
}
