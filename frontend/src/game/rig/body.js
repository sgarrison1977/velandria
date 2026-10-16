import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mat, glowMat } from "./tex";
import { G, limb, torsoGeo, pelvisGeo, headGeo, hairGeo, longHairBack, beardGeo, skirtGeo, capeGeo, sleeveBell, pauldronGeo, rockGeo, tube, wingGeo, sculpt, lathe } from "./geo";
import { mesh, weaponMesh, shieldMesh, tomeMesh, quiverMesh } from "./gear";

export const grp = (x = 0, y = 0, z = 0, p) => { const g = new THREE.Group(); g.position.set(x, y, z); p && p.add(g); return g; };
const sph = (r, a = 14, b = 10) => G(`sp${r},${a},${b}`, () => new THREE.SphereGeometry(r, a, b));
const dome = (r, th = 0.55) => G(`dm${r},${th}`, () => new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI * th));
const cyl = (r1, r2, h, s = 16, open = false) => G(`cy${r1},${r2},${h},${s},${open}`, () => new THREE.CylinderGeometry(r1, r2, h, s, 1, open));
const torus = (r, t, arc = Math.PI * 2) => G(`to${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 26, arc));
const box = (w, h, d) => G(`bx${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cone = (r, h, s = 8) => G(`cn${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const footGeo = () => G("foot", () => sculpt(new THREE.SphereGeometry(0.055, 16, 10), (v) => { if (v.y < 0) v.y *= 0.35; v.z *= v.z > 0 ? 2.3 : 1.15; v.x *= 0.92 - Math.max(0, v.z) * 1.2; }));
const noseGeo = () => G("nose", () => sculpt(new THREE.SphereGeometry(0.02, 10, 8), (v) => { v.y *= 1.5; v.x *= 0.75; v.z *= 0.9; v.z += (0.03 - v.y) * 0.35; if (v.y < -0.015) v.x *= 1.4; }));
const earGeo = () => G("ear", () => sculpt(new THREE.SphereGeometry(0.026, 10, 8), (v) => { v.x *= 0.32; v.z *= 0.65; v.y *= 1.05; }));
const palmGeo = () => G("palm", () => sculpt(new THREE.SphereGeometry(0.04, 12, 10), (v) => { v.x *= 0.55; v.y *= 1.15; v.z *= 0.95; }));
const finger = (sd) => tube("fing" + sd, [[0, 0, 0], [-sd * 0.008, -0.03, 0], [-sd * 0.028, -0.048, 0]], 0.0105, 6, false);
const thumb = (sd) => tube("thumb" + sd, [[0, 0, 0], [-sd * 0.006, -0.02, 0.016], [-sd * 0.02, -0.035, 0.022]], 0.011, 6, false);

const OUT = { plate: "metal", mail: "chain", leather: "leather", fur: "fur", scale: "scale" };
const outfit = (style, c) => mat(OUT[style] || "cloth", c);

export function bake(root) {
  const baked = [];
  root.traverse((g) => {
    if (g.isMesh) return;
    const sets = {};
    for (const c of g.children) if (c.isMesh && !c.name && !c.children.length) {
      const k = c.material.uuid + (c.geometry.index ? "i" : "n") + Object.keys(c.geometry.attributes).sort().join();
      (sets[k] = sets[k] || []).push(c);
    }
    for (const list of Object.values(sets)) {
      if (list.length < 2) continue;
      const geos = list.map((c) => { c.updateMatrix(); return c.geometry.clone().applyMatrix4(c.matrix); });
      const merged = mergeGeometries(geos); geos.forEach((x) => x.dispose());
      if (!merged) continue;
      list.forEach((c) => g.remove(c));
      const m = new THREE.Mesh(merged, list[0].material); m.castShadow = true; g.add(m); baked.push(merged);
    }
  });
  return baked;
}

function hand(par, sd, m, o) {
  mesh(palmGeo(), m, 0, -0.045, 0, par);
  for (let i = 0; i < 4; i++) mesh(finger(sd), m, -sd * 0.006, -0.08, -0.021 + i * 0.014, par).scale.setScalar(i === 3 ? 0.85 : 1);
  mesh(thumb(sd), m, -sd * 0.012, -0.035, 0.026, par);
  if (o.claws) for (let i = 0; i < 4; i++) mesh(cone(0.008, 0.05, 5), mat("bone", "#d8d0b8"), -sd * 0.035, -0.12, -0.021 + i * 0.014, par, 0, 0, sd * 2.4);
}

function feet(ankle, knee, o, sh, legM, skinM) {
  const st = o.boots?.style || "shoe", c = o.boots?.color || "#2a1f16";
  if (st === "bare" || o.body === "bone") { mesh(footGeo(), o.body === "bone" ? skinM : skinM, 0, -0.045, 0.03, ankle).scale.set(o.body === "bone" ? 0.6 : 1, 1, 1); return; }
  const bm = st === "plate" ? mat("metal", c) : mat("leather", c);
  mesh(footGeo(), bm, 0, -0.045, 0.03, ankle);
  mesh(box(0.085, 0.016, 0.2), mat("leather", new THREE.Color(c).multiplyScalar(0.55).getStyle()), 0, -0.064, 0.045, ankle);
  if (st === "shoe") return;
  mesh(limb(sh * 1.14, sh * 0.98, 0.24, 0, 0.3), bm, 0, -0.14, 0, knee);
  if (st === "fur") mesh(cyl(sh * 1.5, sh * 1.3, 0.08, 14), mat("fur", "#8a8478"), 0, -0.15, 0, knee);
  else if (st === "plate") { mesh(dome(sh * 1.25, 0.5), bm, 0, -0.02, 0.025, knee, Math.PI / 2, 0, 0); for (let i = 0; i < 3; i++) mesh(torus(0.046, 0.006, Math.PI), bm, 0, -0.035, 0.07 + i * 0.03, ankle, 0, 0, 0); }
  else mesh(torus(sh * 1.18, 0.012), mat("leather", "#1a120c"), 0, -0.15, 0, knee, Math.PI / 2, 0, 0);
}

function headParts(head, o, skinM, hc) {
  const kind = o.head || "human", hairC = o.hair || "#3a2a1a", hairM = mat("hair", hairC), helm = o.helm?.style;
  if (o.faceVoid) {
    mesh(headGeo("human"), mat("plain", "#040306", { roughness: 1 }), 0, hc, 0, head);
    for (const sd of [-1, 1]) mesh(sph(0.014, 8, 6), glowMat(o.eyes || "#9a5aff", 3), sd * 0.038, hc + 0.01, 0.1, head);
    return;
  }
  if (kind === "skull") {
    const bm = mat("bone", o.skin || "#d8d2bc");
    mesh(headGeo("skull"), bm, 0, hc + 0.01, -0.005, head);
    for (const sd of [-1, 1]) { mesh(sph(0.025, 10, 8), mat("plain", "#050403"), sd * 0.042, hc + 0.012, 0.092, head); mesh(sph(0.011, 8, 6), glowMat(o.eyes || "#7fe0ff", 3), sd * 0.042, hc + 0.012, 0.1, head); }
    mesh(box(0.1, 0.035, 0.08), bm, 0, hc - 0.085, 0.035, head);
    mesh(box(0.075, 0.016, 0.01), mat("bone", "#efe8d8"), 0, hc - 0.062, 0.1, head);
    mesh(cone(0.012, 0.03, 3), mat("plain", "#050403"), 0, hc - 0.025, 0.112, head, Math.PI, 0, 0);
  } else {
    const hk = ["goblin", "brute", "angular", "round", "narrow"].includes(kind) ? kind : "human";
    mesh(headGeo(hk), skinM, 0, hc, 0, head);
    const eyeM = o.eyes ? glowMat(o.eyes, 2.6) : mat("plain", o.iris || "#3a4a5a", { roughness: 0.15 });
    for (const sd of [-1, 1]) {
      mesh(sph(0.0155, 12, 8), o.eyes ? eyeM : mat("plain", "#ece6dc", { roughness: 0.2 }), sd * 0.04, hc + 0.012, 0.1, head).scale.set(1.1, 0.72, 0.6);
      if (!o.eyes) mesh(sph(0.0085, 10, 6), eyeM, sd * 0.04, hc + 0.012, 0.107, head);
      mesh(box(0.046, 0.011, 0.018), mat("hair", o.beard || hairC), sd * 0.042, hc + 0.037, 0.106, head, 0.2, 0, -sd * (o.eyes ? -0.25 : 0.14));
      if (o.ears) mesh(tube("pear" + sd, [[0, 0, 0], [sd * 0.05, 0.025, -0.02], [sd * 0.12, 0.06, -0.045]], 0.024, 8), skinM, sd * 0.095, hc, -0.01, head);
      else mesh(earGeo(), skinM, sd * 0.1, hc - 0.002, -0.008, head, 0, sd * 0.25, 0);
      if (o.tusks) mesh(cone(0.012, 0.06, 6), mat("bone", "#e8e0c0"), sd * 0.04, hc - 0.06, 0.1, head, -0.25, 0, -sd * 0.15);
    }
    mesh(noseGeo(), skinM, 0, hc - 0.01, 0.106, head).scale.setScalar(kind === "goblin" ? 1.6 : kind === "brute" ? 1.2 : 0.82);
    mesh(box(0.042, 0.008, 0.012), mat("skin", "#8a5a50"), 0, hc - 0.052, 0.107, head);
    mesh(box(0.038, 0.01, 0.012), mat("skin", "#9a6458"), 0, hc - 0.062, 0.104, head);
  }
  if (o.beard && o.beardStyle === "full") mesh(beardGeo(true), mat("hair", o.beard), 0, hc - 0.005, 0.004, head);
  else if (o.beard) mesh(beardGeo(false), mat("skin", new THREE.Color(o.skin || "#c9a084").lerp(new THREE.Color(o.beard), 0.35).getStyle(), { transparent: true, opacity: 0.5 }), 0, hc - 0.002, 0.0, head).scale.setScalar(1.035);
  const hideHair = ["great", "hood", "nasal", "cap"].includes(helm);
  if (o.hairStyle !== "bald" && kind !== "skull" && !hideHair) {
    const style = o.hairStyle || "short";
    mesh(hairGeo(style), hairM, 0, hc + 0.012, -0.008, head);
    if (style === "long") mesh(longHairBack(), hairM, 0, hc - 0.1, -0.012, head);
    if (style === "tail") mesh(tube("ptail", [[0, 0, 0], [0, -0.05, -0.04], [0, -0.15, -0.06], [0, -0.24, -0.05]], 0.03, 10), hairM, 0, hc + 0.04, -0.11, head);
  } else if (hideHair && (helm === "nasal" || helm === "cap") && o.hairStyle === "long") mesh(longHairBack(), hairM, 0, hc - 0.1, -0.012, head);
  if (o.mohawk) mesh(tube("mhk", [[0, 0.1, 0.07], [0, 0.135, 0], [0, 0.11, -0.08], [0, 0.05, -0.12]], 0.022, 12, false), mat("hair", o.mohawk), 0, hc, 0, head).scale.x = 0.5;
  if (o.horns) for (const sd of [-1, 1]) mesh(tube("horn" + sd, [[0, 0, 0], [sd * 0.05, 0.06, -0.02], [sd * 0.09, 0.14, -0.08], [sd * 0.06, 0.21, -0.17]], 0.028, 12), mat("bone", o.horns), sd * 0.07, hc + 0.08, 0.01, head);
  if (o.antlers) for (const sd of [-1, 1]) { const am = mat("leather", "#8a7a5a"); mesh(tube("ant" + sd, [[0, 0, 0], [sd * 0.06, 0.1, -0.02], [sd * 0.12, 0.22, -0.04], [sd * 0.14, 0.34, -0.02]], 0.018, 10), am, sd * 0.06, hc + 0.09, 0, head); mesh(tube("antb" + sd, [[0, 0, 0], [sd * 0.05, 0.06, 0.03], [sd * 0.06, 0.13, 0.04]], 0.012, 8), am, sd * 0.12, hc + 0.27, -0.03, head); }
  helmet(head, o, hc);
}

function helmet(head, o, hc) {
  const h = o.helm; if (!h) return;
  const c = h.color;
  if (h.style === "cap") { mesh(dome(0.134, 0.56), mat("leather", c), 0, hc - 0.004, -0.005, head); mesh(torus(0.128, 0.012), mat("leather", "#2a1a10"), 0, hc + 0.02, -0.005, head, Math.PI / 2, 0, 0); }
  else if (h.style === "nasal") {
    const m = mat("metal", c);
    mesh(G("nasaldome", () => sculpt(new THREE.SphereGeometry(0.14, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), (v) => { v.y *= 1.12; })), m, 0, hc + 0.008, -0.005, head);
    mesh(torus(0.134, 0.01), m, 0, hc + 0.02, -0.005, head, Math.PI / 2, 0, 0);
    mesh(box(0.018, 0.075, 0.012), m, 0, hc - 0.005, 0.135, head);
    for (const sd of [-1, 1]) mesh(box(0.012, 0.085, 0.06), m, sd * 0.118, hc - 0.03, 0.05, head, 0, -sd * 0.25, sd * 0.12);
    mesh(G("avent", () => new THREE.CylinderGeometry(0.135, 0.165, 0.13, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8)), mat("chain", "#7a7e86", { side: THREE.DoubleSide }), 0, hc - 0.06, -0.005, head);
  } else if (h.style === "great") {
    const m = mat("metal", c);
    mesh(lathe("greathelm", [[0.13, -0.15], [0.142, -0.06], [0.145, 0.04], [0.135, 0.11], [0.1, 0.16], [0.04, 0.18], [0, 0.182]], 24), m, 0, hc, 0, head).scale.set(0.95, 1, 1.05);
    mesh(box(0.11, 0.013, 0.03), mat("plain", "#050505"), 0, hc + 0.018, 0.14, head);
    mesh(box(0.012, 0.32, 0.02), m, 0, hc + 0.03, 0.002, head, 0, 0, 0).scale.z = 14;
    for (let i = 0; i < 3; i++) mesh(box(0.008, 0.008, 0.02), mat("plain", "#050505"), 0.03, hc - 0.05 - i * 0.025, 0.142, head);
    if (o.helmHorns) for (const sd of [-1, 1]) mesh(tube("hh" + sd, [[0, 0, 0], [sd * 0.08, 0.05, 0], [sd * 0.13, 0.15, -0.03], [sd * 0.12, 0.26, -0.08]], 0.03, 12), mat("bone", "#1a1410"), sd * 0.12, hc + 0.07, 0, head);
  } else if (h.style === "crown" || h.style === "circlet") {
    const gold = h.style === "crown", m = gold ? mat("metal", c) : mat("leather", c);
    mesh(cyl(0.132, 0.128, 0.04, 26, true), m, 0, hc + 0.065, -0.005, head);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mesh(gold ? cone(0.018, 0.06, 4) : cone(0.012, 0.09, 4), m, Math.sin(a) * 0.13, hc + 0.105, Math.cos(a) * 0.13 - 0.005, head, 0, 0, 0); if (gold && i % 2 === 0) mesh(sph(0.011, 8, 6), glowMat(i % 4 ? "#ff3a5a" : "#5ab8ff", 1.6), Math.sin(a) * 0.134, hc + 0.065, Math.cos(a) * 0.134 - 0.005, head); }
  } else if (h.style === "hat") {
    const m = mat("cloth", c);
    mesh(lathe("brim", [[0.001, 0.012], [0.16, 0.005], [0.28, -0.03], [0.3, -0.045], [0.29, -0.05], [0.001, -0.005]], 26), m, 0, hc + 0.1, 0, head);
    mesh(G("hatcone", () => sculpt(new THREE.LatheGeometry([[0.14, 0], [0.13, 0.08], [0.1, 0.18], [0.06, 0.32], [0.025, 0.44], [0.001, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 22), (v) => { const t = v.y / 0.5; v.z -= t * t * 0.2; v.y -= t * t * t * 0.06; })), m, 0, hc + 0.1, -0.005, head);
    mesh(cyl(0.142, 0.142, 0.035, 22, true), mat("cloth", o.trim || "#c9a24e"), 0, hc + 0.125, -0.005, head);
  } else if (h.style === "hood") {
    const m = mat("cloth", c, { side: THREE.DoubleSide });
    mesh(G("hood", () => sculpt(new THREE.SphereGeometry(0.158, 26, 16, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.78), (v) => { v.y *= 1.12; if (v.z < 0) v.z *= 1.15; })), m, 0, hc + 0.01, -0.012, head);
    mesh(G("hooddrape", () => new THREE.CylinderGeometry(0.13, 0.17, 0.12, 24, 1, true, Math.PI / 2 + 0.7, Math.PI * 2 - 1.4)), m, 0, hc - 0.12, -0.02, head);
    mesh(tube("hoodtip", [[0, 0, 0], [0, -0.03, -0.06], [0, -0.1, -0.1]], 0.05, 8), m, 0, hc + 0.12, -0.1, head);
  }
}

function torsoLayers(torso, o, w, topM, skinM) {
  const t = o.top || { style: "tunic", color: "#5a4a3a" }, st = t.style;
  const bone = o.body === "bone";
  if (bone) {
    const bm = skinM;
    mesh(tube("spine", [[0, -0.02, -0.06], [0, 0.2, -0.08], [0, 0.45, -0.07], [0, 0.66, -0.02]], 0.022, 10, false), bm, 0, 0, 0, torso);
    for (let i = 0; i < 6; i++) mesh(torus(0.13 - Math.abs(i - 2) * 0.012, 0.014, Math.PI * 1.65), bm, 0, 0.24 + i * 0.065, -0.01, torso, Math.PI / 2, 0, Math.PI * 0.68).scale.set(1.25 * w, 0.85, 1);
    mesh(box(0.025, 0.24, 0.02), bm, 0, 0.42, 0.11, torso);
    for (const sd of [-1, 1]) mesh(cyl(0.012, 0.012, 0.18, 6), bm, sd * 0.09, 0.6, 0.05, torso, 0, 0, sd * 1.35);
    mesh(skirtGeo(0.14, 0.18, 0.24, 6, true), mat("cloth", t.color || "#3a342a", { side: THREE.DoubleSide }), 0, -0.04, 0, torso).name = "skirt";
    return;
  }
  mesh(torsoGeo(w, o.bulk > 1.2 ? 1.4 : 1, o.body === "bare" || o.body === "stone"), topM, 0, 0, 0, torso);
  const side = { side: THREE.DoubleSide };
  const skirt = (r2, len, folds, m, tat) => { const s = mesh(skirtGeo(0.168 * w, r2 * w, len, folds, tat), m, 0, 0.03, 0, torso); s.name = "skirt"; return s; };
  if (st === "tunic" || st === "cloak") skirt(0.25, 0.32, 9, mat("cloth", t.color, side));
  if (st === "rags") skirt(0.25, 0.42, 7, mat("cloth", t.color, side), true);
  if (st === "robe") {
    skirt(0.38, 0.88, 12, mat("cloth", t.color, side), o.tatter);
    if (o.trim) mesh(skirtGeo(0.38 * w * 0.995, 0.385 * w, 0.06, 12), mat("cloth", o.trim, { side: THREE.DoubleSide }), 0, 0.03 - 0.83, 0, torso);
  }
  if (st === "leather") {
    skirt(0.22, 0.26, 6, mat("leather", t.color, side));
    for (const sd of [-1, 1]) mesh(box(0.03, 0.66, 0.012), mat("leather", "#2a1a10"), sd * 0.05, 0.3, 0.135 * (0.5 + 0.5 * w) + 0.004, torso, -0.12, 0, sd * 0.45);
    mesh(pauldronGeo(0.1), mat("leather", t.color), -0.21 * w, 0.55, 0, torso, 0, 0, 0.4);
  }
  if (st === "mail") {
    skirt(0.25, 0.36, 4, mat("chain", t.color, side));
    const tab = mat("cloth", o.trim || "#7a1f1f", side);
    for (const z of [1, -1]) mesh(box(0.18, 0.5, 0.012), tab, 0, -0.18, z * 0.15, torso, z * 0.06, 0, 0);
    mesh(torsoGeo(w * 1.02), tab, 0, -0.02, 0, torso).scale.set(1, 0.72, 1.06);
  }
  if (st === "plate") {
    const m = mat("metal", t.color);
    mesh(torsoGeo(w * 1.06, 1.25), m, 0, 0.02, 0, torso).scale.set(1.04, 0.92, 1.12);
    mesh(box(0.014, 0.4, 0.02), m, 0, 0.3, 0.135 * (0.5 + 0.5 * w) + 0.035, torso, -0.12, 0, 0);
    mesh(torus(0.085, 0.03), m, 0, 0.6, 0, torso, Math.PI / 2, 0, 0).scale.set(1.25, 1, 1);
    mesh(skirtGeo(0.17 * w, 0.21 * w, 0.14, 0), m, 0, 0.03, 0, torso);
    mesh(skirtGeo(0.19 * w, 0.24 * w, 0.14, 0), m, 0, -0.08, 0, torso);
    mesh(skirtGeo(0.165 * w, 0.23 * w, 0.3, 5), mat("chain", "#6a6e76", side), 0, 0.02, 0, torso).name = "skirt";
  }
  if (st === "bare" || o.body === "stone") mesh(skirtGeo(0.168 * w, 0.2 * w, 0.22, 5, true), mat("leather", o.loin || "#4a3420", side), 0, 0.03, 0, torso).name = "skirt";
  const pd = o.pauldrons || (st === "plate" ? t.color : null);
  if (pd) for (const sd of [-1, 1]) {
    const pm = mat("metal", pd);
    mesh(pauldronGeo(0.115 * w), pm, sd * 0.22 * w, 0.565, 0, torso, 0, 0, -sd * 0.38);
    mesh(pauldronGeo(0.1 * w), pm, sd * 0.25 * w, 0.5, 0, torso, 0, 0, -sd * 0.7).scale.set(1, 0.8, 1);
  }
  if (o.mantle) mesh(torus(0.13 * w, 0.055), mat("cloth", o.mantle), 0, 0.6, -0.01, torso, Math.PI / 2, 0, 0).scale.set(1.2, 1.15, 1);
  if (!["robe", "bare"].includes(st) || o.belt) {
    mesh(cyl(0.17, 0.17, 0.05, 24, true), mat("leather", o.belt || "#2a1d12", side), 0, 0.03, 0, torso).scale.set(0.98 * w, 1, 0.72 * (0.5 + 0.5 * w));
    mesh(box(0.05, 0.045, 0.015), mat("metal", "#c9a24e"), 0, 0.03, 0.12 * (0.5 + 0.5 * w) + 0.008, torso);
    mesh(box(0.07, 0.08, 0.04), mat("leather", "#3a2818"), 0.15 * w, -0.02, 0.06, torso, 0, 0.5, 0);
  } else mesh(torus(0.155 * w, 0.018), mat("cloth", o.trim || "#c9a24e"), 0, 0.04, 0, torso, Math.PI / 2, 0, 0).scale.set(1, 0.72, 1);
  if (o.rocky) {
    const rm = mat("stone", o.skin);
    for (const [x, y, z, r] of [[-0.2, 0.62, -0.02, 0.13], [0.2, 0.64, 0, 0.14], [0, 0.5, -0.15, 0.12], [-0.1, 0.3, -0.14, 0.09], [0.12, 0.4, -0.15, 0.1]]) mesh(rockGeo(r * w, x * 10), rm, x * w, y, z, torso);
    mesh(G("core", () => new THREE.IcosahedronGeometry(0.06, 1)), glowMat(o.eyes || "#ff9a3a", 2.5), 0, 0.42, 0.15 * w, torso);
  }
}

export function humanoid(o) {
  const s = (o.scale || 1) * 1.22, w = o.bulk || 1;
  const root = new THREE.Group(), body = grp(0, 0, 0, root);
  const rig = { root, body, s, kind: "humanoid", seed: Math.random() * 10, bulk: w };
  const bone = o.body === "bone", stone = o.body === "stone", bare = o.body === "bare" || stone;
  const skinM = bone ? mat("bone", o.skin || "#d8d2bc") : stone ? mat("stone", o.skin) : mat("skin", o.skin || "#c9a084");
  const t = o.top || { style: "tunic", color: "#5a4a3a" };
  const topM = bare ? skinM : outfit(t.style, t.color);
  const ls = o.legs || { style: "cloth", color: "#3a3028" };
  const legM = bone || stone ? skinM : outfit(ls.style === "plate" ? "cloth" : ls.style, ls.color);
  const sleeveM = bare || o.sleeveless ? skinM : t.style === "plate" ? mat("chain", "#6a6e76") : t.style === "mail" ? mat("chain", t.color) : t.style === "leather" ? mat("cloth", o.undershirt || "#4a3e30") : topM;
  const handM = o.gloves ? (o.gloves.style === "gauntlet" ? mat("metal", o.gloves.color) : mat("leather", o.gloves.color)) : skinM;

  const leg = (sd) => {
    const hip = grp(sd * 0.095 * w, 0.9, 0, body);
    const th = bone ? 0.024 : 0.085 * w, sh = bone ? 0.02 : 0.058 * w;
    mesh(limb(th, th * 0.72, 0.42, bone ? 0 : 0.012 * w, 0.25), legM, 0, 0, 0, hip);
    const knee = grp(0, -0.42, 0, hip);
    if (bone) mesh(sph(0.032), skinM, 0, 0, 0, knee);
    mesh(limb(sh, sh * 0.68, 0.38, bone ? 0 : 0.014 * w, 0.22), legM, 0, 0, 0, knee);
    if (ls.style === "plate") { const pm = mat("metal", ls.color); mesh(limb(th * 1.1, th * 0.86, 0.32, 0, 0.3), pm, 0, -0.06, 0.004, hip); mesh(dome(sh * 1.3, 0.5), pm, 0, 0, 0.03, knee, Math.PI / 2, 0, 0); mesh(limb(sh * 1.12, sh * 0.86, 0.22, 0, 0.3), pm, 0, -0.03, 0.004, knee); }
    const ankle = grp(0, -0.39, 0, knee);
    feet(ankle, knee, o, sh, legM, skinM);
    return { hip, knee, ankle };
  };
  rig.legL = leg(-1); rig.legR = leg(1);
  if (!bone) mesh(pelvisGeo(w), legM, 0, 0.97, 0, body); else mesh(torus(0.09, 0.025), skinM, 0, 0.95, 0, body, Math.PI / 2.4, 0, 0).scale.set(1.3 * w, 1, 1);

  const torso = grp(0, 0.96, 0, body); rig.torso = torso; rig.lean = o.hunch ? 0.35 : 0;
  torsoLayers(torso, o, w, topM, skinM);
  mesh(limb(bone ? 0.02 : 0.05 * Math.sqrt(w), bone ? 0.02 : 0.056 * Math.sqrt(w), 0.15, 0, 0.5, 12), skinM, 0, 0.76, -0.005, torso);
  const head = grp(0, 0.72, 0, torso); rig.head = head;
  head.scale.setScalar(o.headScale || 1);
  headParts(head, o, skinM, 0.1);

  const arm = (sd) => {
    const sh = grp(sd * 0.2 * w, 0.53, 0, torso);
    const ua = bone ? 0.02 : 0.058 * w, fa = bone ? 0.017 : 0.046 * w;
    if (!bone) mesh(sph(0.06 * w), t.style === "plate" ? mat("chain", "#6a6e76") : sleeveM, -sd * 0.004, -0.03, 0, sh).scale.set(1, 1.2, 1.12);
    else mesh(sph(0.03), skinM, 0, 0, 0, sh);
    mesh(limb(ua, ua * 0.78, 0.29, bone ? 0 : 0.012 * w, 0.35), sleeveM, 0, 0, 0, sh);
    const el = grp(0, -0.29, 0, sh);
    const longSleeve = !bare && !o.sleeveless && ["robe", "tunic", "cloak", "rags", "mail", "plate"].includes(t.style);
    const foreM = longSleeve ? sleeveM : skinM;
    mesh(limb(fa, fa * 0.72, 0.25, bone ? 0 : 0.01 * w, 0.2), foreM, 0, 0, 0, el);
    if (t.style === "robe") mesh(sleeveBell(), mat("cloth", t.color, { side: THREE.DoubleSide }), 0, 0, 0, el).scale.set(w, 1, w);
    if (t.style === "plate") mesh(limb(fa * 1.2, fa * 1.0, 0.2, 0, 0.3), mat("metal", t.color), 0, -0.03, 0, el);
    else if (o.bracers || t.style === "leather") mesh(limb(fa * 1.4, fa * 1.12, 0.15, 0, 0.3), mat("leather", o.bracers || "#3a2a1a"), 0, -0.08, 0, el);
    const wr = grp(0, -0.25, 0, el);
    if (o.gloves) mesh(o.gloves.style === "gauntlet" ? lathe("gcuff", [[0.042, 0.02], [0.05, -0.02], [0.065, -0.07], [0.06, -0.075]], 12) : limb(fa * 0.85, fa * 0.82, 0.05), handM, 0, 0.04, 0, wr).scale.setScalar(w);
    hand(wr, sd, bone ? skinM : handM, o);
    const grip = grp(-sd * 0.012, -0.075, 0.004, wr);
    return { sh, el, hand: grip };
  };
  rig.armL = arm(-1); rig.armR = arm(1);

  if (o.cape) { const cg = grp(0, 0.6, -0.03, torso); mesh(capeGeo(o.robeCape ? 1.35 : 1.15, w, o.tatter), mat("cloth", o.cape, { side: THREE.DoubleSide }), 0, 0, 0, cg).name = "cape"; rig.cape = cg; }
  if (o.wings) { rig.wings = []; for (const sd of [-1, 1]) { const wg = grp(sd * 0.07, 0.48, -0.13, torso); wg.rotation.y = sd * 0.5; const wm = mesh(wingGeo(), mat("leather", o.wings, { side: THREE.DoubleSide }), 0, 0, 0, wg); wm.scale.set(sd * 0.9, 0.9, 1); wm.name = "wing"; mesh(tube("wbone" + sd, [[0, 0, 0], [sd * 0.32, 0.4, 0], [sd * 0.85, 0.5, 0]], 0.022, 10), mat("bone", "#2a1410"), 0, 0, 0, wg); rig.wings.push(wg); } }
  if (o.tail) { const tg = grp(0, 0.92, -0.12, body); mesh(tube("tail", [[0, 0, 0], [0, -0.15, -0.2], [0, -0.35, -0.45], [0, -0.42, -0.7], [0, -0.35, -0.85]], 0.045, 16), mat("skin", o.tail), 0, 0, 0, tg); mesh(cone(0.05, 0.1, 4), mat("bone", "#1a0a0a"), 0, -0.33, -0.9, tg, -1.2, 0, 0); rig.tail = tg; }
  if (o.rocky) for (const a of [rig.armL, rig.armR]) { mesh(rockGeo(0.07 * w, 3), mat("stone", o.skin), 0, -0.12, -0.03, a.el); mesh(rockGeo(0.08 * w, 5), mat("stone", o.skin), 0, 0.02, 0, a.sh); }

  if (o.weapon) {
    const wm = typeof o.weapon === "string" ? weaponMesh(o.weapon, o.weaponColor, o.glow) : o.weapon;
    rig.weaponKind = o.weapon;
    if (o.weapon === "bow") { wm.rotation.set(Math.PI / 2, 0, 0); rig.armL.hand.add(wm); } else rig.armR.hand.add(wm);
    rig.mainMesh = wm;
  }
  if (o.off === "shield") { const sm = shieldMesh(o.shieldKind, o.shieldColor || "#6a4a2a"); sm.position.set(-0.07, -0.12, 0.02); sm.rotation.y = -Math.PI / 2; rig.armL.el.add(sm); }
  if (o.off === "tome") { const tm = tomeMesh(); tm.position.set(0.01, -0.03, 0.05); rig.armL.hand.add(tm); }
  if (o.off === "quiver" || o.weapon === "bow") { const q = quiverMesh(); q.position.set(0.1, 0.36, -0.16); q.rotation.z = 0.45; torso.add(q); }

  rig.baked = bake(root);
  rig.dispose = () => rig.baked.forEach((g) => g.dispose());
  body.scale.setScalar(s);
  rig.height = 1.9 * s;
  return rig;
}
