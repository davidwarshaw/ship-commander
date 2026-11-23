import { useEffect, useRef } from "react";
import { Box, Button, Heading, List, Text } from "@chakra-ui/react";
import * as THREE from "three";
import { getShipDefinition } from "./shipCatalog";
import { useCommanderStore } from "../state/store";

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
  context.font = "bold 22px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  return {
    sprite,
    dispose: () => {
      texture.dispose();
      material.dispose();
    }
  };
}

// @spec PRESENT-PROJ-024, PRESENT-PROJ-025, PRESENT-PROJ-026, PRESENT-PROJ-028, PRESENT-PROJ-029, PRESENT-PROJ-030, PRESENT-PROJ-032, PRESENT-PROJ-034
export function StatusShipView() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const savedCameraOrbit = useCommanderStore((s) => s.statusCameraOrbit);
  const setStatusCameraOrbit = useCommanderStore((s) => s.setStatusCameraOrbit);
  const resetStatusCameraOrbit = useCommanderStore((s) => s.resetStatusCameraOrbit);
  const ship = getShipDefinition("scv-aegis");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !ship) return;

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
      setNotice("Status unavailable: WebGL context initialization failed.");
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
      resetStatusCameraOrbit();
      orbitAzimuth = Math.PI / 2;
      orbitPolar = Math.PI / 2;
      orbitDistance = defaultOrbitDistance;
      setStatusCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
      updateOrbitCamera();
    };
    resetCameraRef.current = resetCamera;
    updateOrbitCamera();

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(6, 8, 6);
    scene.add(keyLight);

    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const importantPointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const labelDisposers: Array<() => void> = [];

    const vertexVectors = ship.wireframe.vertices.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const segmentPoints: THREE.Vector3[] = [];
    for (const [fromIndex, toIndex] of ship.wireframe.edges) {
      const from = vertexVectors[fromIndex];
      const to = vertexVectors[toIndex];
      if (!from || !to) continue;
      segmentPoints.push(from, to);
    }

    const wireframeGeometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
    const shipWireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    scene.add(shipWireframe);
    wireframeGeometry.computeBoundingSphere();
    const boundsRadius = wireframeGeometry.boundingSphere?.radius ?? 3.5;
    const verticalFovRadians = THREE.MathUtils.degToRad(camera.fov);
    const fitDistance = boundsRadius / Math.sin(verticalFovRadians / 2);
    const defaultOrbitDistance = THREE.MathUtils.clamp(fitDistance * 1.08, 5, 30);

    for (const point of ship.importantPoints) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), importantPointMaterial);
      marker.position.set(point.position[0], point.position[1], point.position[2]);
      scene.add(marker);

      const labelSprite = createLabelSprite(point.name);
      const label = labelSprite.sprite;
      label.scale.set(1.8, 0.45, 1);
      label.position.set(point.position[0] + 0.25, point.position[1] + 0.25, point.position[2]);
      scene.add(label);
      labelDisposers.push(labelSprite.dispose);
    }

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
      setStatusCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
      updateOrbitCamera();
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbitDistance = THREE.MathUtils.clamp(orbitDistance + event.deltaY * 0.02, 5, 30);
      setStatusCameraOrbit({ azimuth: orbitAzimuth, polar: orbitPolar, radius: orbitDistance });
      updateOrbitCamera();
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let mounted = true;
    const render = () => {
      if (!mounted) return;
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
      labelDisposers.forEach((dispose) => dispose());
      wireframeGeometry.dispose();
      wireframeMaterial.dispose();
      importantPointMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      resetCameraRef.current = null;
    };
  }, [ship, setStatusCameraOrbit, resetStatusCameraOrbit]);

  if (!ship) {
    return (
      <Box className="status-mode">
        <Text textStyle="body">Status unavailable: ship definition missing or malformed.</Text>
      </Box>
    );
  }

  return (
    <Box className="status-mode status-ship-layout">
      <Box className="status-ship-canvas-shell">
        <Box ref={mountRef} className="status-ship-canvas" aria-label="Status ship wireframe view" />
        <Button type="button" className="camera-reset-button status-camera-reset" onClick={() => resetCameraRef.current?.()}>
          Reset Camera
        </Button>
        <Box ref={noticeRef} className="tactical-notice" />
      </Box>
      <Box className="status-ship-metadata">
        <Heading as="h2" size="md" textStyle="header">
          {ship.name}
        </Heading>
        <Text textStyle="body">size: {ship.size}</Text>
        <Text textStyle="body">maxSpeed: {ship.maxSpeed}</Text>
        <Text textStyle="body">crewSize: {ship.crewSize}</Text>
        <Heading as="h3" size="sm" textStyle="header">
          armament
        </Heading>
        <List.Root className="status-ship-list">
          {ship.armament.map((entry) => (
            <List.Item key={entry}>
              <Text textStyle="body">{entry}</Text>
            </List.Item>
          ))}
        </List.Root>
        <Heading as="h3" size="sm" textStyle="header">
          launchableVessels
        </Heading>
        <List.Root className="status-ship-list">
          {ship.launchableVessels.map((entry) => (
            <List.Item key={entry}>
              <Text textStyle="body">{entry}</Text>
            </List.Item>
          ))}
        </List.Root>
      </Box>
    </Box>
  );
}
