import * as THREE from "three";
import { mat, glowMat } from "./tex";
import { G, lathe, tube, sculpt } from "./geo";

export const mesh = (geo, m, x = 0, y = 0, z = 0, parent, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; parent && parent.add(o); return o;
};
const cyl = (r1, r2, h, s = 10) => G(`c${r1},${r2},${h},${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const sph = (r, a = 12, b = 10) => G(`s${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const extrude = (key, draw, depth, bevel) => G("x" + key, () => {
  const s = new THREE.Shape(); draw(s);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 1.6, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
});
const blade = (L, w) => extrude(`blade${L}${w}`, (s) => { s.moveTo(-w / 2, 0); s.lineTo(-w / 2 * 0.92, L * 0.82); s.lineTo(0, L); s.lineTo(w / 2 * 0.92, L * 0.82); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); }, 0.006, 0.005);
const gnarl = (len, seed) => [0, 1, 2, 3, 4, 5, 6].map((i) => [Math.sin(i * 1.7 + seed) * 0.018, (i / 6) * len, Math.cos(i * 2.3 + seed) * 0.018]);

export function weaponMesh(kind, color = "#9aa0a6", glow) {
  const g = new THREE.Group(), steel = mat("metal", color, {}), wood = mat("leather", "#5a3a22"), grip = mat("leather", "#2a1a10"), brass = mat("metal", "#b8913f");
  if (kind === "sword" || kind === "dagger") {
    const L = kind === "sword" ? 0.88 : 0.38;
    mesh(blade(L, kind === "sword" ? 0.075 : 0.06), steel, 0, 0.13, 0, g);
    mesh(box(0.012, L * 0.7, 0.014), mat("metal", "#5a5e66"), 0, 0.13 + L * 0.38, 0, g);
    mesh(tube("guard", [[-0.14, 0.02, 0], [-0.07, 0, 0], [0, -0.01, 0], [0.07, 0, 0], [0.14, 0.02, 0]], 0.016, 10, false), brass, 0, 0.12, 0, g);
    mesh(cyl(0.022, 0.02, 0.17), grip, 0, 0.03, 0, g);
    mesh(sph(0.032), brass, 0, -0.065, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (kind === "axe") {
    mesh(tube("haft", gnarl(1.05, 1).map(([x, y, z]) => [x * 0.3, y - 0.2, z * 0.3]), 0.026, 10, false), wood, 0, 0, 0, g);
    const head = extrude("axehead", (s) => { s.moveTo(0, -0.07); s.quadraticCurveTo(0.14, -0.1, 0.2, -0.2); s.quadraticCurveTo(0.27, 0, 0.2, 0.2); s.quadraticCurveTo(0.14, 0.1, 0, 0.07); s.lineTo(0, -0.07); }, 0.02, 0.008);
    mesh(head, steel, 0, 0.72, 0.02, g, 0, -Math.PI / 2, 0);
    mesh(cyl(0.04, 0.04, 0.16, 8), steel, 0, 0.72, 0, g);
    mesh(G("spike", () => new THREE.ConeGeometry(0.03, 0.12, 6)), steel, 0, 0.72, -0.09, g, -Math.PI / 2, 0, 0);
    g.rotation.x = Math.PI / 2;
  } else if (kind === "club") {
    mesh(lathe("club", [[0.035, -0.1], [0.04, 0.2], [0.07, 0.6], [0.14, 0.95], [0.12, 1.05], [0.001, 1.08]], 10), mat("leather", color), 0, 0, 0, g);
    for (let i = 0; i < 6; i++) mesh(G("knob", () => new THREE.ConeGeometry(0.025, 0.07, 5)), mat("bone", "#c8c0a8"), Math.sin(i * 2.1) * 0.12, 0.75 + (i % 3) * 0.1, Math.cos(i * 2.1) * 0.12, g, Math.cos(i * 2.1) * 1.4, 0, -Math.sin(i * 2.1) * 1.4);
    g.rotation.x = Math.PI / 2.2;
  } else if (kind === "maul" || kind === "hammer") {
    const big = kind === "maul", r = big ? 0.11 : 0.065, L = big ? 0.36 : 0.22, y = big ? 0.88 : 0.5;
    mesh(cyl(0.024, 0.026, big ? 1.1 : 0.62), wood, 0, big ? 0.35 : 0.2, 0, g);
    mesh(cyl(0.03, 0.028, 0.16), grip, 0, big ? -0.1 : -0.05, 0, g);
    mesh(G("mhead" + big, () => new THREE.CylinderGeometry(r, r, L, 8)), steel, 0, y, 0, g, 0, 0, Math.PI / 2);
    for (const sd of [-1, 1]) { mesh(G("mband" + big, () => new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.035, 8)), brass, sd * L * 0.42, y, 0, g, 0, 0, Math.PI / 2); mesh(G("mface" + big, () => new THREE.CylinderGeometry(r * 0.75, r * 0.95, 0.03, 8)), steel, sd * (L / 2 + 0.012), y, 0, g, 0, 0, sd * Math.PI / 2); }
    mesh(G("mspike" + big, () => new THREE.ConeGeometry(r * 0.35, r * 0.9, 6)), steel, 0, y + r * 1.3, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (kind === "spear") {
    mesh(cyl(0.02, 0.022, 2.0, 8), wood, 0, 0.3, 0, g);
    mesh(blade(0.32, 0.07), steel, 0, 1.28, 0, g);
    mesh(cyl(0.028, 0.022, 0.08), brass, 0, 1.27, 0, g);
  } else if (kind === "staff") {
    mesh(tube("staff", gnarl(1.75, 3).map(([x, y, z]) => [x, y - 0.5, z]), 0.03, 14, false), mat("leather", color === "#9aa0a6" ? "#5a4026" : color), 0, 0, 0, g);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; mesh(tube("claw", [[0, 0, 0], [0.05, 0.07, 0], [0.05, 0.16, 0], [0.01, 0.22, 0]], 0.012, 8), mat("leather", "#3a2a1a"), 0, 1.15, 0, g, 0, a, 0); }
    mesh(cyl(0.035, 0.03, 0.06), brass, 0, 1.16, 0, g);
    const orb = mesh(G("orb", () => new THREE.IcosahedronGeometry(0.085, 2)), glowMat(glow || "#7fd0ff", 2.4), 0, 1.31, 0, g); orb.name = "orb";
  } else if (kind === "bow") {
    const arc = [[0, -0.6, -0.06], [0, -0.45, 0.02], [0, -0.2, 0.06], [0, 0, 0.05], [0, 0.2, 0.06], [0, 0.45, 0.02], [0, 0.6, -0.06]];
    mesh(tube("bow", arc, 0.02, 20, false), mat("leather", color === "#9aa0a6" ? "#6a4628" : color), 0, 0, 0, g);
    mesh(cyl(0.026, 0.026, 0.14), grip, 0, 0, 0.05, g);
    mesh(cyl(0.003, 0.003, 1.2, 3), mat("plain", "#e8e0c8"), 0, 0, -0.06, g);
    g.rotation.y = Math.PI / 2;
  }
  return g;
}

export function shieldMesh(kind, color) {
  const g = new THREE.Group();
  if (kind === "iron") {
    const kite = extrude("kite", (s) => { s.moveTo(0, 0.3); s.quadraticCurveTo(0.24, 0.3, 0.24, 0.12); s.quadraticCurveTo(0.22, -0.18, 0, -0.38); s.quadraticCurveTo(-0.22, -0.18, -0.24, 0.12); s.quadraticCurveTo(-0.24, 0.3, 0, 0.3); }, 0.03, 0.015);
    mesh(kite, mat("metal", color), 0, 0, 0, g);
    mesh(box(0.05, 0.5, 0.02), mat("metal", "#c9a24e"), 0, -0.02, 0.03, g);
    mesh(box(0.34, 0.05, 0.02), mat("metal", "#c9a24e"), 0, 0.12, 0.03, g);
  } else {
    mesh(G("rshield", () => sculpt(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), (v) => { if (v.y > 0) v.y += (1 - Math.hypot(v.x, v.z) / 0.3) * 0.04; })), mat("leather", color), 0, 0, 0, g, Math.PI / 2, 0, 0);
    mesh(G("rim", () => new THREE.TorusGeometry(0.3, 0.018, 6, 28)), mat("metal", "#5a5a60"), 0, 0, 0, g);
    mesh(G("boss", () => new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat("metal", "#8a8a90"), 0, 0, 0.04, g, Math.PI / 2, 0, 0);
  }
  return g;
}
export function tomeMesh() {
  const g = new THREE.Group();
  mesh(box(0.2, 0.26, 0.05), mat("leather", "#4a2a5a"), 0, 0, 0, g);
  mesh(box(0.185, 0.245, 0.055), mat("cloth", "#e8dcc0"), 0.012, 0, 0, g);
  mesh(box(0.06, 0.06, 0.06), glowMat("#c08aff", 1.4), 0, 0, 0.005, g);
  return g;
}
export function quiverMesh() {
  const g = new THREE.Group();
  mesh(cyl(0.07, 0.06, 0.56, 12), mat("leather", "#5a3a20"), 0, 0, 0, g);
  mesh(cyl(0.075, 0.075, 0.04, 12), mat("leather", "#2a1a10"), 0, 0.26, 0, g);
  for (let i = 0; i < 5; i++) { const x = Math.sin(i * 1.3) * 0.035, z = Math.cos(i * 1.3) * 0.035; mesh(cyl(0.005, 0.005, 0.2, 3), mat("leather", "#8a6a4a"), x, 0.36, z, g); mesh(box(0.004, 0.07, 0.03), mat("cloth", i % 2 ? "#e8e0d0" : "#8a2a1a"), x, 0.42, z, g); }
  return g;
}
export const weaponKind = (id) => !id ? null : /staff/.test(id) ? "staff" : /bow/.test(id) ? "bow" : /maul/.test(id) ? "maul" : /cleaver|axe/.test(id) ? "axe" : /dagger/.test(id) ? "dagger" : "sword";
