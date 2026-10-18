import * as THREE from "three";
import { plazaTexture } from "./world3d";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
  const iron = b.style === "iron", hb = b.style === "harbor";
  const wh = big ? 5.2 : 3.6, plaster = M(hb ? "#e4ddcc" : iron ? (b.kind === "smithy" ? "#5e5c58" : "#807d76") : b.kind === "smithy" ? "#8a7d6a" : "#cdbb93"), beam = M(hb ? "#3a4652" : iron ? "#2a2826" : "#3b2a1c"), stone = M(hb ? "#8a8478" : iron ? "#4e4b47" : "#6d675e");
  box(b.w, 0.8, b.d, stone, 0, 0.4, 0, g);
  box(b.w - 0.2, wh, b.d - 0.2, plaster, 0, 0.8 + wh / 2, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.35, wh, 0.35, beam, sx * (b.w / 2 - 0.1), 0.8 + wh / 2, sz * (b.d / 2 - 0.1), g);
  for (const sz of [-1, 1]) { box(b.w, 0.3, 0.3, beam, 0, 0.8 + wh, sz * (b.d / 2 - 0.05), g); box(b.w, 0.22, 0.25, beam, 0, 0.8 + wh * 0.5, sz * (b.d / 2 - 0.05), g); }
  for (let x = -b.w / 2 + 2; x < b.w / 2 - 1; x += 2.2) for (const sz of [-1, 1]) { const br = box(0.18, wh * 0.55, 0.2, beam, x, 0.8 + wh * 0.26, sz * (b.d / 2 - 0.02), g); br.rotation.z = 0.6; }
  const roof = gableRoof(b.w, b.d, big ? 3.6 : 2.6, M(hb ? (b.kind === "hall" ? "#7a3a2a" : "#2e5a72") : iron ? "#2e3640" : b.kind === "chapel" ? "#3d4a5a" : "#5a2e22"));
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
  if (b.kind === "hall") for (const x of [-3, 3]) box(0.9, 2.4, 0.06, M(hb ? "#2a5a7a" : "#7a1f1f"), x, 3.2, b.d / 2 + 0.1, g);
  if (hb && b.kind === "shop") { for (let i = 0; i < 3; i++) { const f = fish(M("#9ab0b8", { metalness: 0.4, roughness: 0.4 })); f.position.set(-1 + i, 3.1, b.d / 2 + 0.5); f.rotation.z = Math.PI / 2; g.add(f); } }
  return g;
}

function elderHut(b) {
  const g = new THREE.Group();
  const sun = b.style === "sun";
  const wood = M(sun ? "#9a6a3e" : "#5b3e26"), moss = M(sun ? "#c8963e" : "#4c5a2c"), stone = M(sun ? "#b8a888" : "#545a55"), win = M(sun ? "#ffd27a" : "#9fe8ff", { emissive: sun ? WARM : COOL, emissiveIntensity: 1.2 });
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
    const roof = cone(r + 1.4, 4.6, 10, M(sun ? "#a4532a" : "#6b6234"), 0, 6.2, 0, g); roof.rotation.y = 0.3;
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

function fish(m) {
  const f = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), m); body.scale.set(1.8, 0.7, 0.45); f.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), m); tail.rotation.z = Math.PI / 2; tail.position.x = -0.48; tail.scale.set(1, 1, 0.3); f.add(tail);
  return f;
}
function hull(g, L, W, wood, trim) {
  const sh = new THREE.Shape(); sh.moveTo(-L / 2, 0); sh.quadraticCurveTo(-L / 2, W / 2, -L / 6, W / 2); sh.lineTo(L / 4, W / 2); sh.quadraticCurveTo(L / 2, W / 3, L / 2 + 0.4, 0);
  sh.quadraticCurveTo(L / 2, -W / 3, L / 4, -W / 2); sh.lineTo(-L / 6, -W / 2); sh.quadraticCurveTo(-L / 2, -W / 2, -L / 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.3, bevelSegments: 2 }); geo.rotateX(Math.PI / 2); geo.translate(0, 0.55, 0);
  const h = new THREE.Mesh(geo, wood); h.scale.y = 1; g.add(h);
  box(L * 0.8, 0.1, W * 0.8, M("#7a5a3a"), 0, 0.42, 0, g);
  box(L * 0.85, 0.12, 0.12, trim, 0, 0.62, W / 2 + 0.05, g); box(L * 0.85, 0.12, 0.12, trim, 0, 0.62, -W / 2 - 0.05, g);
}
function caveMouth(g, p) {
  const rock = M("#5a554d"), dark = M("#3e3a35"), moss = M("#4a5a32");
  const back = new THREE.Mesh(new THREE.DodecahedronGeometry(6.2, 1), rock); back.scale.set(1.25, 0.85, 0.9); back.position.set(0, 1.4, -6.5); g.add(back);
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), dark); cheek.scale.set(0.9, 1.5, 1.2); cheek.position.set(sx * 4.1, 1.8, -2.6); cheek.rotation.set(0.2, sx * 0.4, sx * 0.15); g.add(cheek);
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rock); boulder.position.set(sx * 4.9, 0.5, -0.4); boulder.rotation.y = sx; g.add(boulder);
  }
  const lintel = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), rock); lintel.scale.set(2.0, 0.75, 1.1); lintel.position.set(0, 4.6, -2.6); g.add(lintel);
  const mossCap = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), moss); mossCap.scale.set(2.1, 0.35, 1.0); mossCap.position.set(0, 5.6, -2.9); g.add(mossCap);
  const arch = new THREE.Shape(); arch.moveTo(-2.3, 0); arch.lineTo(-2.3, 2.2); arch.quadraticCurveTo(-2.1, 4.0, 0, 4.1); arch.quadraticCurveTo(2.1, 4.0, 2.3, 2.2); arch.lineTo(2.3, 0); arch.lineTo(-2.3, 0);
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(arch, 10), new THREE.MeshBasicMaterial({ color: "#020101" })); hole.scale.set(1.15, 1.1, 1); hole.position.set(0, -0.05, -1.0); g.add(hole);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.6, 5, 12, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: "#030202", side: THREE.BackSide }));
  tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 0.5, -3.7); g.add(tunnel);
  for (let i = 0; i < 4; i++) { const st = box(4.2 - i * 0.5, 0.25, 0.9, M("#4a463f"), 0, -0.1 - i * 0.22, -0.4 - i * 0.85, g); st.rotation.x = 0.04; }
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.18, 0), dark); r.position.set((i - 2.5) * 1.6, 0.15, 1.2 + (i % 2) * 0.8); g.add(r); }
  for (const sx of [-1, 1]) {
    cyl(0.07, 0.09, 1.9, 5, M("#3a2a1a"), sx * 2.85, 0.95, -0.3, g);
    const f = cone(0.2, 0.5, 6, M("#ffb347", { emissive: "#ff6a00", emissiveIntensity: 3, transparent: true, opacity: 0.9 }), sx * 2.85, 2.1, -0.3, g); f.name = "flame";
  }
  const pl = new THREE.PointLight("#ff8a3a", 12, 10, 1.6); pl.position.set(0, 2.2, 1.6); pl.name = "flicker"; g.add(pl);
  const fog = new THREE.Mesh(new THREE.CircleGeometry(2.0, 16), new THREE.MeshBasicMaterial({ color: "#1a1512", transparent: true, opacity: 0.55, depthWrite: false })); fog.rotation.x = -Math.PI / 2; fog.position.set(0, 0.06, -0.6); g.add(fog);
  g.rotation.y = Math.atan2(p.face[0], p.face[1]);
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
      const cloth = box(3.0, 0.08, 2.2, M(p.x < 1160 ? "#7a2a22" : "#2a5a6a"), 0, 2.45, 0, g); cloth.rotation.x = 0.15;
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
    case "portal": {
      if (p.face) { caveMouth(g, p); break; }
      if (p.z > 0) {
        const rock = M("#3e3a35");
        for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0 + (i % 2) * 0.3, 0), rock); r.position.set(Math.cos(a) * 2.6, Math.sin(a) * 3.2, -0.6); g.add(r); }
        for (let i = 0; i < 4; i++) box(3.4, 0.3, 0.8, M("#55504a"), 0, 0.15 + i * 0.35, -1 - i * 0.7, g);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: "#fff0c8", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
        shaft.position.set(0, 7, -1.5); g.add(shaft);
        const pl = new THREE.PointLight("#ffe8b0", 22, 12, 1.4); pl.position.set(0, 4, -1); g.add(pl);
        break;
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 8, 32), M("#8a6aff", { emissive: "#7a4aff", emissiveIntensity: 2.4 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; ring.name = "spin"; g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: "#6a3aff", transparent: true, opacity: 0.45, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1; g.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 3.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#9a7aff", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 1.6; beam.name = "spin"; g.add(beam);
      for (let i = 0; i < 4; i++) { const r = box(0.5, 1.6, 0.5, M("#3a3640"), Math.cos(i * 1.57 + 0.78) * 2.3, 0.8, Math.sin(i * 1.57 + 0.78) * 2.3, g); r.rotation.y = i; box(0.3, 0.3, 0.3, M("#b090ff", { emissive: "#8a5aff", emissiveIntensity: 2 }), r.position.x, 1.75, r.position.z, g).name = "pulse"; }
      break; }
    case "brazier": {
      cyl(0.18, 0.28, 1.1, 6, M("#2a2622", { metalness: 0.6 }), 0, 0.55, 0, g); cyl(0.55, 0.3, 0.35, 8, M("#2a2622", { metalness: 0.6 }), 0, 1.2, 0, g);
      const f = cone(0.38, 0.95, 6, M("#ffb347", { emissive: "#ff6a00", emissiveIntensity: 3, transparent: true, opacity: 0.9 }), 0, 1.75, 0, g); f.name = "flame"; break; }
    case "stalagmite": { const sc = p.s || 1; cone(0.7 * sc, 3.2 * sc, 6, M("#4a4540"), 0, 1.6 * sc, 0, g); cone(0.4 * sc, 1.8 * sc, 5, M("#55504a"), 0.6 * sc, 0.9 * sc, 0.3 * sc, g); break; }
    case "bones": {
      const bm = M("#d8d0b8");
      for (let i = 0; i < 5; i++) { const b = cyl(0.05, 0.05, 0.7, 4, bm, Math.cos(i * 1.3) * 0.4, 0.06, Math.sin(i * 1.3) * 0.4, g); b.rotation.set(Math.PI / 2, i * 0.9, 0); }
      const sk = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), bm); sk.position.set(0.1, 0.15, 0); g.add(sk); g.scale.setScalar(p.s || 1); break; }
    case "throne": {
      const stn = M("#2a2630"), gold = M("#c9a24e", { metalness: 0.8, roughness: 0.3 });
      box(4, 0.6, 4, stn, 0, 0.3, 0, g); box(2.2, 1.2, 2, stn, 0, 1.2, 0, g); box(0.5, 4.5, 2.4, stn, 0.9, 2.8, 0, g);
      for (const sz of [-1.1, 1.1]) { box(1.8, 0.4, 0.3, stn, 0, 2.0, sz, g); cone(0.2, 1.2, 4, gold, 0.9, 5.6, sz, g); }
      box(0.15, 1, 1, M("#b060ff", { emissive: "#8a3aff", emissiveIntensity: 2 }), 0.62, 4.2, 0, g).name = "pulse"; break; }
    case "dock": {
      const plank = M("#6a4c30"), post = M("#3e2c1c");
      const along = p.d > p.w, L = along ? p.d : p.w, Wd = along ? p.w : p.d;
      for (let i = 0; i < L / 0.6; i++) { const b = box(along ? Wd : 0.55, 0.12, along ? 0.55 : Wd, M(i % 3 ? "#6a4c30" : "#5e4228"), along ? 0 : -L / 2 + i * 0.6 + 0.3, 0.5, along ? -L / 2 + i * 0.6 + 0.3 : 0, g); b.receiveShadow = true; }
      for (let i = 0; i <= L / 3; i++) for (const s of [-1, 1]) { const o = -L / 2 + i * 3; cyl(0.16, 0.18, 2.6, 6, post, along ? s * (Wd / 2 - 0.1) : o, -0.6, along ? o : s * (Wd / 2 - 0.1), g); }
      for (const s of [-1, 1]) box(along ? 0.12 : L, 0.1, along ? L : 0.12, plank, along ? s * (Wd / 2) : 0, 1.3, along ? 0 : s * (Wd / 2), g);
      g.position.set(p.x, 0, p.z); return g; }
    case "boat": case "ferry": {
      const big = p.kind === "ferry", wood = M(big ? "#5a3a22" : ["#6a4a2a", "#4a5a6a", "#7a3a2a"][Math.floor(p.x) % 3]), trim = M(big ? "#c9a24e" : "#e4ddcc");
      hull(g, big ? 9 : 4.6, big ? 3.2 : 1.8, wood, trim);
      if (big) {
        cyl(0.14, 0.18, 7, 6, M("#3e2c1c"), 0.6, 4, 0, g);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.2, 4, 4), M("#e8dcc0", { side: THREE.DoubleSide })); sail.position.set(0.6, 4.6, 0); sail.rotation.y = Math.PI / 2; sail.name = "sail"; g.add(sail);
        box(2.2, 1.0, 2.0, M("#4a3020"), -2.6, 1.0, 0, g); lantern(WARM, 4.6, 1.4, 0);
      } else { for (const s of [-1, 1]) { const oar = cyl(0.04, 0.04, 2.4, 4, M("#7a5a3a"), 0, 0.7, s * 1.0, g); oar.rotation.x = s * 1.1; } }
      g.rotation.y = -(p.rot || 0); g.position.set(p.x, -0.6, p.z); g.name = "bob"; return g; }
    case "wreck": {
      const wood = M("#3a3026");
      hull(g, 8, 3, wood, M("#2a221a")); g.children.forEach((c) => { c.rotation.z += 0.0; });
      cyl(0.14, 0.18, 4.5, 6, wood, 0.8, 2.2, 0, g).rotation.z = 0.5;
      for (let i = 0; i < 5; i++) box(0.2, 1.4, 0.2, wood, -3 + i * 1.3, 1.2, 1.4, g).rotation.x = 0.3;
      g.rotation.set(0.25, -(p.rot || 0), 0.18); g.position.set(p.x, terrain.height(p.x, p.z) - 0.2, p.z); return g; }
    case "totem": {
      const pole = M("#5a4026"), paint = M("#9a3a1a"), sk = M("#d8d0b8");
      cyl(0.18, 0.24, 3.4, 6, pole, 0, 1.7, 0, g);
      for (let i = 0; i < 3; i++) { const b = box(0.5, 0.45, 0.5, i % 2 ? paint : pole, 0, 1.2 + i * 0.75, 0, g); b.rotation.y = i * 0.6; }
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), sk); s.position.y = 3.55; s.scale.set(1, 0.9, 1.1); g.add(s);
      for (const sx of [-1, 1]) { const h = cone(0.07, 0.5, 5, sk, sx * 0.25, 3.8, 0, g); h.rotation.z = -sx * 0.6; }
      for (let i = 0; i < 4; i++) { const f = box(0.06, 0.5, 0.02, M(["#c84a2a", "#e8c040", "#2a6a3a"][i % 3]), Math.cos(i * 1.6) * 0.3, 2.7, Math.sin(i * 1.6) * 0.3, g); f.rotation.z = 0.3; }
      break; }
    case "banner": {
      cyl(0.06, 0.07, 4.6, 5, M("#2a1f16"), 0, 2.3, 0, g);
      box(1.6, 0.08, 0.08, M("#2a1f16"), 0.7, 4.4, 0, g);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2, 3, 5), M("#7a1a12", { side: THREE.DoubleSide })); cloth.position.set(0.75, 3.25, 0); cloth.name = "sail"; g.add(cloth);
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), M("#1a1a1a", { side: THREE.DoubleSide })); mark.position.set(0.75, 3.4, 0.02); g.add(mark);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M("#d8d0b8")); s.position.y = 4.75; g.add(s);
      g.rotation.y = Math.random() * 6.28; break; }
    case "grave": {
      const st = M(["#6a665e", "#5a5650", "#77736a"][Math.floor(Math.abs(p.x * 7)) % 3]);
      const sh = new THREE.Shape(); sh.moveTo(-0.45, 0); sh.lineTo(-0.45, 0.9); sh.quadraticCurveTo(0, 1.35, 0.45, 0.9); sh.lineTo(0.45, 0); sh.lineTo(-0.45, 0);
      const t = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }), st); t.rotation.set(-0.15 + Math.random() * 0.1, 0, (Math.random() - 0.5) * 0.3); g.add(t);
      box(0.9, 0.08, 1.6, M("#4a3a28"), 0, 0.04, 0.95, g);
      g.rotation.y = -(p.rot || 0) + Math.PI / 2; break; }
    case "web": {
      const wm = new THREE.LineBasicMaterial({ color: "#e8e8e0", transparent: true, opacity: 0.5 }), pts = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(Math.cos(a) * 2.6, 0.05 + Math.random() * 0.4, Math.sin(a) * 2.6)); }
      for (let r = 0.5; r < 2.6; r += 0.45) for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, b = ((i + 1) / 10) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.08, Math.sin(a) * r), new THREE.Vector3(Math.cos(b) * r, 0.08, Math.sin(b) * r)); }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wm));
      const egg = M("#d8d4c0", { roughness: 0.6 });
      for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (i % 2) * 0.1, 8, 6), egg); e.scale.y = 1.3; e.position.set(Math.cos(i * 1.7) * 0.9, 0.3, Math.sin(i * 1.7) * 0.9); g.add(e); }
      g.rotation.y = p.rot || 0; break; }
    case "gate_iron": {
      const stn = M("#6f6a60"), iron = M("#1e1f22", { metalness: 0.7, roughness: 0.45 });
      for (const sx of [-1, 1]) { box(1.1, 3.6, 1.1, stn, sx * 4.2, 1.8, 0, g); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), stn); orb.position.set(sx * 4.2, 3.95, 0); g.add(orb); }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.08, 6, 24, Math.PI), iron); arch.position.y = 3.0; g.add(arch);
      box(7.4, 0.08, 0.08, iron, 0, 3.0, 0, g);
      for (let i = 0; i < 5; i++) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M("#d8d0b8")); sk.position.set(-1.6 + i * 0.8, 3.0 + Math.sin((i + 0.5) / 5 * Math.PI) * 1.2, 0); g.add(sk); }
      for (const sx of [-1, 1]) { const door = new THREE.Group(); for (let i = 0; i < 6; i++) cyl(0.03, 0.03, 2.6, 4, iron, -sx * (0.3 + i * 0.5), 1.3, 0, door); box(3.2, 0.06, 0.06, iron, -sx * 1.55, 2.4, 0, door); door.position.x = sx * 3.6; door.rotation.y = sx * 1.2; g.add(door); }
      g.rotation.y = -(p.rot || 0) - Math.PI / 2; break; }
    case "mausoleum": {
      const stn = M("#7a766c"), dark = M("#4a4740"), roof = M("#5a564e");
      box(9, 0.6, 7, dark, 0, 0.3, 0, g); box(8, 4.2, 6, stn, 0, 2.7, -0.2, g);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5.0, 2.2, 4, 1), roof); r.rotation.y = Math.PI / 4; r.scale.set(1.12, 1, 0.85); r.position.y = 5.9; g.add(r);
      for (const sx of [-2.6, -1, 1, 2.6]) cyl(0.32, 0.36, 4.2, 10, stn, sx, 2.7, 3.1, g);
      box(8.6, 0.5, 1.2, stn, 0, 5.0, 3.0, g);
      box(2, 3, 0.1, M("#141210"), 0, 2.1, 2.85, g);
      const stat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), stn); stat.position.set(0, 7.4, 0); g.add(stat);
      const gl = new THREE.PointLight("#7affc8", 6, 9, 1.6); gl.position.set(0, 2, 4); g.add(gl);
      g.rotation.y = p.rot || 0; break; }
    case "dead_tree": {
      const bark = M("#3a3028");
      const trunk = cyl(0.22, 0.4, 4.2, 6, bark, 0, 2.1, 0, g); trunk.rotation.z = 0.08;
      for (let i = 0; i < 5; i++) { const a = i * 1.3, b = cyl(0.05, 0.12, 2.2 - i * 0.2, 4, bark, Math.cos(a) * 0.6, 3 + i * 0.35, Math.sin(a) * 0.6, g); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
      g.scale.setScalar(p.s || 1); g.rotation.y = p.rot || 0; break; }
    case "fish_rack": {
      for (const sx of [-1.2, 1.2]) cyl(0.07, 0.08, 2.2, 5, wood, sx, 1.1, 0, g);
      box(2.6, 0.08, 0.08, wood, 0, 2.1, 0, g);
      for (let i = 0; i < 5; i++) { const f = fish(M(["#9ab0b8", "#b0a080", "#8a9aa0"][i % 3], { metalness: 0.3, roughness: 0.5 })); f.position.set(-1 + i * 0.5, 1.75, 0); f.rotation.z = Math.PI / 2; g.add(f); }
      break; }
    case "crates": { for (let i = 0; i < 3; i++) { const c = box(0.9, 0.9, 0.9, M(i % 2 ? "#7a5a36" : "#6a4a2a"), (i - 1) * 0.6, 0.45 + (i === 1 ? 0.9 : 0), (i % 2) * 0.3, g); c.rotation.y = i * 0.4; } break; }
    default: return null;
  }
  g.position.set(p.x, p.dock ? 0.55 : terrain.height(p.x, p.z), p.z);
  return g;
}

export function buildStructures(world, terrain, scene) {
  const root = new THREE.Group(), animated = [];
  const lights = { count: 0 };
  for (const b of world.buildings) {
    const town = world.towns[b.town || (b.style === "semel" ? "semel" : "elderglen")] || world.towns.elderglen;
    const dx = town[0] - b.x, dz = town[1] - b.z, side = Math.abs(dx) > Math.abs(dz);
    const bb = b.style !== "ruin" && side ? { ...b, w: b.d, d: b.w } : b;
    const g = b.style === "semel" || b.style === "iron" || b.style === "harbor" ? semelHouse(bb) : b.style === "elder" || b.style === "sun" ? elderHut(bb) : ruinBuilding(bb);
    if (b.style !== "ruin") g.rotation.y = side ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    g.position.set(b.x, terrain.height(b.x, b.z) - 0.1, b.z);
    root.add(g);
  }
  const wallStone = M("#6f6a60"), log = M("#4d3622"), cap = M("#5e594f");
  for (const w of world.walls) {
    const len = Math.hypot(w.x2 - w.x, w.z2 - w.z) + 0.3, ang = Math.atan2(w.z2 - w.z, w.x2 - w.x);
    const g = new THREE.Group();
    if (w.style === "iron") {
      const iron = M("#1e1f22", { metalness: 0.7, roughness: 0.45 });
      box(len, 0.45, 0.5, wallStone, 0, 0.22, 0, g);
      for (let i = 0; i < Math.round(len / 0.32); i++) { const x = -len / 2 + 0.16 + i * 0.32; cyl(0.025, 0.025, 1.9, 4, iron, x, 1.4, 0, g); cone(0.05, 0.16, 4, iron, x, 2.42, 0, g); }
      for (const y of [0.75, 2.05]) box(len, 0.06, 0.06, iron, 0, y, 0, g);
      box(0.32, 2.3, 0.32, wallStone, -len / 2, 1.15, 0, g); box(0.42, 0.14, 0.42, cap, -len / 2, 2.35, 0, g);
    } else if (w.style === "stone") { box(len, 2.6, 1.3, wallStone, 0, 1.3, 0, g); box(len * 0.45, 0.6, 1.4, cap, -len * 0.25, 2.9, 0, g); }
    else for (let i = 0; i < 3; i++) { cyl(0.35, 0.4, 4.4 + (i % 2) * 0.6, 6, log, -len / 2 + (i + 0.5) * len / 3, 2.2, 0, g); cone(0.36, 0.8, 6, log, -len / 2 + (i + 0.5) * len / 3, 4.8 + (i % 2) * 0.6, 0, g); }
    g.position.set((w.x + w.x2) / 2, terrain.height(w.x, w.z), (w.z + w.z2) / 2);
    g.rotation.y = -ang;
    root.add(g);
  }
  for (const p of world.props) {
    const g = prop(p, terrain, lights);
    if (g) { root.add(g); g.traverse((o) => { if (o.name) animated.push(o); }); }
  }
  for (const [town, style] of [["semel", "semel"], ["elderglen", "elder"], ["ironhold", "semel"], ["sunhollow", "elder"], ["harbor", "semel"]]) {
    if (!world.towns[town]) continue;
    const [x, z] = world.towns[town];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ map: plazaTexture(style), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); m.receiveShadow = true;
    root.add(m);
  }
  if (world.cave_rocks?.length) {
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M("#3a3632"), world.cave_rocks.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    world.cave_rocks.forEach(([x, z, sc], i) => { e.set(i * 0.7, i * 1.3, i * 0.4); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, terrain.height(x, z) * 0.45, z), q, new THREE.Vector3(sc * 1.1, sc * 0.85, sc * 1.1)); im.setMatrixAt(i, m4); });
    root.add(im);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.transparent && o.geometry.type !== "PlaneGeometry"; o.receiveShadow = true; } });
  mergeStatic(root, animated);
  scene.add(root);
  return animated;
}

// batch every static mesh into one mesh per (material, 64m chunk): thousands of draw calls -> a few hundred
function mergeStatic(root, animated) {
  root.updateMatrixWorld(true);
  const live = new Set(animated), groups = new Map(), victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    for (let q = o; q && q !== root; q = q.parent) if (live.has(q)) return;
    const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const key = `${o.material.uuid}|${Math.floor(wp.x / 64)}|${Math.floor(wp.z / 64)}|${o.castShadow ? 1 : 0}`;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups(); g.applyMatrix4(o.matrixWorld);
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    groups.get(key).geos.push(g); victims.push(o);
  });
  for (const o of victims) { o.parent.remove(o); o.geometry.dispose(); }
  for (const { mat, cast, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    root.add(m);
  }
}

export function animateStructures(list, t) {
  for (const o of list) {
    if (o.name === "flame") { o.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.2, 1); }
    else if (o.name === "flicker") o.intensity = 34 + Math.sin(t * 17) * 6 + Math.sin(t * 7.3) * 5;
    else if (o.name === "float") o.position.y += Math.sin(t * 1.5 + o.id) * 0.004;
    else if (o.name === "pulse") o.material.emissiveIntensity = 1 + Math.sin(t * 2) * 0.6;
    else if (o.name === "spin") o.rotation.z = t * 0.8;
    else if (o.name === "ember") o.material.emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.6;
    else if (o.name === "bob") { o.position.y = -0.6 + Math.sin(t * 1.3 + o.position.x) * 0.12; o.rotation.z = Math.sin(t * 1.1 + o.position.z) * 0.05; }
    else if (o.name === "sail") o.scale.x = 1 + Math.sin(t * 1.7) * 0.04;
  }
}
