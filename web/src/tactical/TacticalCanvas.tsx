import { useEffect, useRef } from "react";
import { Box, Button } from "@chakra-ui/react";
import * as THREE from "three";
import { useCommanderStore } from "../state/store";
import { getSolarSystemDefinition } from "./solarSystemCatalog";

type PlanetNode = {
  mesh: THREE.Mesh;
  label: THREE.Sprite;
  orbitLine: THREE.LineLoop;
  orbit: { radiusX: number; radiusY: number };
  tiltRadians: number;
  baseAngle: number;
  angularRate: number;
};

type ShipPoint = { x: number; y: number; z: number };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidShipPoint(value: unknown): value is ShipPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<ShipPoint>;
  return isFiniteNumber(point.x) && isFiniteNumber(point.y) && isFiniteNumber(point.z);
}

function createLabelSprite(text: string): { sprite: THREE.Sprite; dispose: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    const fallbackMaterial = new THREE.SpriteMaterial({ color: 0xffffff });
    return {
      sprite: new THREE.Sprite(fallbackMaterial),
      dispose: () => {
        fallbackMaterial.dispose();
      }
    };
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(0, 0, 0, 0.6)";
  context.fillRect(0, 8, canvas.width, canvas.height - 16);
  context.fillStyle = "#ffffff";
  context.font = "bold 26px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });
  const sprite = new THREE.Sprite(material);
  return {
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    }
  };
}

// @spec PRESENT-PROJ-007, PRESENT-PROJ-008, PRESENT-PROJ-009, PRESENT-PROJ-012, PRESENT-PROJ-013, PRESENT-PROJ-014, PRESENT-PROJ-015, PRESENT-PROJ-016, PRESENT-PROJ-017, PRESENT-PROJ-019, PRESENT-PROJ-020, PRESENT-PROJ-021, PRESENT-PROJ-022, PRESENT-PROJ-023, PRESENT-PROJ-031, PRESENT-PROJ-033
export function TacticalCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const simTick = useCommanderStore((s) => s.simTick);
  const reportDroppedRenderFrame = useCommanderStore((s) => s.reportDroppedRenderFrame);
  const activeSystemId = useCommanderStore((s) => s.activeSystemId);
  const shipName = useCommanderStore((s) => s.shipName);
  const shipPosition = useCommanderStore((s) => s.shipPosition);
  const shipTrail = useCommanderStore((s) => s.shipTrail);
  const savedCameraOrbit = useCommanderStore((s) => s.tacticalCameraOrbit);
  const shipHeadingRadians = useCommanderStore((s) => s.shipHeadingRadians);
  const shipSpeed = useCommanderStore((s) => s.shipSpeed);
  const setTacticalCameraOrbit = useCommanderStore((s) => s.setTacticalCameraOrbit);
  const resetTacticalCameraOrbit = useCommanderStore((s) => s.resetTacticalCameraOrbit);
  const tacticalState = {
    activeSystemId,
    shipName,
    shipPosition,
    shipTrail,
    shipHeadingRadians,
    shipSpeed
  };
  const simTickRef = useRef(simTick);
  const tacticalStateRef = useRef(tacticalState);

  useEffect(() => {
    simTickRef.current = simTick;
  }, [simTick]);

  useEffect(() => {
    tacticalStateRef.current = tacticalState;
  }, [tacticalState]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const setNotice = (message: string | null) => {
      if (!noticeRef.current) return;
      noticeRef.current.textContent = message ?? "";
      noticeRef.current.style.display = message ? "block" : "none";
    };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setClearColor(0x000000);
      mount.appendChild(renderer.domElement);
    } catch {
      setNotice("Tactical unavailable: WebGL context initialization failed.");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let orbitAzimuth = savedCameraOrbit.azimuth;
    let orbitPolar = savedCameraOrbit.polar;
    let orbitDistance = savedCameraOrbit.radius;
    const updateOrbitCamera = () => {
      const sinPolar = Math.sin(orbitPolar);
      const cosPolar = Math.cos(orbitPolar);
      const x = orbitDistance * sinPolar * Math.cos(orbitAzimuth);
      const y = orbitDistance * cosPolar;
      const z = orbitDistance * sinPolar * Math.sin(orbitAzimuth);
      camera.position.set(cameraTarget.x + x, cameraTarget.y + y, cameraTarget.z + z);
      camera.lookAt(cameraTarget);
    };
    const resetCamera = () => {
      resetTacticalCameraOrbit();
      orbitAzimuth = 0;
      orbitPolar = 0.24;
      const shipWorld = shipMesh?.position;
      if (shipWorld && planetNodes.length > 0) {
        let nearest = Number.POSITIVE_INFINITY;
        for (const node of planetNodes) {
          const distance = shipWorld.distanceTo(node.mesh.position);
          if (distance < nearest) nearest = distance;
        }
        orbitDistance = THREE.MathUtils.clamp(Math.max(3, nearest * 1.35), 6, 48);
      } else {
        orbitDistance = 7.5;
      }
      updateOrbitCamera();
      setTacticalCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
    };
    updateOrbitCamera();
    resetCameraRef.current = resetCamera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.55);
    keyLight.position.set(6, 10, 8);
    scene.add(keyLight);

    const root = new THREE.Group();
    scene.add(root);

    const planetNodes: PlanetNode[] = [];
    const labelDisposers: Array<() => void> = [];
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x555555 });
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const planetMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const shipMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    let shipMesh: THREE.Mesh | null = null;
    let shipLabel: THREE.Sprite | null = null;
    let shipVector: THREE.ArrowHelper | null = null;
    let trailLine: THREE.Line | null = null;
    let currentSystemId: string | null = null;
    let currentSystemValid = false;
    let currentHandedness: "clockwise" | "counterclockwise" = "counterclockwise";

    const clearSystem = () => {
      while (root.children.length > 0) {
        const child = root.children.pop();
        if (child) root.remove(child);
      }
      planetNodes.splice(0, planetNodes.length);
      labelDisposers.forEach((dispose) => dispose());
      labelDisposers.splice(0, labelDisposers.length);
      shipMesh = null;
      shipLabel = null;
      shipVector = null;
      trailLine = null;
    };

    const buildSystem = (systemId: string) => {
      clearSystem();
      currentSystemValid = false;

      const definition = getSolarSystemDefinition(systemId);
      if (!definition) {
        setNotice("Tactical unavailable: local system definition missing or malformed.");
        currentSystemId = systemId;
        return;
      }

      currentSystemId = systemId;
      currentSystemValid = true;
      currentHandedness = definition.handedness;
      setNotice(null);

      const starGeometry = new THREE.SphereGeometry(Math.max(0.2, definition.star.size), 20, 20);
      const starMesh = new THREE.Mesh(starGeometry, starMaterial);
      root.add(starMesh);

      const starLabelSprite = createLabelSprite(definition.star.name);
      const starLabel = starLabelSprite.sprite;
      starLabel.scale.set(2.4, 0.6, 1);
      starLabel.position.set(0, definition.star.size + 0.8, 0);
      root.add(starLabel);
      labelDisposers.push(starLabelSprite.dispose);

      for (let index = 0; index < definition.planets.length; index += 1) {
        const planet = definition.planets[index];
        const tiltRadians = 0.22 + index * 0.03;
        const curve = new THREE.EllipseCurve(0, 0, planet.orbit.radiusX, planet.orbit.radiusY, 0, 2 * Math.PI, false);
        const points = curve.getPoints(180).map((point) => {
          const x = point.x;
          const y = point.y * Math.sin(tiltRadians);
          const z = point.y * Math.cos(tiltRadians);
          return new THREE.Vector3(x, y, z);
        });
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const orbitLine = new THREE.LineLoop(orbitGeometry, lineMaterial);
        root.add(orbitLine);

        const planetGeometry = new THREE.SphereGeometry(Math.max(0.06, planet.size), 14, 14);
        const mesh = new THREE.Mesh(planetGeometry, planetMaterial);
        root.add(mesh);

        const labelSprite = createLabelSprite(planet.name);
        const label = labelSprite.sprite;
        label.scale.set(1.6, 0.4, 1);
        root.add(label);
        labelDisposers.push(labelSprite.dispose);

        planetNodes.push({
          mesh,
          label,
          orbitLine,
          orbit: {
            radiusX: planet.orbit.radiusX,
            radiusY: planet.orbit.radiusY
          },
          tiltRadians,
          baseAngle: index * 0.8,
          angularRate: 0.012 / (index + 1)
        });
      }

      const shipGeometry = new THREE.SphereGeometry(0.12, 14, 14);
      shipMesh = new THREE.Mesh(shipGeometry, shipMaterial);
      root.add(shipMesh);

      const shipLabelSprite = createLabelSprite(tacticalStateRef.current.shipName);
      shipLabel = shipLabelSprite.sprite;
      shipLabel.scale.set(2.1, 0.5, 1);
      root.add(shipLabel);
      labelDisposers.push(shipLabelSprite.dispose);

      shipVector = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.8, 0xffffff, 0.25, 0.16);
      root.add(shipVector);

      const trailGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
      trailLine = new THREE.Line(trailGeometry, trailMaterial);
      root.add(trailLine);
    };

    buildSystem(tacticalStateRef.current.activeSystemId);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      orbitAzimuth -= dx * 0.005;
      orbitPolar = THREE.MathUtils.clamp(orbitPolar + dy * 0.005, 0.2, Math.PI - 0.2);
      setTacticalCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
      updateOrbitCamera();
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbitDistance = THREE.MathUtils.clamp(orbitDistance + event.deltaY * 0.02, 6, 48);
      setTacticalCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
      updateOrbitCamera();
    };
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let mounted = true;
    let previousTick = simTickRef.current;
    const render = () => {
      if (!mounted) return;

      const currentTick = simTickRef.current;
      if (currentTick - previousTick > 1) {
        reportDroppedRenderFrame();
      }
      previousTick = currentTick;

      const state = tacticalStateRef.current;
      if (state.activeSystemId !== currentSystemId) {
        buildSystem(state.activeSystemId);
      }

      const handednessSign = currentHandedness === "clockwise" ? -1 : 1;
      for (const node of planetNodes) {
        const angle = node.baseAngle + handednessSign * currentTick * node.angularRate;
        const x = Math.cos(angle) * node.orbit.radiusX;
        const ellipseY = Math.sin(angle) * node.orbit.radiusY;
        const y = ellipseY * Math.sin(node.tiltRadians);
        const z = ellipseY * Math.cos(node.tiltRadians);
        node.mesh.position.set(x, y, z);
        node.label.position.set(x + 0.45, y + 0.35, z);
      }

      const hasValidShipState =
        isValidShipPoint(state.shipPosition) &&
        isFiniteNumber(state.shipHeadingRadians) &&
        isFiniteNumber(state.shipSpeed);
      const hasValidTrail = Array.isArray(state.shipTrail) && state.shipTrail.every((point) => isValidShipPoint(point));

      if (!hasValidShipState) {
        setNotice("Ship tactical vector unavailable: invalid ship kinematics payload.");
      } else if (!hasValidTrail) {
        setNotice("Ship tactical trail unavailable: invalid ship trail payload.");
      } else if (currentSystemValid) {
        setNotice(null);
      }

      if (hasValidShipState && shipMesh && shipLabel && shipVector) {
        shipMesh.visible = true;
        shipLabel.visible = true;
        shipVector.visible = true;

        shipMesh.position.set(state.shipPosition.x, state.shipPosition.y, state.shipPosition.z);
        shipLabel.position.set(state.shipPosition.x + 0.9, state.shipPosition.y + 0.7, state.shipPosition.z);
        cameraTarget.copy(shipMesh.position);
        updateOrbitCamera();

        const heading = state.shipHeadingRadians * handednessSign;
        const direction = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).normalize();
        shipVector.position.copy(shipMesh.position);
        shipVector.setDirection(direction);
        shipVector.setLength(Math.max(0.5, state.shipSpeed * 3.6), 0.22, 0.14);
      } else if (shipMesh && shipLabel && shipVector) {
        shipMesh.visible = false;
        shipLabel.visible = false;
        shipVector.visible = false;
      }

      if (trailLine) {
        if (hasValidTrail && state.shipTrail.length > 1) {
          trailLine.visible = true;
          const trailPoints = state.shipTrail.map((point) => new THREE.Vector3(point.x, point.y, point.z));
          trailLine.geometry.setFromPoints(trailPoints);
        } else {
          trailLine.visible = false;
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      if (!mount) return;
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      clearSystem();
      lineMaterial.dispose();
      trailMaterial.dispose();
      planetMaterial.dispose();
      starMaterial.dispose();
      shipMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      resetCameraRef.current = null;
    };
  }, [reportDroppedRenderFrame, setTacticalCameraOrbit, resetTacticalCameraOrbit]);

  return (
    <Box className="tactical-canvas-shell">
      <Box ref={mountRef} className="tactical-canvas" aria-label="Tactical wireframe view" />
      <Button type="button" className="camera-reset-button tactical-camera-reset" onClick={() => resetCameraRef.current?.()}>
        Reset Camera
      </Button>
      <Box ref={noticeRef} className="tactical-notice" />
    </Box>
  );
}
