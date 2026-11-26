import { addComponent, addEntity, createWorld, query } from "bitecs";
import { getBridgeCrewDefinition } from "../crew/crewCatalog";
import {
  CrewedSystem,
  CrewedSystemDebugSnapshot,
  HelmSystem,
  createDefaultCrewedSystems,
} from "./crewSystems";
import { getSolarSystemDefinition } from "../tactical/solarSystemCatalog";

type Vector3 = { x: number; y: number; z: number };

type SimulationRuntimeConfig = {
  activeSystemId: string;
  initialShipPosition: Vector3;
  initialShipHeadingRadians: number;
  initialShipSpeed: number;
  initialSimTick: number;
};

type SimulationTickSnapshot = {
  worldTimeMinutes: number;
  shipPosition: Vector3;
  shipVelocity: Vector3;
};

type SimulationRuntime = {
  advanceTick: (tickIncrementMinutes: number) => SimulationTickSnapshot;
  getEcsDebugSnapshot: () => EcsDebugSnapshot;
  getSystemDebugSnapshot: () => SystemDebugSnapshot;
};

export type EcsComponentDebugSnapshot = {
  componentName: string;
  data: Record<string, number>;
};

export type EcsEntityDebugSnapshot = {
  entityId: number;
  label: string;
  entityType: "star" | "planet" | "ship";
  components: EcsComponentDebugSnapshot[];
};

export type EcsDebugSnapshot = {
  entities: EcsEntityDebugSnapshot[];
};

export type SystemDebugSnapshot = {
  systems: CrewedSystemDebugSnapshot[];
};

const Position = {
  x: [] as number[],
  y: [] as number[],
  z: [] as number[],
};

const Velocity = {
  x: [] as number[],
  y: [] as number[],
  z: [] as number[],
};

function setVector(
  component: { x: number[]; y: number[]; z: number[] },
  entity: number,
  vector: Vector3,
) {
  component.x[entity] = vector.x;
  component.y[entity] = vector.y;
  component.z[entity] = vector.z;
}

function movementSystem(world: object, tickIncrementMinutes: number): object {
  for (const entity of query(world, [Position, Velocity])) {
    Position.x[entity] += Velocity.x[entity] * tickIncrementMinutes;
    Position.y[entity] += Velocity.y[entity] * tickIncrementMinutes;
    Position.z[entity] += Velocity.z[entity] * tickIncrementMinutes;
  }
  return world;
}

function applyCrewedSystemsToShip(
  crewedSystems: CrewedSystem[],
  ship: number,
) {
  const shipState = {
    position: {
      x: Position.x[ship],
      y: Position.y[ship],
      z: Position.z[ship],
    },
    velocity: {
      x: Velocity.x[ship],
      y: Velocity.y[ship],
      z: Velocity.z[ship],
    },
  };
  for (const system of crewedSystems) {
    system.updateShipEntity(shipState);
  }
  setVector(Position, ship, shipState.position);
  setVector(Velocity, ship, shipState.velocity);
}

function componentVectorDebugSnapshot(
  componentName: string,
  component: { x: number[]; y: number[]; z: number[] },
  entity: number,
): EcsComponentDebugSnapshot {
  return {
    componentName,
    data: {
      x: component.x[entity],
      y: component.y[entity],
      z: component.z[entity],
    },
  };
}

function planetKinematics(systemId: string, simTick: number) {
  const definition = getSolarSystemDefinition(systemId);
  if (!definition) return [];
  const handednessSign = definition.handedness === "clockwise" ? -1 : 1;
  return definition.planets.map((planet, index) => {
    const tiltRadians = 0.22 + index * 0.03;
    const angularRate = 0.012 / (index + 1);
    const angle = index * 0.8 + handednessSign * simTick * angularRate;
    const x = Math.cos(angle) * planet.orbit.radiusX;
    const ellipseY = Math.sin(angle) * planet.orbit.radiusY;
    const y = ellipseY * Math.sin(tiltRadians);
    const z = ellipseY * Math.cos(tiltRadians);
    const dEllipseY =
      Math.cos(angle) * planet.orbit.radiusY * handednessSign * angularRate;
    const vx = -Math.sin(angle) * planet.orbit.radiusX * handednessSign * angularRate;
    const vy = dEllipseY * Math.sin(tiltRadians);
    const vz = dEllipseY * Math.cos(tiltRadians);
    return {
      position: { x, y, z },
      velocity: { x: vx, y: vy, z: vz },
    };
  });
}

// @spec SIMEXEC-ECS-001, SIMEXEC-ECS-002, SIMEXEC-ECS-003, SIMEXEC-ECS-004
export function createSimulationRuntime(
  config: SimulationRuntimeConfig,
): SimulationRuntime {
  const world = createWorld();
  let worldTimeMinutes = config.initialSimTick;
  const bridgeCrew = getBridgeCrewDefinition("bridge-crew");
  const crewedSystems: CrewedSystem[] = createDefaultCrewedSystems(bridgeCrew);
  const helmSystem = crewedSystems.find(
    (system) => system.getSystemName() === "Helm",
  );
  if (helmSystem && helmSystem instanceof HelmSystem) {
    helmSystem.setCruiseVector(
      config.initialShipHeadingRadians,
      config.initialShipSpeed,
    );
  }

  const entityLabels = new Map<number, { label: string; entityType: "star" | "planet" | "ship" }>();

  const starDefinition = getSolarSystemDefinition(config.activeSystemId)?.star;
  const star = addEntity(world);
  addComponent(world, star, Position);
  addComponent(world, star, Velocity);
  setVector(Position, star, { x: 0, y: 0, z: 0 });
  setVector(Velocity, star, { x: 0, y: 0, z: 0 });
  entityLabels.set(star, {
    label: starDefinition?.name ?? "Primary Star",
    entityType: "star",
  });

  const planets = planetKinematics(config.activeSystemId, config.initialSimTick);
  const planetDefinitions =
    getSolarSystemDefinition(config.activeSystemId)?.planets ?? [];
  for (const [index, planet] of planets.entries()) {
    const planetEntity = addEntity(world);
    addComponent(world, planetEntity, Position);
    addComponent(world, planetEntity, Velocity);
    setVector(Position, planetEntity, planet.position);
    setVector(Velocity, planetEntity, planet.velocity);
    const definition = planetDefinitions[index];
    entityLabels.set(planetEntity, {
      label: definition?.name ?? `Planet ${index + 1}`,
      entityType: "planet",
    });
  }

  const ship = addEntity(world);
  addComponent(world, ship, Position);
  addComponent(world, ship, Velocity);
  setVector(Position, ship, config.initialShipPosition);
  setVector(Velocity, ship, {
    x: Math.cos(config.initialShipHeadingRadians) * config.initialShipSpeed,
    y: 0,
    z: Math.sin(config.initialShipHeadingRadians) * config.initialShipSpeed,
  });
  entityLabels.set(ship, { label: "Ship", entityType: "ship" });

  const getEcsDebugSnapshot = (): EcsDebugSnapshot => ({
    entities: [...entityLabels.entries()].map(([entityId, meta]) => ({
      entityId,
      label: meta.label,
      entityType: meta.entityType,
      components: [
        componentVectorDebugSnapshot("Position", Position, entityId),
        componentVectorDebugSnapshot("Velocity", Velocity, entityId),
      ],
    })),
  });

  const getSystemDebugSnapshot = (): SystemDebugSnapshot => ({
    systems: crewedSystems.map((system) => system.getDebugSnapshot()),
  });

  return {
    advanceTick: (tickIncrementMinutes: number) => {
      applyCrewedSystemsToShip(crewedSystems, ship);
      worldTimeMinutes += tickIncrementMinutes;
      movementSystem(world, tickIncrementMinutes);
      return {
        worldTimeMinutes,
        shipPosition: {
          x: Position.x[ship],
          y: Position.y[ship],
          z: Position.z[ship],
        },
        shipVelocity: {
          x: Velocity.x[ship],
          y: Velocity.y[ship],
          z: Velocity.z[ship],
        },
      };
    },
    getEcsDebugSnapshot,
    getSystemDebugSnapshot,
  };
}
