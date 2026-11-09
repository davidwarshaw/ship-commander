import { Text } from "@chakra-ui/react";
import { BridgeCrewMember } from "../crew/types";

type CrewTagProps = {
  member: Pick<BridgeCrewMember, "rank" | "name" | "position">;
};

// @spec PRESENT-LOG-006
export function CrewTag({ member }: CrewTagProps) {
  return (
    <Text as="span" className="crew-tag">
      {member.rank} {member.name} — {member.position}
    </Text>
  );
}
