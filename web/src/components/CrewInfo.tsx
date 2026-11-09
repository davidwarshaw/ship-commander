import { Stack, Text } from "@chakra-ui/react";
import { BridgeCrewMember } from "../crew/types";

type CrewInfoProps = {
  member: Pick<BridgeCrewMember, "rank" | "name" | "position">;
};

// @spec PRESENT-LOG-006
export function CrewInfo({ member }: CrewInfoProps) {
  return (
    <Stack>
      <Text textStyle="md" fontWeight="normal">
        {member.rank} {member.name}
      </Text>
      <Text textStyle="sm" fontWeight="normal">
        {member.position}
      </Text>
    </Stack>
  );
}
