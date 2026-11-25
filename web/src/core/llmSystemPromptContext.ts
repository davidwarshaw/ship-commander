import { getBridgeCrewDefinition } from "../crew/crewCatalog";
import { createDefaultCrewedSystems } from "./crewSystems";

// @spec LLMGEN-PROMPT-001, LLMGEN-PROMPT-002, LLMGEN-PROMPT-005
export function buildCrewPlanSystemPrompt(): string {
  const crewDefinition = getBridgeCrewDefinition("bridge-crew");
  const crewedSystems = createDefaultCrewedSystems(crewDefinition);
  const systemByCrewName = new Map<
    string,
    {
      systemName: string;
      actions: Array<{ name: string; description: string }>;
    }
  >();
  for (const system of crewedSystems) {
    const assigned = system.getCrewMemberInCharge();
    if (!assigned) continue;
    systemByCrewName.set(assigned.name, {
      systemName: system.getSystemName(),
      actions: system.listActions(),
    });
  }

  const preamble = [
    "Game context preamble:",
    "You are the bridge planning agent in Ship Commander.",
    "Your role is to convert captain commands into safe, actionable CrewPlan outputs for crew systems.",
    "Only produce actions that are allowed by each crew member's assigned system.",
    "Return only a JSON array of CrewPlan objects with no markdown and no prose.",
    "CrewPlan object shape:",
    "{",
    '  "planId": "string-unique-within-turn",',
    '  "role": "string",',
    '  "goal": "string",',
    '  "actions": [{"actionId": "string", "family": "string", "params": {"key": "value"}}],',
    '  "contingencies": ["string"],',
    '  "confidence": "number 0..1",',
    '  "rationale": "string"',
    "}",
    "If intent is ambiguous, return [] and do not fabricate actions.",
  ];

  const crewSection: string[] = ["Crew and assigned systems:"];
  if (!crewDefinition) {
    crewSection.push("- Crew roster unavailable.");
  } else {
    for (const member of crewDefinition.crew) {
      const aliases =
        member.dialogHandles.length > 0
          ? member.dialogHandles.join(", ")
          : "none";
      const assignment = systemByCrewName.get(member.name);
      if (!assignment) {
        crewSection.push(
          `- ${member.rank} ${member.name} (${member.position}); aliases: ${aliases}; assigned system: Unassigned; allowed actions: none.`,
        );
        continue;
      }
      const actions =
        assignment.actions.length > 0
          ? assignment.actions
              .map((action) => `${action.name} (${action.description})`)
              .join("; ")
          : "none";
      crewSection.push(
        `- ${member.rank} ${member.name} (${member.position}); aliases: ${aliases}; assigned system: ${assignment.systemName}; allowed actions: ${actions}.`,
      );
    }
  }

  return [...preamble, "", ...crewSection].join("\n");
}
