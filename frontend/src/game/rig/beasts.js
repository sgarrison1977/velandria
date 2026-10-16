import * as THREE from "three";
import { mat, glowMat } from "./tex";
import { G, limb, lathe, sculpt, tube } from "./geo";
import { mesh } from "./gear";
import { grp, bake } from "./body";

const finish = (rig, scale) => { rig.baked = bake(rig.root); rig.dispose = () => rig.baked.forEach((g) => g.dispose()); rig.root.scale.setScalar(scale); return rig; };

export function spider(o) {
  const s = o.scale || 1, root = new THREE.Group(), body = grp(0, 0.45, 0, root);
  const rig = { root, body, s, kind: "spider", legs: [] };
  const shell = mat("scale", o.body, { roughness: 0.35, metalness: 0.15 }), hairy = mat("fur", o.abd), legM = mat("fur", o.leg || o.body);
  mesh(G("ceph", () => sculpt(new THREE.SphereGeometry(0.3, 22, 16), (v) => { v.z *= 1.25; v.y *= 0.62; if (v.y > 0) v.y *= 1 - Math.max(0, v.z) * 0.8; })), shell, 0, 0, 0.22, body);
  mesh(G("pedicel", () => new THREE.CylinderGeometry(0.08, 0.1, 0.18, 10)), shell, 0, 0.04, -0.12, body, Math.PI / 2, 0, 0);
  mesh(G("abd", () => sculpt(new THREE.SphereGeometry(0.5, 26, 18), (v) => { v.z *= 1.25; v.y *= 0.82; if (v.z < 0) v.y += v.z * -0.12; v.multiplyScalar(1 + Math.sin(Math.atan2(v.x, v.z) * 10) * 0.012); })), hairy, 0, 0.16, -0.62, body, -0.2, 0, 0);
  const mk = o.glow ? glowMat(o.mark, 1.3) : mat("plain", o.mark);
  for (let i = 0; i < 4; i++) mesh(G("chev", () => new THREE.TorusGeometry(0.16, 0.025, 6, 16, Math.PI * 0.7)), mk, 0, 0.53 - i * 0.025, -0.4 - i * 0.16, body, -Math.PI / 2 + 0.2, 0, Math.PI * 0.15).scale.setScalar(1 - i * 0.18);
  const eye = mat("plain", "#0a0606", { roughness: 0.05, metalness: 0.4 }), glint = glowMat("#ff3a2a", 1.6);
  for (const [x, y, z, r] of [[0.05, 0.16, 0.56, 0.035], [0.1, 0.14, 0.52, 0.025], [0.13, 0.16, 0.46, 0.02], [0.03, 0.19, 0.5, 0.018]]) for (const sd of [-1, 1]) { mesh(G("eye" + r, () => new THREE.SphereGeometry(r, 10, 8)), eye, sd * x, y, z, body); mesh(G("gl" + r, () => new THREE.SphereGeometry(r * 0.35, 6, 4)), glint, sd * x + sd * r * 0.2, y + r * 0.4, z + r * 0.7, body); }
  for (const sd of [-1, 1]) { mesh(lathe("chel", [[0.04, 0], [0.045, -0.06], [0.03, -0.12], [0.001, -0.14]], 10), shell, sd * 0.06, 0.02, 0.58, body, -0.5, 0, 0); mesh(tube("fang" + sd, [[0, 0, 0], [0, -0.06, 0.02], [-sd * 0.03, -0.1, -0.01]], 0.014, 8), mat("bone", "#1a1410"), sd * 0.06, -0.1, 0.62, body); }
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const hip = grp(sd * 0.2, 0, 0.36 - i * 0.12, body);
    hip.rotation.y = sd > 0 ? -(0.9 - i * 0.55) : Math.PI + (0.9 - i * 0.55);
    const up = grp(0, 0, 0, hip); up.rotation.z = 0.7;
    mesh(limb(0.045, 0.035, 0.62, 0.012, 0.4, 8), legM, 0, 0, 0, up, 0, 0, Math.PI / 2);
    const kn = grp(0.62, 0, 0, up); kn.rotation.z = -1.9;
    mesh(G("knee", () => new THREE.SphereGeometry(0.042, 8, 6)), shell, 0, 0, 0, kn);
    mesh(limb(0.035, 0.012, 0.72, 0.005, 0.3, 8), legM, 0, 0, 0, kn, 0, 0, Math.PI / 2);
    rig.legs.push({ up, kn, ph: i * 1.6 + (sd > 0 ? Math.PI : 0) });
  }
  rig.height = 1.0 * s;
  return finish(rig, s);
}

export function wolf(o) {
  const root = new THREE.Group(), body = grp(0, 0.72, 0, root);
  const fur = mat("fur", o.color), dark = mat("fur", o.dark || "#3a3834"), nose = mat("plain", "#0a0808", { roughness: 0.2 });
  const rig = { root, body, s: 1, kind: "quad", legs: [] };
  mesh(G("wbody", () => sculpt(new THREE.SphereGeometry(0.3, 26, 16), (v) => { const z = v.z / 0.3; v.z *= 2.1; const chest = z > 0 ? 1 + z * 0.15 : 1 - Math.min(0.35, -z * 0.35); v.x *= 0.78 * chest; v.y *= 0.95 * chest; if (v.y < 0 && z < 0.1) v.y *= 0.8; v.y += z * 0.04; })), fur, 0, 0, 0, body);
  mesh(G("wmane", () => sculpt(new THREE.SphereGeometry(0.27, 22, 14), (v) => { v.z *= 1.15; const a = Math.atan2(v.x, v.y); v.multiplyScalar(1 + Math.sin(a * 12 + v.z * 30) * 0.06); })), dark, 0, 0.08, 0.36, body);
  mesh(G("wback", () => sculpt(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), (v) => { v.z *= 3; v.x *= 0.9; })), dark, 0, 0.13, -0.02, body);
  const neck = grp(0, 0.14, 0.55, body); rig.head = neck;
  mesh(G("wskull", () => sculpt(new THREE.SphereGeometry(0.15, 20, 14), (v) => { v.x *= 0.95; v.y *= 0.85; if (v.y > 0.05) v.x *= 1.05; })), fur, 0, 0.1, 0.12, neck);
  mesh(G("wsnout", () => sculpt(new THREE.CylinderGeometry(0.05, 0.1, 0.24, 14, 4), (v) => { v.z *= 0.85; if (v.x < 0) v.x *= 1; v.y *= 1; })), fur, 0, 0.04, 0.3, neck, Math.PI / 2 + 0.08, 0, 0).scale.set(1, 1, 0.82);
  mesh(G("wjaw", () => new THREE.CylinderGeometry(0.035, 0.07, 0.2, 10)), dark, 0, -0.02, 0.28, neck, Math.PI / 2 + 0.25, 0, 0).scale.set(1, 1, 0.5);
  mesh(G("wnose", () => new THREE.SphereGeometry(0.03, 10, 8)), nose, 0, 0.06, 0.42, neck);
  for (const sd of [-1, 1]) {
    mesh(G("wear", () => sculpt(new THREE.ConeGeometry(0.06, 0.15, 6), (v) => { v.z *= 0.45; })), dark, sd * 0.08, 0.24, 0.08, neck, -0.15, 0, -sd * 0.25);
    mesh(G("weye", () => new THREE.SphereGeometry(0.02, 10, 8)), glowMat("#ffc23a", 1.4), sd * 0.065, 0.14, 0.24, neck);
    mesh(G("wfang", () => new THREE.ConeGeometry(0.008, 0.035, 5)), mat("bone", "#efe8d8"), sd * 0.03, -0.01, 0.38, neck, Math.PI, 0, 0);
  }
  const tail = grp(0, 0.1, -0.6, body); rig.tail = tail;
  mesh(tube("wtail", [[0, 0, 0], [0, -0.05, -0.18], [0, -0.18, -0.36], [0, -0.3, -0.48]], 0.08, 12), fur, 0, 0, 0, tail);
  for (const [x, z, ph, front] of [[-0.15, 0.4, 0, 1], [0.15, 0.4, Math.PI, 1], [-0.15, -0.4, Math.PI, 0], [0.15, -0.4, 0, 0]]) {
    const hip = grp(x, -0.05, z, body);
    mesh(limb(front ? 0.08 : 0.1, 0.05, 0.36, 0.02, 0.2, 10), fur, 0, 0, front ? 0 : -0.02, hip);
    const kn = grp(0, -0.34, front ? 0 : -0.03, hip);
    mesh(limb(0.045, 0.035, 0.3, 0, 0.3, 8), dark, 0, 0, 0, kn, front ? 0 : 0.2, 0, 0);
    mesh(G("paw", () => sculpt(new THREE.SphereGeometry(0.05, 10, 8), (v) => { v.y *= 0.5; v.z *= 1.4; })), dark, 0, -0.31, 0.03, kn);
    rig.legs.push({ up: hip, kn, ph });
  }
  rig.height = 1.2;
  return finish(rig, o.scale || 1);
}
