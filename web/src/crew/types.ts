export type BridgeCrewMember = {
  name: string;
  rank: string;
  position: string;
  dialogHandles: string[];
};

export type BridgeCrewDefinition = {
  id: string;
  crew: BridgeCrewMember[];
};
