import { Text } from "@chakra-ui/react";
import { BridgeCrewMember } from "../crew/types";

type CrewTagProps = {
  member: Pick<BridgeCrewMember, "rank" | "name" | "position">;
  variant?: "default" | "compact";
};

const RANK_ABBREVIATIONS: Record<string, string> = {
  captain: "CAPT",
  commander: "CMDR",
  "lieutenant commander": "LCDR",
  lieutenant: "LT"
};

function abbreviatedRank(rank: string): string {
  return RANK_ABBREVIATIONS[rank.trim().toLowerCase()] ?? rank;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

// @spec PRESENT-LOG-006, PRESENT-LOG-010
export function CrewTag({ member, variant = "default" }: CrewTagProps) {
  const label =
    variant === "compact"
      ? `${abbreviatedRank(member.rank)} ${lastName(member.name)} — ${member.position}`
      : `${member.rank} ${member.name} — ${member.position}`;
  return (
    <Text
      as="span"
      textStyle={variant === "compact" ? "caption" : "body"}
      className={variant === "compact" ? "crew-tag crew-tag-compact" : "crew-tag"}
    >
      {label}
    </Text>
  );
}
