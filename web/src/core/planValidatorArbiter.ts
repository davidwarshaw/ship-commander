import { ArbitrationResult, CrewAction, PlanningResult } from "./types";

const ROLE_PERMISSIONS: Record<string, string[]> = {
  operations: ["scan_local_space"],
  helm: ["hold_position"],
  engineering: ["raise_shields"]
};

// @spec PLANARB-PERM-001, PLANARB-PERM-002, PLANARB-ARB-005, PLANARB-CLAR-001, PLANARB-OBS-005
export function validateAndArbitrateTS(planning: PlanningResult): ArbitrationResult {
  if (planning.status !== "ok") {
    return {
      status: "ok",
      acceptedActions: [],
      rejectedActions: [],
      clarificationNeeded: planning.planningClarificationNeeded,
      unresolvedAmbiguities: planning.planningReasons,
      operationalError: planning.planningOperationalError,
      operationalErrorReason: planning.planningErrorReason
    };
  }

  const acceptedActions: CrewAction[] = [];
  const rejectedActions: Array<{ actionId?: string; planId: string; reasonCode: string }> = [];

  for (const plan of planning.plans) {
    const allowed = new Set(ROLE_PERMISSIONS[plan.role] ?? []);
    let acceptedFromPlan = 0;
    for (const action of plan.actions) {
      if (!allowed.has(action.family)) {
        rejectedActions.push({
          actionId: action.actionId,
          planId: plan.planId,
          reasonCode: "ROLE_PERMISSION_DENIED"
        });
        continue;
      }
      acceptedActions.push(action);
      acceptedFromPlan += 1;
    }
    if (plan.actions.length > 0 && acceptedFromPlan === 0) {
      rejectedActions.push({ planId: plan.planId, reasonCode: "PLAN_EMPTY_AFTER_VALIDATION" });
    }
  }

  return {
    status: "ok",
    acceptedActions,
    rejectedActions,
    clarificationNeeded: acceptedActions.length === 0,
    unresolvedAmbiguities: acceptedActions.length === 0 ? ["NO_SAFE_ACTION_SET"] : [],
    operationalError: false
  };
}

