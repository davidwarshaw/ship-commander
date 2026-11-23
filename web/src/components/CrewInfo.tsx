import { Stack, Text } from "@chakra-ui/react";
import { BridgeCrewMember } from "../crew/types";

type CrewInfoProps = {
  member: Pick<BridgeCrewMember, "rank" | "name" | "position">;
};

// @spec PRESENT-LOG-006, PRESENT-LOG-008
export function CrewInfo({ member }: CrewInfoProps) {
  return (
    <Stack className="crew-info" gap="0.15rem">
      <Text className="crew-info-identity" textStyle="body" fontWeight="semibold">
        {member.rank} {member.name}
      </Text>
      <Text className="crew-info-position" textStyle="body" fontWeight="normal">
        {member.position}
      </Text>
    </Stack>
  );
}
