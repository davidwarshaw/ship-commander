import { ArbitrationResult, ExecutionResult } from "./types";

// @spec SIMEXEC-TX-001, SIMEXEC-COMMIT-003, SIMEXEC-DET-004
export function executeRoundTS(
  arbitration: ArbitrationResult,
  currentSystemStatus: Record<string, string>
): ExecutionResult {
  if (arbitration.operationalError) {
    return {
      status: "error",
      reasonCode: arbitration.operationalErrorReason ?? "ARBITRATION_OPERATIONAL_ERROR",
      transactionStatus: "rolled_back"
    };
  }
  if (arbitration.clarificationNeeded || arbitration.acceptedActions.length === 0) {
    return {
      status: "error",
      reasonCode: "RUNTIME_PRECONDITION_INVALIDATED",
      transactionStatus: "rolled_back"
    };
  }

  const next = { ...currentSystemStatus };
  for (const action of arbitration.acceptedActions) {
    if (action.family === "scan_local_space") {
      next.contacts = "Updated";
    } else if (action.family === "hold_position") {
      next.flightMode = "Hold";
    } else if (action.family === "orbit_planet") {
      const target =
        action.params && typeof action.params.target === "string"
          ? action.params.target
          : "Jupiter";
      next.flightMode = "Orbit";
      next.orbitTarget = target;
    } else if (action.family === "raise_shields") {
      const current = parseInt((next.shields ?? "90").replace("%", ""), 10);
      next.shields = `${Math.min(current + 5, 100)}%`;
    }
  }

  return {
    status: "ok",
    transactionStatus: "committed",
    updatedSystemStatus: next
  };
}

