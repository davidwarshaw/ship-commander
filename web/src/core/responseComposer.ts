import { ArbitrationResult, ComposedResponse, ExecutionResult, PlanningResult } from "./types";

// @spec RESPCOMP-CLASS-001, RESPCOMP-NARR-001, RESPCOMP-OUT-004
export function composeTurnResponseTS(
  planning: PlanningResult,
  arbitration: ArbitrationResult,
  execution: ExecutionResult
): ComposedResponse {
  if (planning.planningOperationalError || arbitration.operationalError) {
    return {
      outcomeClassification: "operational_failure",
      outcomeSummary: "Turn failed due to an operational error.",
      crewLines: [],
      clarificationPrompts: [],
      operationalNotices: [planning.planningErrorReason ?? arbitration.operationalErrorReason ?? "OPERATIONAL_FAILURE"]
    };
  }

  if (planning.planningClarificationNeeded || arbitration.clarificationNeeded || execution.reasonCode === "RUNTIME_PRECONDITION_INVALIDATED") {
    return {
      outcomeClassification: "clarification_required",
      outcomeSummary: "Turn requires clarification before execution.",
      crewLines: [],
      clarificationPrompts: [...planning.planningReasons, ...arbitration.unresolvedAmbiguities].filter(Boolean),
      operationalNotices: []
    };
  }

  return {
    outcomeClassification: "completed",
    outcomeSummary: "Turn completed successfully.",
    crewLines: arbitration.acceptedActions.map((a) => `Crew: Executed ${a.family}.`),
    clarificationPrompts: [],
    operationalNotices: []
  };
}

