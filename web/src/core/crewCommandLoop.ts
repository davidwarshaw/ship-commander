import { composeTurnResponseTS } from "./responseComposer";
import { executeRoundTS } from "./simulationEngine";
import { generateCrewPlansTS } from "./llmPlanGenerator";
import { validateAndArbitrateTS } from "./planValidatorArbiter";
import { LLMDebugEvent, TurnInput } from "./types";

export type TurnOutput = {
  outcomeClassification: "completed" | "clarification_required" | "operational_failure";
  commandLogLines: string[];
  nextSystemStatus: Record<string, string>;
  llmDebugEvents: LLMDebugEvent[];
};

// @spec CREWCMD-CORE-006, CREWCMD-CORE-007, CREWCMD-PLAN-008, CREWCMD-ARB-011
export async function processTurnTS(
  input: TurnInput,
  currentSystemStatus: Record<string, string>
): Promise<TurnOutput> {
  const planning = await generateCrewPlansTS(input);
  const arbitration = validateAndArbitrateTS(planning);
  const execution = executeRoundTS(arbitration, currentSystemStatus);
  const response = composeTurnResponseTS(planning, arbitration, execution);

  const lines: string[] = [response.outcomeSummary];
  lines.push(...response.crewLines);
  lines.push(...response.clarificationPrompts.map((p) => `Clarify: ${p}`));
  lines.push(...response.operationalNotices.map((n) => `System: ${n}`));

  return {
    outcomeClassification: response.outcomeClassification,
    commandLogLines: lines,
    nextSystemStatus: execution.updatedSystemStatus ?? currentSystemStatus,
    llmDebugEvents: planning.debugEvents
  };
}
