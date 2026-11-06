import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCommanderStore } from "../state/store";

export function TacticalCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simTick = useCommanderStore((s) => s.simTick);
  const reportDroppedRenderFrame = useCommanderStore((s) => s.reportDroppedRenderFrame);
  const simTickRef = useRef(simTick);

  useEffect(() => {
    simTickRef.current = simTick;
  }, [simTick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.z = 6;

    const geometry = new THREE.TorusKnotGeometry(1, 0.15, 128, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let mounted = true;
    let previousTick = simTickRef.current;
    const render = () => {
      if (!mounted) return;
      const currentTick = simTickRef.current;
      if (currentTick - previousTick > 1) {
        reportDroppedRenderFrame();
      }
      previousTick = currentTick;
      mesh.rotation.x = currentTick * 0.02;
      mesh.rotation.y = currentTick * 0.03;
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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reportDroppedRenderFrame]);

  return <div ref={mountRef} className="tactical-canvas" aria-label="Tactical wireframe view" />;
}
