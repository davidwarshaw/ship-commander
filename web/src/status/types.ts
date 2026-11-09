export type ShipWireframeDefinition = {
  vertices: Array<[number, number, number]>;
  edges: Array<[number, number]>;
};

export type ShipImportantPoint = {
  name: string;
  position: [number, number, number];
};

export type ShipDefinition = {
  id: string;
  name: string;
  size: string;
  maxSpeed: string;
  armament: string[];
  crewSize: number;
  launchableVessels: string[];
  wireframe: ShipWireframeDefinition;
  importantPoints: ShipImportantPoint[];
};
