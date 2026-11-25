import { BridgeCrewDefinition, BridgeCrewMember } from "../crew/types";

export type SystemActionDescriptor = {
  name: string;
  description: string;
};

export type ShipEntityState = {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
};

// @spec CREWCMD-SYS-001, CREWCMD-SYS-002, CREWCMD-SYS-003, CREWCMD-SYS-005, CREWCMD-SYS-006
export abstract class CrewedSystem {
  private crewMemberInCharge: BridgeCrewMember | null = null;
  private readonly actions = new Map<string, SystemActionDescriptor>();
  private readonly systemName: string;

  protected constructor(systemName: string) {
    this.systemName = systemName;
  }

  registerCrewMemberInCharge(member: BridgeCrewMember): void {
    this.crewMemberInCharge = member;
  }

  getCrewMemberInCharge(): BridgeCrewMember | null {
    return this.crewMemberInCharge;
  }

  protected registerAction(name: string, description: string): void {
    this.actions.set(name, { name, description });
  }

  listActions(): SystemActionDescriptor[] {
    return [...this.actions.values()];
  }

  getSystemName(): string {
    return this.systemName;
  }

  formatAssignedCrewMember(): string {
    if (!this.crewMemberInCharge) return "Unassigned";
    const aliases =
      this.crewMemberInCharge.dialogHandles.length > 0
        ? this.crewMemberInCharge.dialogHandles.join(", ")
        : "none";
    return `${this.crewMemberInCharge.rank} ${this.crewMemberInCharge.name} (aliases: ${aliases})`;
  }

  updateShipEntity(ship: ShipEntityState): void {
    void ship;
  }
}

// @spec CREWCMD-SYS-004
export class HelmSystem extends CrewedSystem {
  private mode: "hold" | "cruise" = "hold";
  private desiredHeadingRadians = 0;
  private desiredSpeed = 0;

  constructor() {
    super("Helm");
    this.registerAction("holdPosition", "Maintain current heading and velocity envelope.");
    this.registerAction("orbitPlanet", "Enter stable orbit around a named planetary target.");
    this.registerAction("setCruiseVector", "Set ship heading and speed toward a tactical vector.");
  }

  holdPosition(): void {
    this.mode = "hold";
  }

  orbitPlanet(target: string): void {
    void target;
  }

  setCruiseVector(headingRadians: number, speed: number): void {
    this.mode = "cruise";
    this.desiredHeadingRadians = headingRadians;
    this.desiredSpeed = Math.max(0, speed);
  }

  updateShipEntity(ship: ShipEntityState): void {
    if (this.mode === "hold") {
      ship.velocity.x = 0;
      ship.velocity.y = 0;
      ship.velocity.z = 0;
      return;
    }
    ship.velocity.x = Math.cos(this.desiredHeadingRadians) * this.desiredSpeed;
    ship.velocity.y = 0;
    ship.velocity.z = Math.sin(this.desiredHeadingRadians) * this.desiredSpeed;
  }
}

export function createDefaultCrewedSystems(
  crewDefinition: BridgeCrewDefinition | null,
): CrewedSystem[] {
  const helmSystem = new HelmSystem();
  if (crewDefinition) {
    const helmOfficer = crewDefinition.crew.find(
      (member) => member.position.toLowerCase() === "helm officer",
    );
    if (helmOfficer) helmSystem.registerCrewMemberInCharge(helmOfficer);
  }
  return [helmSystem];
}
