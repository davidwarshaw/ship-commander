import scvAegis from "../data/ships/scv-aegis.json";
import { ShipDefinition } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCoordinate(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isFiniteNumber(value[2])
  );
}

function isEdge(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  );
}

function parseShipDefinition(value: unknown): ShipDefinition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.size !== "string" ||
    typeof candidate.maxSpeed !== "string" ||
    !Array.isArray(candidate.armament) ||
    !candidate.armament.every((entry) => typeof entry === "string") ||
    !isFiniteNumber(candidate.crewSize) ||
    !Array.isArray(candidate.launchableVessels) ||
    !candidate.launchableVessels.every((entry) => typeof entry === "string")
  ) {
    return null;
  }

  const wireframe = candidate.wireframe;
  if (!wireframe || typeof wireframe !== "object") return null;
  const rawVertices = (wireframe as Record<string, unknown>).vertices;
  const rawEdges = (wireframe as Record<string, unknown>).edges;
  if (!Array.isArray(rawVertices) || !rawVertices.every(isCoordinate)) return null;
  if (!Array.isArray(rawEdges) || !rawEdges.every(isEdge)) return null;

  const importantPoints = candidate.importantPoints;
  if (!Array.isArray(importantPoints)) return null;
  for (const point of importantPoints) {
    if (
      !point ||
      typeof point !== "object" ||
      typeof (point as Record<string, unknown>).name !== "string" ||
      !isCoordinate((point as Record<string, unknown>).position)
    ) {
      return null;
    }
  }

  return {
    id: candidate.id,
    name: candidate.name,
    size: candidate.size,
    maxSpeed: candidate.maxSpeed,
    armament: candidate.armament as string[],
    crewSize: candidate.crewSize,
    launchableVessels: candidate.launchableVessels as string[],
    wireframe: {
      vertices: rawVertices,
      edges: rawEdges
    },
    importantPoints: importantPoints as ShipDefinition["importantPoints"]
  };
}

const SHIP_CATALOG: Record<string, unknown> = {
  "scv-aegis": scvAegis
};

// @spec PRESENT-PROJ-027, PRESENT-PROJ-028
export function getShipDefinition(shipId: string): ShipDefinition | null {
  return parseShipDefinition(SHIP_CATALOG[shipId]);
}
