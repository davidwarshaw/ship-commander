import sol from "../data/solar-systems/sol.json";
import { TacticalSystemDefinition } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSystemDefinition(value: unknown): TacticalSystemDefinition | null {
  if (!isRecord(value)) return null;
  const { id, name, handedness, star, planets } = value;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (handedness !== "clockwise" && handedness !== "counterclockwise") return null;
  if (!isRecord(star) || typeof star.name !== "string" || !isFiniteNumber(star.size)) return null;
  if (!Array.isArray(planets) || planets.length === 0) return null;

  const parsedPlanets = planets.map((planet) => {
    if (!isRecord(planet)) return null;
    const orbit = planet.orbit;
    if (
      typeof planet.name !== "string" ||
      typeof planet.type !== "string" ||
      !isFiniteNumber(planet.size) ||
      !isRecord(orbit) ||
      !isFiniteNumber(orbit.radiusX) ||
      !isFiniteNumber(orbit.radiusY)
    ) {
      return null;
    }
    return {
      name: planet.name,
      type: planet.type,
      size: planet.size,
      orbit: {
        radiusX: orbit.radiusX,
        radiusY: orbit.radiusY
      }
    };
  });

  if (parsedPlanets.some((planet) => planet === null)) return null;

  return {
    id,
    name,
    handedness,
    star: {
      name: star.name,
      size: star.size
    },
    planets: parsedPlanets as TacticalSystemDefinition["planets"]
  };
}

const CATALOG: Record<string, unknown> = {
  sol
};

// @spec PRESENT-PROJ-006, PRESENT-PROJ-010, PRESENT-PROJ-011
export function getSolarSystemDefinition(systemId: string): TacticalSystemDefinition | null {
  const candidate = CATALOG[systemId];
  return parseSystemDefinition(candidate);
}
