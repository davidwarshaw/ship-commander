export type SystemHandedness = "clockwise" | "counterclockwise";

export type TacticalOrbit = {
  radiusX: number;
  radiusY: number;
};

export type TacticalPlanet = {
  name: string;
  size: number;
  type: string;
  orbit: TacticalOrbit;
};

export type TacticalStar = {
  name: string;
  size: number;
};

export type TacticalSystemDefinition = {
  id: string;
  name: string;
  handedness: SystemHandedness;
  star: TacticalStar;
  planets: TacticalPlanet[];
};
