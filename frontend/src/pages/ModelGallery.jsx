import { useEffect, useRef } from "react";
import * as THREE from "three";
import { setEnv } from "@/game/rig/tex";
import { buildPlayer, buildMonster, buildNpc, animateRig } from "@/game/models";

const API = process.env.REACT_APP_BACKEND_URL;
const SETS = {
  players: [["warrior", ""], ["wizard", "oak_staff"], ["warlock", "void_staff|spell_tome"], ["ranger", "hunting_bow"], ["warrior", "steel_longsword|iron_shield|iron_helm|chainmail|0,0|leather_boots|iron_greaves|leather_gloves"], ["warrior", "troll_maul||dreadknight_helm|dragonscale_plate|1,0|wolf_boots|titan_greaves|gauntlets_might"], ["ranger", "longbow||leather_cap|bandit_leathers|0,0|leather_boots|leather_pants"], ["wizard", "starfall_staff||crown_valor|archmage_vestments|1,0|tidecaller_boots"]],
  monsters: ["skeleton", "goblin_scout", "forest_bandit", "orc_warrior", "dark_cultist", "forest_troll", "crypt_ghoul", "death_knight"],
  monsters2: ["imp", "hollow_shade", "shadow_wraith", "stone_golem", "abyssal_fiend", "forest_wolf", "giant_spider", "bone_colossus"],
  npcs: ["guard", "smith", "merchant", "healer", "druid", "elder", "gilded", "villager", "child"],
};

export default function ModelGallery() {
  const ref = useRef();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), set = q.get("set") || "players", dist = Number(q.get("dist") || 9), pitch = Number(q.get("pitch") || 0.35);
    const renderer = new THREE.WebGLRenderer({ canvas: ref.current, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight); setEnv(renderer); renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#20262a");
    scene.add(new THREE.HemisphereLight("#b8cad4", "#4a3c26", 1.35));
    const sun = new THREE.DirectionalLight("#ffe2b8", 3); sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15 }); scene.add(sun);
    const rim = new THREE.DirectionalLight("#8fb0ff", 0.6); rim.position.set(-6, 5, -8); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: "#4a5a3a" })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const cam = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 200);
    const rigs = []; let raf, alive = true;
    fetch(`${API}/api/game/data`).then((r) => r.json()).then((data) => {
      if (!alive) return;
      const all = SETS[set] || SETS.players, list = q.get("only") ? q.get("only").split(",").map((k) => all[Number(k)]) : all, n = list.length, gap = set.startsWith("monsters") ? 3.2 : 1.6;
      list.forEach((it, i) => {
        const rig = set === "players" ? buildPlayer(it[0], it[1], data.items) : set === "npcs" ? buildNpc(it) : buildMonster(it);
        rig.root.position.x = (i - (n - 1) / 2) * gap; rig.root.rotation.y = Number(q.get("rot") || 0.35);
        scene.add(rig.root); rigs.push({ rig, a: { moving: q.get("walk") === "1" } });
      });
      const w = (n - 1) * gap; cam.position.set(0, Number(q.get("cy") || 1.2) + Math.sin(pitch) * (dist + w * 0.5), Math.cos(pitch) * (dist + w * 0.5)); cam.lookAt(0, Number(q.get("ly") || 1.1), 0);
    });
    let last = performance.now();
    const loop = () => { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now; rigs.forEach(({ rig, a }) => animateRig(rig, a, dt, t)); renderer.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    return () => { alive = false; cancelAnimationFrame(raf); renderer.dispose(); };
  }, []);
  return <canvas ref={ref} data-testid="model-gallery-canvas" style={{ display: "block", width: "100vw", height: "100vh" }} />;
}
