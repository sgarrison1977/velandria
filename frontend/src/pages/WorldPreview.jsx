import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Terrain, buildVegetation, buildWater, windUniform } from "@/game/world3d";
import { buildStructures, animateStructures } from "@/game/structures";
import { buildNpc } from "@/game/models";

const API = process.env.REACT_APP_BACKEND_URL;

// isolated world-preview (no login): /gallery?set=world&x=1080&z=600&d=60
export default function WorldPreview() {
  const ref = useRef();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), x = Number(q.get("x") || 1080), z = Number(q.get("z") || 600), d = Number(q.get("d") || 60), yaw = Number(q.get("yaw") || 0);
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a3631");
    scene.add(new THREE.HemisphereLight("#b8cad4", "#4a3c26", 1.35));
    const sun = new THREE.DirectionalLight("#ffe2b8", 3); sun.position.set(x - 30, 60, z + 20); sun.target.position.set(x, 0, z); scene.add(sun, sun.target);
    const cam = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 600);
    cam.position.set(x + Math.sin(yaw) * Math.cos(0.95) * d, Math.sin(0.95) * d, z + Math.cos(yaw) * Math.cos(0.95) * d); cam.lookAt(x, 0, z);
    let raf, alive = true, anim = [];
    Promise.all([fetch(`${API}/api/game/world`).then((r) => r.json()), fetch(`${API}/api/game/data`).then((r) => r.json())]).then(([world, data]) => {
      if (!alive) return;
      const terrain = new Terrain(world);
      scene.add(terrain.buildMesh()); buildVegetation(world, terrain, scene); buildWater(world, terrain, scene);
      anim = buildStructures(world, terrain, scene);
      for (const n of Object.values(data.npcs)) { if (Math.hypot(n.pos[0] - x, n.pos[1] - z) > 80) continue; const r = buildNpc(n.kind); r.root.position.set(n.pos[0], terrain.height(n.pos[0], n.pos[1]), n.pos[1]); scene.add(r.root); }
      window.__worldReady = true; window.__info = renderer.info; window.__scene = scene;
    });
    const loop = () => { const t = performance.now() / 1000; windUniform.value = t; animateStructures(anim, t); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    return () => { alive = false; cancelAnimationFrame(raf); renderer.dispose(); };
  }, []);
  return <canvas ref={ref} data-testid="world-preview-canvas" style={{ display: "block", width: "100vw", height: "100vh" }} />;
}
