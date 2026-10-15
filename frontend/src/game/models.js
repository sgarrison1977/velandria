import * as THREE from "three";

const cache = {};
const M = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!cache[k]) cache[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, flatShading: false, ...o });
  return cache[k];
};
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent && parent.add(m); return m; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const grp = (x = 0, y = 0, z = 0, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent && parent.add(g); return g; };
export const RARITY = { common: "#c9c3b4", uncommon: "#5fd35a", rare: "#4f9bff", epic: "#b45cff", legendary: "#ffb22e" };

function weaponMesh(kind, color = "#9aa0a6", glow) {
  const g = new THREE.Group(), steel = M(color, { metalness: 0.6, roughness: 0.35 }), wood = M("#4a3020"), dark = M("#2a2420");
  if (kind === "sword" || kind === "dagger") {
    const L = kind === "sword" ? 0.85 : 0.4;
    mesh(B(0.07, L, 0.02), steel, 0, L / 2 + 0.12, 0, g); mesh(B(0.26, 0.05, 0.06), dark, 0, 0.12, 0, g); mesh(B(0.04, 0.16, 0.04), wood, 0, 0.03, 0, g);
    g.rotation.x = Math.PI / 2;
  } else if (kind === "axe") {
    mesh(B(0.05, 1.0, 0.05), wood, 0, 0.35, 0, g); mesh(B(0.04, 0.32, 0.34), steel, 0, 0.75, 0.15, g); g.rotation.x = Math.PI / 2;
  } else if (kind === "club") {
    mesh(new THREE.CylinderGeometry(0.16, 0.06, 1.1, 6), M(color), 0, 0.45, 0, g); g.rotation.x = Math.PI / 2.2;
  } else if (kind === "hammer") {
    mesh(B(0.05, 0.6, 0.05), wood, 0, 0.2, 0, g); mesh(B(0.24, 0.14, 0.14), dark, 0, 0.5, 0, g); g.rotation.x = Math.PI / 2;
  } else if (kind === "spear") {
    mesh(B(0.04, 2.0, 0.04), wood, 0, 0.3, 0, g); mesh(new THREE.ConeGeometry(0.06, 0.3, 4), steel, 0, 1.4, 0, g);
  } else if (kind === "staff") {
    mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.7, 5), M(color), 0, 0.35, 0, g);
    const orb = mesh(new THREE.IcosahedronGeometry(0.1, 1), M(glow || "#7fd0ff", { emissive: glow || "#7fd0ff", emissiveIntensity: 2.2 }), 0, 1.25, 0, g); orb.name = "orb";
  } else if (kind === "bow") {
    const arc = mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 12, Math.PI), M(color === "#9aa0a6" ? "#6a4628" : color), 0, 0, 0, g);
    arc.rotation.z = -Math.PI / 2; mesh(B(0.01, 1.1, 0.01), M("#ddd"), -0.02, 0, 0, g);
    g.rotation.y = Math.PI / 2;
  }
  return g;
}
const weaponKind = (id) => !id ? null : /staff/.test(id) ? "staff" : /bow/.test(id) ? "bow" : /maul|cleaver/.test(id) ? (id.includes("maul") ? "club" : "axe") : "sword";

export function humanoid(o) {
  const s = (o.scale || 1) * 1.22, bulk = o.bulk || 1, thin = o.thin ? 0.55 : 1;
  const root = new THREE.Group(), body = grp(0, 0, 0, root);
  const skin = M(o.skin || "#c9a084"), shirt = M(o.shirt || "#5a4a3a"), pants = M(o.pants || "#3a3028"), boots = M(o.boots || "#2a1f16");
  const rig = { root, body, s };
  const leg = (side) => {
    const hip = grp(side * 0.12 * bulk, 0.88, 0, body);
    mesh(cap(0.092 * bulk * thin, 0.3), pants, 0, -0.22, 0, hip);
    const knee = grp(0, -0.45, 0, hip);
    mesh(cap(0.078 * bulk * thin, 0.27), pants, 0, -0.19, 0, knee);
    mesh(cap(0.088 * bulk, 0.12), boots, 0, -0.3, 0, knee); const toe = mesh(cap(0.075 * bulk, 0.14), boots, 0, -0.41, 0.06, knee); toe.rotation.x = Math.PI / 2;
    return { hip, knee };
  };
  rig.legL = leg(-1); rig.legR = leg(1);
  const torso = grp(0, 0.88, 0, body); rig.torso = torso;
  if (o.hunch) torso.rotation.x = 0.35;
  mesh(cap(0.2, 0.3), o.thin ? M("#d8d2bc") : shirt, 0, 0.36, 0, torso).scale.set(1.22 * bulk * (o.thin ? 0.6 : 1), 1, 0.72 * bulk); mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skin, 0, 0.68, 0, torso); mesh(B(0.07, 0.07, 0.03), M("#c9a24e", { metalness: 0.8, roughness: 0.3 }), 0, 0.05, 0.16 * bulk, torso);
  if (o.thin) for (let i = 0; i < 4; i++) mesh(B(0.4, 0.035, 0.3), M("#e6e0cc"), 0, 0.2 + i * 0.1, 0, torso);
  mesh(new THREE.CylinderGeometry(0.235 * bulk, 0.235 * bulk, 0.08, 14), M(o.belt || "#2a1d12"), 0, 0.05, 0, torso).scale.set(1, 1, 0.66);
  if (o.robe) { const r = mesh(new THREE.CylinderGeometry(0.24 * bulk, 0.42 * bulk, 0.9, 8), M(o.robe), 0, -0.42, 0, torso); r.name = "robe"; }
  if (o.pauldrons) for (const sd of [-1, 1]) mesh(new THREE.SphereGeometry(0.16 * bulk, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), M(o.pauldrons, { metalness: 0.5, roughness: 0.4 }), sd * 0.3 * bulk, 0.6, 0, torso);
  if (o.cape) { const c = mesh(B(0.5 * bulk, 0.95, 0.04), M(o.cape), 0, 0.15, -0.17 * bulk, torso); c.rotation.x = 0.12; c.name = "cape"; }
  const head = grp(0, 0.7, 0, torso); rig.head = head;
  mesh(new THREE.SphereGeometry(0.15 * (o.headScale || 1), 16, 12), o.head === "skull" ? M("#e3dcc6") : skin, 0, 0.13, 0, head).scale.set(0.95, 1.08, 1); if (o.head !== "skull") mesh(B(0.035, 0.06, 0.05), skin, 0, 0.11, 0.15, head);
  if (o.head === "skull") { for (const sd of [-1, 1]) mesh(B(0.05, 0.05, 0.02), M("#000"), sd * 0.06, 0.14, 0.15, head); }
  else for (const sd of [-1, 1]) mesh(B(0.035, 0.035, 0.02), M(o.eyes || "#1a1a1a", o.eyes ? { emissive: o.eyes, emissiveIntensity: 2 } : {}), sd * 0.06, 0.14, 0.15, head);
  if (o.hair) mesh(new THREE.SphereGeometry(0.165, 14, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), M(o.hair, { roughness: 0.9 }), 0, 0.15, -0.015, head);
  if (o.mohawk) mesh(B(0.06, 0.16, 0.3), M(o.mohawk), 0, 0.3, 0, head);
  if (o.beard) mesh(B(0.22, 0.18, 0.1), M(o.beard), 0, 0.0, 0.12, head);
  if (o.helm) { mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 1.8), M(o.helm, { metalness: 0.6, roughness: 0.35 }), 0, 0.12, 0, head); mesh(B(0.04, 0.12, 0.05), M(o.helm), 0, 0.1, 0.18, head); }
  if (o.hood) { const hd = mesh(new THREE.ConeGeometry(0.24, 0.5, 7), M(o.hood), 0, 0.25, -0.03, head); hd.rotation.x = -0.15; }
  if (o.hat) { mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), M(o.hat), 0, 0.25, 0, head); const c = mesh(new THREE.ConeGeometry(0.17, 0.5, 8), M(o.hat), 0, 0.5, -0.03, head); c.rotation.x = -0.25; }
  if (o.horns) for (const sd of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.04, 0.2, 5), M(o.horns), sd * 0.1, 0.3, 0, head); h.rotation.z = -sd * 0.5; }
  if (o.ears) for (const sd of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.05, 0.24, 4), skin, sd * 0.2, 0.15, 0, head); e.rotation.z = -sd * 1.3; }
  if (o.tusks) for (const sd of [-1, 1]) mesh(new THREE.ConeGeometry(0.025, 0.1, 4), M("#e8e0c0"), sd * 0.06, 0.04, 0.15, head);
  if (o.antlers) for (const sd of [-1, 1]) { const a = mesh(B(0.03, 0.35, 0.03), M("#8a7a5a"), sd * 0.12, 0.38, 0, head); a.rotation.z = -sd * 0.6; }
  const arm = (side) => {
    const sh = grp(side * 0.31 * bulk, 0.58, 0, torso);
    mesh(cap(0.068 * bulk * thin, 0.22), o.sleeve ? M(o.sleeve) : (o.thin ? M("#d8d2bc") : shirt), 0, -0.15, 0, sh);
    const el = grp(0, -0.32, 0, sh);
    mesh(cap(0.056 * bulk * thin, 0.2), o.thin ? M("#d8d2bc") : (o.sleeve ? M(o.sleeve) : skin), 0, -0.13, 0, el); mesh(new THREE.SphereGeometry(0.055 * bulk, 8, 6), o.thin ? M("#d8d2bc") : skin, 0, -0.29, 0.01, el);
    const hand = grp(0, -0.3, 0.02, el);
    return { sh, el, hand };
  };
  rig.armL = arm(-1); rig.armR = arm(1);
  if (o.wings) for (const sd of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.35, 0.7, 3), M(o.wings), sd * 0.3, 0.45, -0.2, torso); w.rotation.set(0.3, 0, sd * 1.9); w.scale.z = 0.1; w.name = sd > 0 ? "wingR" : "wingL"; (rig.wings = rig.wings || []).push(w); }
  if (o.tail) { const t = mesh(B(0.04, 0.04, 0.6), M(o.tail), 0, 0.05, -0.35, torso); t.rotation.x = -0.4; }
  rig.equip = (main, off) => {
    for (const k of ["mainMesh", "offMesh"]) if (rig[k]) { rig[k].parent.remove(rig[k]); rig[k] = null; }
    if (main) { rig.mainMesh = typeof main === "string" ? weaponMesh(main, o.weaponColor, o.glow) : main; rig.armR.hand.add(rig.mainMesh); rig.weaponKind = typeof main === "string" ? main : rig.weaponKind; }
    if (off === "shield") { const sh = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), M(o.shieldColor || "#6a4a2a", { metalness: 0.2 }), -0.08, 0.15, 0, rig.armL.el); sh.rotation.z = Math.PI / 2; rig.offMesh = sh; }
    if (off === "tome") { rig.offMesh = mesh(B(0.18, 0.24, 0.06), M("#4a2a5a"), 0, -0.05, 0.06, rig.armL.hand); }
    if (off === "quiver") { rig.offMesh = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), M("#5a3a20"), 0.12, 0.35, -0.18, torso); rig.offMesh.rotation.z = 0.4; }
  };
  rig.equip(o.weapon, o.off);
  body.scale.setScalar(s);
  rig.kind = "humanoid";
  rig.height = 1.9 * s;
  return rig;
}

function spider(o) {
  const s = o.scale || 1, root = new THREE.Group(), body = grp(0, 0.45, 0, root);
  const rig = { root, body, s, kind: "spider", legs: [] };
  mesh(new THREE.IcosahedronGeometry(0.32, 1), M(o.body), 0, 0, 0.25, body);
  const abd = mesh(new THREE.IcosahedronGeometry(0.5, 1), M(o.abd), 0, 0.12, -0.45, body); abd.scale.set(1, 0.8, 1.2);
  mesh(new THREE.IcosahedronGeometry(0.2, 0), M(o.mark, { emissive: o.glow ? o.mark : "#000", emissiveIntensity: o.glow ? 1.2 : 0 }), 0, 0.48, -0.5, body).scale.set(1, 0.3, 1.4);
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) mesh(B(0.04, 0.04, 0.02), M("#ff3a2a", { emissive: "#ff2010", emissiveIntensity: 1.5 }), sd * 0.05 * (1 + i * 0.4), 0.12 + (i % 2) * 0.04, 0.52, body);
  for (const sd of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.04, 0.2, 4), M("#1a1410"), sd * 0.08, -0.12, 0.55, body); f.rotation.x = Math.PI; }
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const hip = grp(sd * 0.22, 0, 0.35 - i * 0.18, body);
    hip.rotation.y = sd > 0 ? -(0.9 - i * 0.55) : Math.PI + (0.9 - i * 0.55);
    const up = grp(0, 0, 0, hip); up.rotation.z = 0.7;
    mesh(B(0.6, 0.07, 0.07), M(o.body), 0.3, 0, 0, up);
    const kn = grp(0.6, 0, 0, up); kn.rotation.z = -1.9;
    mesh(B(0.7, 0.05, 0.05), M(o.leg || o.body), 0.35, 0, 0, kn);
    rig.legs.push({ up, kn, ph: i * 1.6 + (sd > 0 ? Math.PI : 0) });
  }
  root.scale.setScalar(s);
  rig.height = 1.0 * s;
  return rig;
}

function wolf(o) {
  const root = new THREE.Group(), body = grp(0, 0.72, 0, root);
  const fur = M(o.color), dark = M(o.dark || "#3a3834");
  const rig = { root, body, s: 1, kind: "quad", legs: [] };
  const torso = mesh(B(0.42, 0.42, 1.15), fur, 0, 0, 0, body);
  mesh(B(0.46, 0.2, 0.5), dark, 0, 0.2, 0.25, body);
  const neck = grp(0, 0.12, 0.55, body); rig.head = neck;
  mesh(B(0.3, 0.3, 0.34), fur, 0, 0.1, 0.12, neck);
  mesh(B(0.16, 0.14, 0.3), fur, 0, 0.02, 0.38, neck);
  mesh(B(0.06, 0.05, 0.05), M("#111"), 0, 0.08, 0.54, neck);
  for (const sd of [-1, 1]) { mesh(new THREE.ConeGeometry(0.06, 0.16, 4), dark, sd * 0.1, 0.32, 0.05, neck); mesh(B(0.04, 0.04, 0.02), M("#ffd23a", { emissive: "#ffb000", emissiveIntensity: 1.5 }), sd * 0.08, 0.16, 0.29, neck); }
  const tail = mesh(B(0.1, 0.1, 0.55), fur, 0, 0.1, -0.78, body); tail.rotation.x = 0.6; rig.tail = tail;
  for (const [x, z, ph] of [[-0.15, 0.42, 0], [0.15, 0.42, Math.PI], [-0.15, -0.42, Math.PI], [0.15, -0.42, 0]]) {
    const hip = grp(x, -0.1, z, body);
    mesh(B(0.12, 0.38, 0.14), fur, 0, -0.18, 0, hip);
    const kn = grp(0, -0.36, 0, hip);
    mesh(B(0.09, 0.3, 0.1), dark, 0, -0.13, 0, kn);
    rig.legs.push({ up: hip, kn, ph });
  }
  torso.castShadow = true;
  root.scale.setScalar(o.scale || 1);
  rig.height = 1.2;
  return rig;
}

const MONSTER_BUILD = {
  giant_spider: () => spider({ body: "#2e231a", abd: "#3b2b1d", mark: "#9a6a32", scale: 1.0 }),
  venomous_spider: () => spider({ body: "#16201a", abd: "#21301a", mark: "#8aff3a", leg: "#2a1a30", glow: true, scale: 1.45 }),
  imp: () => humanoid({ scale: 0.62, skin: "#a8352a", shirt: "#8a2a22", pants: "#3a1410", boots: "#2a0e0a", horns: "#2a1a10", wings: "#5a1a14", tail: "#8a2a22", eyes: "#ffd23a", ears: true }),
  forest_wolf: () => wolf({ color: "#625e57", dark: "#3d3a35" }),
  goblin_scout: () => humanoid({ scale: 0.74, skin: "#64803a", ears: true, hood: "#4a3a22", shirt: "#55452a", pants: "#3a3020", weapon: "dagger", eyes: "#ffe14a", headScale: 1.2 }),
  skeleton: () => humanoid({ thin: true, skin: "#d8d2bc", head: "skull", pants: "#4a4238", boots: "#3a332a", weapon: "sword", weaponColor: "#7a6a5a", off: "shield", shieldColor: "#3a2e22", eyes: "#7fe0ff" }),
  forest_bandit: () => humanoid({ skin: "#b88466", hood: "#2a2620", shirt: "#3e3226", pants: "#2a241c", cape: "#24201a", weapon: "sword", belt: "#5a3a1a" }),
  orc_warrior: () => humanoid({ scale: 1.22, bulk: 1.35, skin: "#5a6c34", tusks: true, mohawk: "#1a1410", shirt: "#4a3020", pants: "#2e2418", pauldrons: "#6a6a6a", weapon: "axe", eyes: "#ff3a2a" }),
  dark_cultist: () => humanoid({ skin: "#8a7a72", robe: "#1c1226", shirt: "#251733", sleeve: "#251733", hood: "#1c1226", weapon: "staff", weaponColor: "#2a1a1a", glow: "#b05cff", eyes: "#d07aff" }),
  forest_troll: () => humanoid({ scale: 1.75, bulk: 1.5, hunch: true, skin: "#667a64", hair: "#3a4a2a", shirt: "#667a64", pants: "#3a2a1a", weapon: "club", weaponColor: "#5a4632", tusks: true, eyes: "#ffcf3a" }),
};
export const buildMonster = (type) => MONSTER_BUILD[type]();

const NPC_BUILD = {
  smith: () => humanoid({ skin: "#c08a6a", shirt: "#5a3a26", pants: "#3a2a1a", beard: "#5a3a1a", hair: "#3a2a1a", weapon: "hammer", belt: "#2a1a0e", bulk: 1.15 }),
  merchant: () => humanoid({ skin: "#d6a888", shirt: "#7a5a2a", robe: "#6a3a2a", hair: "#7a4a2a", sleeve: "#7a5a2a" }),
  healer: () => humanoid({ skin: "#e0b898", robe: "#e8e0cc", shirt: "#e8e0cc", sleeve: "#e8e0cc", hood: "#d8cc9c", weapon: "staff", weaponColor: "#c9b07a", glow: "#ffe08a" }),
  druid: () => humanoid({ skin: "#c09070", robe: "#2e5a3a", shirt: "#3a6a42", sleeve: "#3a6a42", antlers: true, beard: "#bbb", weapon: "staff", weaponColor: "#5a4a2a", glow: "#7affc8" }),
  elder: () => humanoid({ skin: "#d0a888", robe: "#4a3a5a", shirt: "#5a4a6a", sleeve: "#5a4a6a", beard: "#ddd", hair: "#ccc", weapon: "staff", weaponColor: "#5a4632", glow: "#ffcf7a" }),
  guard: () => humanoid({ skin: "#c8946e", shirt: "#7a8088", pants: "#3a3a40", helm: "#8a8f96", cape: "#7a1f1f", weapon: "spear", off: "shield", shieldColor: "#7a1f1f", pauldrons: "#8a8f96" }),
  villager: () => humanoid({ skin: "#d0a080", shirt: ["#6a5a3a", "#5a6a4a", "#7a4a3a"][Math.floor(Math.random() * 3)], pants: "#4a3a2a", hair: "#4a2a1a" }),
  child: () => humanoid({ scale: 0.6, skin: "#e0b090", shirt: "#4a6a8a", hair: "#9a6a2a", headScale: 1.2 }),
};
export const buildNpc = (kind) => (NPC_BUILD[kind] || NPC_BUILD.villager)();

const CLASS_LOOK = {
  warrior: { skin: "#c8946e", shirt: "#6a6e74", pants: "#3a3028", hair: "#3a2414", pauldrons: "#80868e", belt: "#3a2414" },
  mage: { skin: "#d8b090", shirt: "#2a2e5a", sleeve: "#2a2e5a", robe: "#23264a", hat: "#1e2044", hair: "#bbb" },
  ranger: { skin: "#c49070", shirt: "#3a4a2a", pants: "#3a3020", hood: "#2e3e22", cape: "#2e3e22" },
};
export function buildPlayer(cls, eqStr, items) {
  const [main, off, head, chest] = (eqStr || "").split("|");
  const look = { ...CLASS_LOOK[cls] };
  if (chest && items[chest]?.color) { look.shirt = items[chest].color; if (look.robe) look.robe = items[chest].color; if (look.sleeve) look.sleeve = items[chest].color; }
  if (head) { look.helm = items[head]?.color === "#6b5a45" ? "#6b5a45" : (items[head]?.color || "#8a8f96"); delete look.hat; delete look.hood; delete look.hair; }
  look.weapon = weaponKind(main); look.weaponColor = items[main]?.color;
  look.glow = main === "ember_staff" ? "#ff7a2a" : main === "cultist_staff" ? "#b05cff" : "#7fd0ff";
  look.off = off === "wooden_shield" || off === "iron_shield" ? "shield" : off === "spell_tome" ? "tome" : off === "quiver" ? "quiver" : null;
  look.shieldColor = off === "iron_shield" ? "#8a8f96" : "#6a4a2a";
  const rig = humanoid(look);
  rig.eqStr = eqStr;
  return rig;
}

export function buildLoot(itemId, item) {
  const g = new THREE.Group(), col = RARITY[item.rarity] || "#ccc";
  if (itemId === "gold") for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), M("#ffcc3a", { metalness: 0.8, roughness: 0.25, emissive: "#5a3a00" }), (i % 3 - 1) * 0.12, 0.03 + i * 0.035, (i % 2) * 0.1, g);
  else if (item.type === "weapon") { const w = weaponMesh(weaponKind(itemId), item.color); w.rotation.set(0, 0, Math.PI / 2); w.position.y = 0.1; w.scale.setScalar(0.7); g.add(w); }
  else if (item.type === "consumable") { const c = item.mana && !item.heal ? "#3a6aff" : item.mana ? "#c9a24e" : "#d0302a"; mesh(new THREE.SphereGeometry(0.14, 8, 6), M(c, { emissive: c, emissiveIntensity: 0.6, roughness: 0.2 }), 0, 0.14, 0, g); mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), M("#8a6a4a"), 0, 0.3, 0, g); }
  else if (item.type === "armor") { mesh(B(0.42, 0.22, 0.34), M(item.color || "#6b5a45"), 0, 0.11, 0, g); mesh(B(0.44, 0.06, 0.36), M(col), 0, 0.2, 0, g); }
  else { const p = mesh(new THREE.IcosahedronGeometry(0.17, 1), M("#7a5a3a"), 0, 0.15, 0, g); p.scale.y = 0.8; mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 6), M(col), 0, 0.3, 0, g); }
  if (["rare", "epic", "legendary"].includes(item.rarity)) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 3, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 1.5; g.add(beam);
  }
  if (item.rarity !== "common") { const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring); }
  return g;
}

export function proxy(radius, height, data) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = height / 2; m.userData = data;
  return m;
}

// ---------- animation
export function animateRig(rig, a, dt, t) {
  const moving = a.moving, sp = rig.kind === "humanoid" ? 7 : rig.kind === "spider" ? 11 : 10;
  a.phase = (a.phase || 0) + dt * (moving ? sp : 0);
  a.atk = Math.max(0, (a.atk || 0) - dt * 2.4);
  a.cast = Math.max(0, (a.cast || 0) - dt * 2);
  a.hurt = Math.max(0, (a.hurt || 0) - dt * 4);
  const sw = moving ? Math.sin(a.phase) : 0;
  if (a.dead) {
    a.deadT = (a.deadT || 0) + dt;
    const k = Math.min(1, a.deadT * 2.5);
    if (rig.kind === "humanoid") rig.body.rotation.x = -k * Math.PI / 2;
    else if (rig.kind === "quad") rig.body.rotation.z = k * Math.PI / 2;
    else rig.legs.forEach((l) => { l.up.rotation.z = 0.7 - k * 1.5; l.kn.rotation.z = -1.9 - k * 0.8; });
    rig.body.position.y = (rig.kind === "humanoid" ? 0.15 : rig.kind === "spider" ? 0.3 : 0.4) * k * (rig.kind === "humanoid" ? 1 : 1) - Math.max(0, a.deadT - 2.2) * 0.6;
    return;
  }
  if (a.deadT) { a.deadT = 0; rig.body.rotation.set(0, 0, 0); rig.body.position.y = rig.kind === "spider" ? 0.45 : rig.kind === "quad" ? 0.72 : 0; }
  const atkCurve = a.atk > 0 ? Math.sin((1 - a.atk) * Math.PI) : 0;
  if (rig.kind === "humanoid") {
    rig.legL.hip.rotation.x = sw * 0.65; rig.legR.hip.rotation.x = -sw * 0.65;
    rig.legL.knee.rotation.x = Math.max(0, -sw) * 0.8; rig.legR.knee.rotation.x = Math.max(0, sw) * 0.8;
    rig.body.position.y = moving ? Math.abs(Math.cos(a.phase)) * 0.05 : Math.sin(t * 2) * 0.008;
    const ranged = rig.weaponKind === "bow";
    rig.armL.sh.rotation.x = -sw * 0.5; rig.armR.sh.rotation.x = sw * 0.5;
    rig.armL.sh.rotation.z = -0.08; rig.armR.sh.rotation.z = 0.08;
    rig.armR.el.rotation.x = -0.3; rig.armL.el.rotation.x = -0.3;
    if (a.atk > 0) {
      if (ranged) { rig.armL.sh.rotation.x = -1.5; rig.armR.sh.rotation.x = -1.5 + atkCurve * 0.3; rig.armR.el.rotation.x = -atkCurve * 1.2; }
      else if (rig.weaponKind === "staff") { rig.armR.sh.rotation.x = -1.3 * atkCurve - 0.2; }
      else { rig.armR.sh.rotation.x = -2.6 * atkCurve + (1 - a.atk) * 0.8 * atkCurve; rig.armR.el.rotation.x = -0.6 * atkCurve; rig.torso.rotation.y = -0.4 * atkCurve; }
    } else rig.torso.rotation.y = 0;
    if (a.cast > 0) { const c = Math.sin(a.cast * Math.PI); rig.armL.sh.rotation.x = -2.2 * c; rig.armR.sh.rotation.x = -2.2 * c; }
    if (rig.wings) rig.wings.forEach((w, i) => { w.rotation.y = Math.sin(t * 14 + i * Math.PI) * 0.5; });
  } else if (rig.kind === "spider") {
    rig.legs.forEach((l) => { l.up.rotation.z = 0.7 + (moving ? Math.sin(a.phase + l.ph) * 0.35 : Math.sin(t * 1.5 + l.ph) * 0.03); l.up.rotation.x = moving ? Math.cos(a.phase + l.ph) * 0.25 : 0; });
    rig.body.position.y = 0.45 + (moving ? Math.abs(Math.sin(a.phase * 2)) * 0.04 : 0);
    rig.body.position.z = atkCurve * 0.35;
    rig.body.rotation.x = -atkCurve * 0.4;
    for (let i = 0; i < 2; i++) rig.legs[i].up.rotation.z = 0.7 + atkCurve * 0.9 + (moving ? 0 : 0);
  } else {
    rig.legs.forEach((l) => { l.up.rotation.x = moving ? Math.sin(a.phase + l.ph) * 0.7 : 0; l.kn.rotation.x = moving ? Math.max(0, Math.sin(a.phase + l.ph + 1)) * -0.6 : 0; });
    rig.body.position.y = 0.72 + (moving ? Math.abs(Math.sin(a.phase)) * 0.05 : 0);
    rig.head.rotation.x = -atkCurve * 0.5 + (moving ? 0 : Math.sin(t * 1.2) * 0.05);
    rig.head.position.z = 0.55 + atkCurve * 0.25;
    if (rig.tail) rig.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.4;
  }
  const flash = a.hurt > 0;
  if (flash !== a.flashOn) {
    a.flashOn = flash;
    rig.root.traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) { if (flash) { o.userData.m = o.material; o.material = HURT; } else if (o.userData.m) o.material = o.userData.m; } });
  }
}
const HURT = new THREE.MeshStandardMaterial({ color: "#ff6a5a", emissive: "#ff2a1a", emissiveIntensity: 0.9, flatShading: true });
