import bridgeCrew from "../data/crew/bridge-crew.json";
import { BridgeCrewDefinition } from "./types";

function isCrewMember(value: unknown): value is BridgeCrewDefinition["crew"][number] {
  if (!value || typeof value !== "object") return false;
  const member = value as Record<string, unknown>;
  return (
    typeof member.name === "string" &&
    typeof member.rank === "string" &&
    typeof member.position === "string" &&
    Array.isArray(member.dialogHandles) &&
    member.dialogHandles.every((entry) => typeof entry === "string")
  );
}

function parseCrewDefinition(value: unknown): BridgeCrewDefinition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !Array.isArray(candidate.crew) || !candidate.crew.every(isCrewMember)) return null;
  return {
    id: candidate.id,
    crew: candidate.crew as BridgeCrewDefinition["crew"]
  };
}

const CREW_CATALOG: Record<string, unknown> = {
  "bridge-crew": bridgeCrew
};

// @spec PRESENT-BIND-009, PRESENT-LOG-005
export function getBridgeCrewDefinition(crewId: string): BridgeCrewDefinition | null {
  return parseCrewDefinition(CREW_CATALOG[crewId]);
}

// @spec PRESENT-BIND-010
export function resolveCrewMemberBySpeakerToken(
  crewDefinition: BridgeCrewDefinition,
  speakerToken: string
): BridgeCrewDefinition["crew"][number] | null {
  const normalized = speakerToken.trim().toLowerCase();
  if (!normalized) return null;
  for (const member of crewDefinition.crew) {
    if (
      member.name.toLowerCase() === normalized ||
      member.rank.toLowerCase() === normalized ||
      member.position.toLowerCase() === normalized ||
      member.dialogHandles.some((handle) => handle.toLowerCase() === normalized)
    ) {
      return member;
    }
  }
  return null;
}
