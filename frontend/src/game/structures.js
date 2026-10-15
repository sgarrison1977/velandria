import * as THREE from "three";
import { plazaTexture } from "./world3d";

const mats = {};
const M = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
  return mats[k];
};
const box = (w, h, d, m, x = 0, y = 0, z = 0, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g && g.add(o); return o; };
const cyl = (rt, rb, h, seg, m, x = 0, y = 0, z = 0, g) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); g && g.add(o); return o; };
const cone = (r, h, seg, m, x = 0, y = 0, z = 0, g) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); o.position.set(x, y, z); g && g.add(o); return o; };
const WARM = "#ffb35a", COOL = "#7fe0ff";

function gableRoof(w, d, h, m) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.6, 0); s.lineTo(0, h); s.lineTo(w / 2 + 0.6, 0); s.lineTo(w / 2 + 0.6, 0.25); s.lineTo(0, h + 0.3); s.lineTo(-w / 2 - 0.6, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: d + 1.0, bevelEnabled: false }); g.translate(0, 0, -(d + 1) / 2);
  return new THREE.Mesh(g, m);
}

function semelHouse(b) {
  const g = new THREE.Group();
  const big = b.kind === "hall" || b.kind === "chapel";
  const wh = big ? 5.2 : 3.6, plaster = M(b.kind === "smithy" ? "#8a7d6a" : "#cdbb93"), beam = M("#3b2a1c"), stone = M("#6d675e");
  box(b.w, 0.8, b.d, stone, 0, 0.4, 0, g);
  box(b.w - 0.2, wh, b.d - 0.2, plaster, 0, 0.8 + wh / 2, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.35, wh, 0.35, beam, sx * (b.w / 2 - 0.1), 0.8 + wh / 2, sz * (b.d / 2 - 0.1), g);
  for (const sz of [-1, 1]) { box(b.w, 0.3, 0.3, beam, 0, 0.8 + wh, sz * (b.d / 2 - 0.05), g); box(b.w, 0.22, 0.25, beam, 0, 0.8 + wh * 0.5, sz * (b.d / 2 - 0.05), g); }
  for (let x = -b.w / 2 + 2; x < b.w / 2 - 1; x += 2.2) for (const sz of [-1, 1]) { const br = box(0.18, wh * 0.55, 0.2, beam, x, 0.8 + wh * 0.26, sz * (b.d / 2 - 0.02), g); br.rotation.z = 0.6; }
  const roof = gableRoof(b.w, b.d, big ? 3.6 : 2.6, M(b.kind === "chapel" ? "#3d4a5a" : "#5a2e22"));
  roof.position.y = 0.8 + wh; g.add(roof);
  const win = M("#ffcf7a", { emissive: WARM, emissiveIntensity: 1.4 });
  for (let x = -b.w / 2 + 1.6; x < b.w / 2 - 1; x += 2.6) for (const sz of [-1, 1]) {
    box(0.8, 0.9, 0.1, win, x, 0.8 + wh * 0.62, sz * (b.d / 2), g);
    box(1.0, 0.12, 0.2, beam, x, 0.8 + wh * 0.62 - 0.5, sz * (b.d / 2 + 0.05), g);
  }
  box(1.4, 2.3, 0.15, M("#2e1f14"), 0, 1.95, b.d / 2 + 0.02, g);
  if (b.kind === "smithy") { cyl(0.5, 0.6, 3, 6, stone, b.w / 2 - 1.5, 0.8 + wh + 2, -1, g); const glow = cyl(0.45, 0.45, 0.2, 6, M("#ff6a1f", { emissive: "#ff4a00", emissiveIntensity: 2 }), b.w / 2 - 1.5, 0.8 + wh + 3.5, -1, g); glow.name = "ember"; }
  else if (b.kind !== "chapel") cyl(0.35, 0.4, 2, 5, stone, -b.w / 4, 0.8 + wh + 1.6, -b.d / 4, g);
  if (b.kind === "chapel") { box(2.4, 6, 2.4, M("#a99a7c"), 0, 0.8 + wh + 2.6, -b.d / 2 + 1.5, g); cone(2.0, 3.5, 4, M("#3d4a5a"), 0, 0.8 + wh + 7.3, -b.d / 2 + 1.5, g).rotation.y = Math.PI / 4; }
  if (b.name) { const s = box(2.2, 0.8, 0.12, M("#4a3020"), 0, 3.6, b.d / 2 + 0.45, g); s.name = "sign"; }
  if (b.kind === "hall") for (const x of [-3, 3]) box(0.9, 2.4, 0.06, M("#7a1f1f"), x, 3.2, b.d / 2 + 0.1, g);
  return g;
}

function elderHut(b) {
  const g = new THREE.Group();
  const wood = M("#5b3e26"), moss = M("#4c5a2c"), stone = M("#545a55"), win = M("#9fe8ff", { emissive: COOL, emissiveIntensity: 1.2 });
  if (b.kind === "longhouse") {
    box(b.w, 0.7, b.d, stone, 0, 0.35, 0, g); box(b.w - 0.3, 3.4, b.d - 0.3, wood, 0, 2.4, 0, g);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2 + 0.8, b.d / 2 + 0.8, b.w + 1, 10, 1, false, 0, Math.PI), moss);
    r.rotation.z = Math.PI / 2; r.rotation.y = Math.PI / 2; r.rotation.set(0, 0, Math.PI / 2); r.rotation.x = Math.PI / 2; r.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    r.position.y = 4.1; r.scale.set(1, 1, 0.6); g.add(r);
    for (let x = -b.w / 2 + 2; x < b.w / 2; x += 3) box(0.9, 0.9, 0.1, win, x, 2.6, b.d / 2 - 0.1, g);
    for (const x of [-b.w / 2, b.w / 2]) { const horn = cone(0.25, 2.2, 5, wood, x, 6.0, 0, g); horn.rotation.z = x > 0 ? -0.5 : 0.5; }
  } else {
    const r = b.w / 2;
    cyl(r, r + 0.2, 0.8, 10, stone, 0, 0.4, 0, g);
    cyl(r - 0.3, r - 0.2, 3.2, 10, wood, 0, 2.4, 0, g);
    const roof = cone(r + 1.4, 4.6, 10, M("#6b6234"), 0, 6.2, 0, g); roof.rotation.y = 0.3;
    cone(r + 1.5, 1.2, 10, moss, 0, 4.4, 0, g).scale.set(1, 0.5, 1);
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.8; const w = cyl(0.45, 0.45, 0.12, 8, win, Math.sin(a) * (r - 0.2), 2.8, Math.cos(a) * (r - 0.2), g); w.rotation.x = Math.PI / 2; w.rotation.z = -a; w.lookAt(Math.sin(a) * 99, 2.8, Math.cos(a) * 99); w.rotateX(Math.PI / 2); }
    box(1.3, 2.2, 0.3, M("#2a1d12"), 0, 1.9, r - 0.1, g);
  }
  return g;
}

function ruinBuilding(b) {
  const g = new THREE.Group(), st = M("#6a665c"), wood = M("#3a2e22");
  if (b.kind === "tower") {
    const t = cyl(2.6, 3, 7, 8, st, 0, 3.5, 0, g);
    t.scale.set(1, 1, 1);
    for (let i = 0; i < 8; i += 2) box(1.2, 1.2, 1.0, st, Math.cos(i * 0.785) * 2.6, 7.5, Math.sin(i * 0.785) * 2.6, g);
  } else if (b.kind === "shrine") {
    box(b.w, 0.6, b.d, st, 0, 0.3, 0, g);
    for (const sx of [-1, 1]) cyl(0.35, 0.4, 3.4, 6, st, sx * (b.w / 2 - 0.6), 2.0, 0, g);
    box(b.w, 0.6, 1.6, st, 0, 3.9, 0, g);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), M("#cfe8ff", { emissive: "#88c8ff", emissiveIntensity: 1.5 })); orb.position.y = 1.5; orb.name = "float"; g.add(orb);
  } else {
    box(b.w, 2.8, 0.5, st, 0, 1.4, -b.d / 2, g); box(0.5, 2.0, b.d, st, -b.w / 2, 1.0, 0, g); box(b.w * 0.6, 1.4, 0.5, st, -b.w * 0.2, 0.7, b.d / 2, g);
    const beam = box(b.w, 0.3, 0.3, wood, 0, 2.4, 0, g); beam.rotation.z = 0.3;
  }
  return g;
}

function prop(p, terrain, lights) {
  const g = new THREE.Group();
  const st = M("#77726a"), wood = M("#4e3826"), iron = M("#2e2e30", { metalness: 0.6, roughness: 0.4 });
  const lantern = (color, x, y, z) => { const l = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), M(color, { emissive: color, emissiveIntensity: 2.2 })); l.position.set(x, y, z); g.add(l); return l; };
  switch (p.kind) {
    case "fountain": {
      cyl(4.2, 4.5, 0.8, 16, st, 0, 0.4, 0, g); cyl(3.7, 3.7, 0.3, 16, M("#2f5f6a", { roughness: 0.1, metalness: 0.3, emissive: "#0a2a30" }), 0, 0.75, 0, g);
      cyl(0.6, 0.8, 2.6, 8, st, 0, 1.6, 0, g); cyl(1.6, 1.0, 0.4, 12, st, 0, 2.9, 0, g);
      const statue = cyl(0.3, 0.45, 1.6, 6, M("#8f8a7c"), 0, 3.9, 0, g); statue.name = "statue";
      const spray = cone(0.5, 1.2, 8, M("#bfe6ff", { transparent: true, opacity: 0.5, emissive: "#4a8aa0" }), 0, 5.1, 0, g); spray.name = "float";
      break; }
    case "elder_tree": {
      const bark = M("#5c4a36");
      cyl(1.6, 3.4, 16, 9, bark, 0, 8, 0, g);
      for (let i = 0; i < 6; i++) { const r = cyl(0.3, 1.0, 5, 5, bark, Math.cos(i) * 3, 0.8, Math.sin(i) * 3, g); r.rotation.set(Math.sin(i) * 1.1, 0, -Math.cos(i) * 1.1); }
      const leaf = M("#2b5f55", { emissive: "#123c3a", emissiveIntensity: 0.6 });
      for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(5 + (i % 3), 1), leaf); s.position.set(Math.cos(i * 0.9) * 6, 17 + (i % 3) * 2, Math.sin(i * 0.9) * 6); g.add(s); }
      for (let i = 0; i < 14; i++) lantern(COOL, Math.cos(i * 0.45) * 7.5, 11 + (i % 4), Math.sin(i * 0.45) * 7.5).name = "float";
      const pl = new THREE.PointLight(COOL, 60, 30, 1.6); pl.position.set(0, 10, 0); g.add(pl);
      break; }
    case "lamp": case "spirit_lamp": {
      const c = p.kind === "lamp" ? WARM : COOL;
      cyl(0.08, 0.12, 3.4, 6, iron, 0, 1.7, 0, g); box(0.6, 0.08, 0.08, iron, 0.25, 3.3, 0, g);
      lantern(c, 0.5, 3.0, 0);
      if (lights.count++ < 14) { const pl = new THREE.PointLight(c, 14, 12, 1.8); pl.position.set(0.5, 2.8, 0); g.add(pl); }
      break; }
    case "stall": {
      for (const sx of [-1.2, 1.2]) for (const sz of [-0.8, 0.8]) cyl(0.07, 0.07, 2.4, 5, wood, sx, 1.2, sz, g);
      box(2.6, 0.12, 1.8, wood, 0, 0.9, 0, g);
      const cloth = box(3.0, 0.08, 2.2, M(p.x < 1000 ? "#7a2a22" : "#2a5a6a"), 0, 2.45, 0, g); cloth.rotation.x = 0.15;
      for (let i = 0; i < 4; i++) box(0.4, 0.3, 0.4, M(["#8a6a3a", "#5a3a2a", "#9a9a90", "#6a4a8a"][i]), -0.9 + i * 0.6, 1.12, 0, g);
      break; }
    case "sign": { cyl(0.08, 0.1, 2.4, 5, wood, 0, 1.2, 0, g); box(1.4, 0.5, 0.08, M("#6b4e30"), 0.4, 2.0, 0, g); break; }
    case "anvil": { box(0.5, 0.5, 0.5, wood, 0, 0.25, 0, g); box(0.9, 0.3, 0.35, iron, 0, 0.65, 0, g); break; }
    case "barrels": for (let i = 0; i < 3; i++) cyl(0.4, 0.4, 0.9, 10, wood, (i - 1) * 0.85, 0.45, (i % 2) * 0.5, g); break;
    case "well": { cyl(1.2, 1.3, 0.9, 12, st, 0, 0.45, 0, g); for (const sx of [-1, 1]) box(0.15, 2.2, 0.15, wood, sx * 1.0, 1.4, 0, g); const r = box(2.4, 0.8, 1.6, M("#5a2e22"), 0, 2.8, 0, g); r.rotation.x = Math.PI / 4; r.scale.set(1, 0.4, 1); break; }
    case "moonwell": { cyl(1.6, 1.8, 0.7, 12, M("#5a6a66"), 0, 0.35, 0, g); cyl(1.35, 1.35, 0.1, 12, M("#9ff0ff", { emissive: COOL, emissiveIntensity: 1.6 }), 0, 0.72, 0, g); const pl = new THREE.PointLight(COOL, 25, 10); pl.position.y = 1.5; g.add(pl); break; }
    case "gate_stone": {
      const ang = p.rot; g.rotation.y = -ang + Math.PI / 2;
      for (const sx of [-5, 5]) { box(2.4, 6, 2.4, st, sx, 3, 0, g); cone(1.9, 2.4, 4, M("#5a2e22"), sx, 7.2, 0, g).rotation.y = Math.PI / 4; lantern(WARM, sx * 0.72, 3.5, 1.4); }
      box(12.4, 1.2, 1.6, st, 0, 6.4, 0, g); break; }
    case "gate_palisade": {
      g.rotation.y = -p.rot + Math.PI / 2;
      for (const sx of [-5, 5]) { cyl(0.6, 0.7, 7.5, 7, wood, sx, 3.75, 0, g); lantern(COOL, sx * 0.85, 4, 1); }
      box(12, 0.6, 0.7, wood, 0, 6.6, 0, g); box(10, 0.4, 0.5, wood, 0, 5.8, 0, g); break; }
    case "cave": case "cave_small": {
      const s = p.kind === "cave" ? 1 : 0.6;
      const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(7 * s, 1), M("#4f4b45")); mound.scale.set(1.3, 0.75, 1); mound.position.set(0, 1, -3 * s); g.add(mound);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(2.6 * s, 12), new THREE.MeshBasicMaterial({ color: "#050403" })); hole.position.set(0, 2.2 * s, 3.4 * s); g.add(hole);
      if (p.kind === "cave") for (let i = 0; i < 2; i++) { const t = new THREE.PointLight("#ff8a3a", 8, 8); t.position.set(i ? 3 : -3, 2, 5); g.add(t); lantern(WARM, i ? 3 : -3, 2, 5); }
      g.rotation.y = Math.PI; break; }
    case "sealed_gate": {
      for (const sz of [-4, 4]) box(1.6, 8, 1.6, M("#3a3d42"), 0, 4, sz, g);
      box(1.4, 1.4, 9.6, M("#3a3d42"), 0, 8.2, 0, g);
      const seal = box(0.3, 7, 6.6, M("#2a2340", { emissive: "#6a3aff", emissiveIntensity: 0.9, transparent: true, opacity: 0.75 }), 0, 3.5, 0, g); seal.name = "pulse"; break; }
    case "standing_ring": {
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const s = box(1.0, 3.4 + (i % 3) * 0.8, 0.7, M("#6d6a62"), Math.cos(a) * 7, 1.6, Math.sin(a) * 7, g); s.rotation.y = -a; s.rotation.z = (i % 2 - 0.5) * 0.12; }
      cyl(1.3, 1.5, 0.6, 7, M("#5a5a52"), 0, 0.3, 0, g);
      const rune = cyl(0.9, 0.9, 0.05, 16, M("#9fe8ff", { emissive: "#5fcaff", emissiveIntensity: 1.2 }), 0, 0.62, 0, g); rune.name = "pulse"; break; }
    case "campfire": {
      for (let i = 0; i < 5; i++) { const l = cyl(0.12, 0.12, 1.4, 5, M("#3a2a1a"), 0, 0.15, 0, g); l.rotation.set(Math.PI / 2, i * 1.25, 0.3); }
      for (let i = 0; i < 8; i++) box(0.4, 0.3, 0.4, st, Math.cos(i * 0.785) * 1.1, 0.15, Math.sin(i * 0.785) * 1.1, g);
      const f = cone(0.55, 1.4, 6, M("#ffb347", { emissive: "#ff6a00", emissiveIntensity: 2.5, transparent: true, opacity: 0.9 }), 0, 0.8, 0, g); f.name = "flame";
      const pl = new THREE.PointLight(p.style === "cultist" ? "#b06aff" : "#ff8a3a", 40, 18, 1.6); pl.position.y = 1.6; pl.name = "flicker"; g.add(pl); break; }
    case "tent": {
      const c = { goblin: "#5a5a2a", bandit: "#4a3a2a", orc: "#6a2a1a", cultist: "#2a1a3a" }[p.style] || "#5a4a3a";
      const t = cone(2.4, 2.8, 4, M(c), 0, 1.4, 0, g); t.rotation.y = Math.PI / 4;
      cyl(0.06, 0.06, 3.4, 4, wood, 0, 1.7, 0, g); g.rotation.y = p.rot || 0;
      if (p.style === "orc") for (let i = 0; i < 2; i++) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), M("#d8d0b8")); sk.position.set(i ? 0.6 : -0.6, 3.3, 0); g.add(sk); }
      break; }
    case "obelisk": { const o = box(0.9, 4.2, 0.9, M("#1f1a24"), 0, 2.1, 0, g); o.scale.set(1, 1, 1); cone(0.65, 0.9, 4, M("#1f1a24"), 0, 4.6, 0, g); box(0.92, 0.3, 0.92, M("#a060ff", { emissive: "#8a3aff", emissiveIntensity: 2 }), 0, 3.0, 0, g).name = "pulse"; break; }
    case "ruin_wall": {
      const n = Math.max(1, Math.round(Math.max(p.w, p.d) / 1.4));
      for (let i = 0; i < n; i++) { const h = 1 + ((i * 7919) % 5) * 0.6; const along = (i + 0.5) / n - 0.5; box(p.w > p.d ? p.w / n : p.w, h, p.w > p.d ? p.d : p.d / n, M(i % 3 ? "#6a665c" : "#5c6450"), p.w > p.d ? along * p.w : 0, h / 2, p.w > p.d ? 0 : along * p.d, g); }
      break; }
    case "pillar": { cyl(0.55, 0.65, p.h, 8, M("#77736a"), 0, p.h / 2, 0, g); box(1.4, 0.4, 1.4, M("#6a665c"), 0, 0.2, 0, g); break; }
    default: return null;
  }
  g.position.set(p.x, terrain.height(p.x, p.z), p.z);
  return g;
}

export function buildStructures(world, terrain, scene) {
  const root = new THREE.Group(), animated = [];
  const lights = { count: 0 };
  for (const b of world.buildings) {
    const town = b.style === "semel" ? world.towns.semel : world.towns.elderglen;
    const dx = town[0] - b.x, dz = town[1] - b.z, side = Math.abs(dx) > Math.abs(dz);
    const bb = b.style !== "ruin" && side ? { ...b, w: b.d, d: b.w } : b;
    const g = b.style === "semel" ? semelHouse(bb) : b.style === "elder" ? elderHut(bb) : ruinBuilding(bb);
    if (b.style !== "ruin") g.rotation.y = side ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    g.position.set(b.x, terrain.height(b.x, b.z) - 0.1, b.z);
    root.add(g);
  }
  const wallStone = M("#6f6a60"), log = M("#4d3622"), cap = M("#5e594f");
  for (const w of world.walls) {
    const len = Math.hypot(w.x2 - w.x, w.z2 - w.z) + 0.3, ang = Math.atan2(w.z2 - w.z, w.x2 - w.x);
    const g = new THREE.Group();
    if (w.style === "stone") { box(len, 2.6, 1.3, wallStone, 0, 1.3, 0, g); box(len * 0.45, 0.6, 1.4, cap, -len * 0.25, 2.9, 0, g); }
    else for (let i = 0; i < 3; i++) { cyl(0.35, 0.4, 4.4 + (i % 2) * 0.6, 6, log, -len / 2 + (i + 0.5) * len / 3, 2.2, 0, g); cone(0.36, 0.8, 6, log, -len / 2 + (i + 0.5) * len / 3, 4.8 + (i % 2) * 0.6, 0, g); }
    g.position.set((w.x + w.x2) / 2, terrain.height(w.x, w.z), (w.z + w.z2) / 2);
    g.rotation.y = -ang;
    root.add(g);
  }
  for (const p of world.props) {
    const g = prop(p, terrain, lights);
    if (g) { root.add(g); g.traverse((o) => { if (o.name) animated.push(o); }); }
  }
  for (const [town, style] of [["semel", "semel"], ["elderglen", "elder"]]) {
    const [x, z] = world.towns[town];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ map: plazaTexture(style), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); m.receiveShadow = true;
    root.add(m);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.transparent && o.geometry.type !== "PlaneGeometry"; o.receiveShadow = true; } });
  scene.add(root);
  return animated;
}

export function animateStructures(list, t) {
  for (const o of list) {
    if (o.name === "flame") { o.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1); }
    else if (o.name === "flicker") o.intensity = 34 + Math.sin(t * 17) * 6 + Math.sin(t * 7.3) * 5;
    else if (o.name === "float") o.position.y += Math.sin(t * 1.5 + o.id) * 0.004;
    else if (o.name === "pulse") o.material.emissiveIntensity = 1 + Math.sin(t * 2) * 0.6;
    else if (o.name === "ember") o.material.emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.6;
  }
}
