import { Box, Heading, List, Text } from "@chakra-ui/react";
import { useCommanderStore } from "../state/store";
import { getSolarSystemDefinition } from "../tactical/solarSystemCatalog";

type Vector3 = { x: number; y: number; z: number };

function magnitude(vector: Vector3): number {
  return Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
  );
}

function formatVector(vector: Vector3): string {
  return `(${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)})`;
}

function lastVelocityFromTrail(trail: Vector3[]): Vector3 | null {
  if (trail.length < 2) return null;
  const prev = trail[trail.length - 2];
  const curr = trail[trail.length - 1];
  return {
    x: curr.x - prev.x,
    y: curr.y - prev.y,
    z: curr.z - prev.z,
  };
}

// @spec PRESENT-DBG-001, PRESENT-DBG-002, PRESENT-DBG-003, PRESENT-DBG-004
export function DebugSimulationView() {
  const simTick = useCommanderStore((s) => s.simTick);
  const activeSystemId = useCommanderStore((s) => s.activeSystemId);
  const shipName = useCommanderStore((s) => s.shipName);
  const shipPosition = useCommanderStore((s) => s.shipPosition);
  const shipTrail = useCommanderStore((s) => s.shipTrail);
  const shipHeadingRadians = useCommanderStore((s) => s.shipHeadingRadians);
  const shipSpeed = useCommanderStore((s) => s.shipSpeed);
  const system = getSolarSystemDefinition(activeSystemId);

  if (!system) {
    return (
      <Box className="debug-simulation-view">
        <Text textStyle="body">Debug unavailable: system data missing.</Text>
      </Box>
    );
  }

  const handednessSign = system.handedness === "clockwise" ? -1 : 1;
  const starPosition: Vector3 = { x: 0, y: 0, z: 0 };
  const starVelocity: Vector3 = { x: 0, y: 0, z: 0 };
  const shipVelocity = lastVelocityFromTrail(shipTrail) ?? {
    x: Math.cos(shipHeadingRadians) * shipSpeed,
    y: 0,
    z: Math.sin(shipHeadingRadians) * shipSpeed,
  };

  return (
    <Box className="debug-simulation-view">
      <Heading as="h2" size="md" textStyle="header">
        Simulation Debug
      </Heading>
      <Text textStyle="body">system: {system.name}</Text>
      <Text textStyle="body">tick: {simTick}</Text>
      <List.Root className="debug-simulation-list">
        <List.Item>
          <Text textStyle="body">
            {`${system.star.name} [star] position ${formatVector(starPosition)} velocity ${formatVector(starVelocity)} speed ${magnitude(starVelocity).toFixed(4)} orbit: not in orbit`}
          </Text>
        </List.Item>
        {system.planets.map((planet, index) => {
          const tiltRadians = 0.22 + index * 0.03;
          const angularRate = 0.012 / (index + 1);
          const angle = index * 0.8 + handednessSign * simTick * angularRate;
          const x = Math.cos(angle) * planet.orbit.radiusX;
          const ellipseY = Math.sin(angle) * planet.orbit.radiusY;
          const y = ellipseY * Math.sin(tiltRadians);
          const z = ellipseY * Math.cos(tiltRadians);
          const dEllipseY =
            Math.cos(angle) *
            planet.orbit.radiusY *
            handednessSign *
            angularRate;
          const velocity = {
            x:
              -Math.sin(angle) *
              planet.orbit.radiusX *
              handednessSign *
              angularRate,
            y: dEllipseY * Math.sin(tiltRadians),
            z: dEllipseY * Math.cos(tiltRadians),
          };
          return (
            <List.Item key={planet.name}>
              <Text textStyle="body">
                {planet.name} [planet] position {formatVector({ x, y, z })}{" "}
                velocity {formatVector(velocity)} speed{" "}
                {magnitude(velocity).toFixed(4)} orbit: in orbit (center=
                {system.star.name}, radiusX={planet.orbit.radiusX}, radiusY=
                {planet.orbit.radiusY})
              </Text>
            </List.Item>
          );
        })}
        <List.Item>
          <Text textStyle="body">
            {`${shipName} [ship] position ${formatVector(shipPosition)} velocity ${formatVector(shipVelocity)} speed ${magnitude(shipVelocity).toFixed(4)} orbit: not in orbit`}
          </Text>
        </List.Item>
      </List.Root>
    </Box>
  );
}
