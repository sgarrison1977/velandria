import * as THREE from "three";
import { humanoid } from "./rig/body";
import { spider, wolf } from "./rig/beasts";
import { weaponMesh, weaponKind, mesh as gmesh } from "./rig/gear";
import { mat } from "./rig/tex";

export { humanoid };
const M = (c, o = {}) => mat("plain", c, o);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const mesh = (geo, m, x, y, z, p) => gmesh(geo, m, x, y, z, p);
export const RARITY = { common: "#c9c3b4", uncommon: "#5fd35a", rare: "#4f9bff", epic: "#b45cff", legendary: "#ffb22e" };

const robe = (color, o = {}) => ({ top: { style: "robe", color }, ...o });
const MONSTER_BUILD = {
  cave_crawler: () => spider({ body: "#8a8478", abd: "#a09a8a", mark: "#5affe0", leg: "#6a645a", glow: true, scale: 1.9 }),
  crypt_ghoul: () => humanoid({ scale: 1.1, hunch: true, skin: "#7a8a6a", top: { style: "rags", color: "#3a3a2a" }, legs: { style: "cloth", color: "#2a2a1e" }, boots: { style: "bare" }, eyes: "#d0ff5a", ears: true, hair: "#2a2a20", hairStyle: "long", claws: true, sleeveless: true }),
  bone_colossus: () => humanoid({ scale: 2.3, bulk: 1.3, body: "bone", skin: "#e0d8c0", head: "skull", top: { color: "#3a342a" }, weapon: "club", weaponColor: "#d8d0b8", eyes: "#7fe0ff", pauldrons: "#d8d0b8" }),
  hollow_shade: () => humanoid(robe("#140a1e", { scale: 1.25, skin: "#4a3a5a", faceVoid: true, helm: { style: "hood", color: "#140a1e" }, tatter: true, weapon: "staff", weaponColor: "#2a1a3a", glow: "#c070ff", eyes: "#e0a0ff", cape: "#0e0614" })),
  hollow_king: () => humanoid({ scale: 2.6, bulk: 1.35, body: "bone", skin: "#9a90a8", head: "skull", top: { color: "#1a1222" }, helm: { style: "crown", color: "#c9a24e" }, pauldrons: "#c9a24e", cape: "#3a0a4a", tatter: true, weapon: "sword", weaponColor: "#2a2040", glow: "#b060ff", eyes: "#d080ff" }),
  dire_wolf: () => wolf({ color: "#2e2c30", dark: "#141216", scale: 1.75 }),
  broodmother: () => spider({ body: "#2a1030", abd: "#3a1440", mark: "#ff3a8a", leg: "#1a0a20", glow: true, scale: 2.4 }),
  shadow_wraith: () => humanoid(robe("#0e0e18", { scale: 1.15, faceVoid: true, helm: { style: "hood", color: "#0e0e18" }, tatter: true, weapon: "staff", weaponColor: "#1a1a2a", glow: "#5affe0", eyes: "#5affe0", cape: "#08080e" })),
  stone_golem: () => humanoid({ scale: 2.1, bulk: 1.7, hunch: true, body: "stone", head: "brute", skin: "#7a7468", hairStyle: "bald", boots: { style: "bare" }, rocky: true, eyes: "#ff9a3a", weapon: "club", weaponColor: "#5a5448" }),
  death_knight: () => humanoid({ scale: 1.35, bulk: 1.2, skin: "#d8d2bc", head: "skull", top: { style: "plate", color: "#2a2a32" }, legs: { style: "plate", color: "#22222a" }, boots: { style: "plate", color: "#1a1a20" }, gloves: { style: "gauntlet", color: "#2a2a32" }, helm: { style: "great", color: "#2a2a32" }, helmHorns: true, cape: "#3a0a10", tatter: true, weapon: "sword", weaponColor: "#3a3a50", glow: "#ff3a3a", off: "shield", shieldKind: "iron", shieldColor: "#1a1a20", eyes: "#ff3a3a" }),
  abyssal_fiend: () => humanoid({ scale: 2.4, bulk: 1.4, body: "bare", head: "brute", skin: "#5a1010", hairStyle: "bald", boots: { style: "bare" }, loin: "#1a0505", horns: "#1a0a0a", wings: "#2a0505", tail: "#4a0a0a", eyes: "#ffea3a", claws: true, weapon: "axe", weaponColor: "#2a1a1a", glow: "#ff5a1a" }),
  giant_spider: () => spider({ body: "#2e231a", abd: "#3b2b1d", mark: "#9a6a32", scale: 1.0 }),
  venomous_spider: () => spider({ body: "#16201a", abd: "#21301a", mark: "#8aff3a", leg: "#2a1a30", glow: true, scale: 1.45 }),
  imp: () => humanoid({ scale: 0.62, body: "bare", head: "goblin", skin: "#a8352a", hairStyle: "bald", boots: { style: "bare" }, loin: "#3a1410", horns: "#2a1a10", wings: "#5a1a14", tail: "#8a2a22", eyes: "#ffd23a", ears: true, claws: true }),
  forest_wolf: () => wolf({ color: "#625e57", dark: "#3d3a35" }),
  goblin_scout: () => humanoid({ scale: 0.74, head: "goblin", skin: "#64803a", ears: true, helm: { style: "hood", color: "#4a3a22" }, top: { style: "leather", color: "#55452a" }, legs: { style: "cloth", color: "#3a3020" }, boots: { style: "bare" }, sleeveless: true, weapon: "dagger", eyes: "#ffe14a", headScale: 1.25 }),
  skeleton: () => humanoid({ body: "bone", skin: "#d8d2bc", head: "skull", top: { color: "#4a4238" }, weapon: "sword", weaponColor: "#7a6a5a", off: "shield", shieldColor: "#3a2e22", eyes: "#7fe0ff" }),
  forest_bandit: () => humanoid({ skin: "#b88466", beard: "#3a2414", beardStyle: "stubble", helm: { style: "hood", color: "#2a2620" }, top: { style: "leather", color: "#3e3226" }, legs: { style: "leather", color: "#2a241c" }, boots: { style: "boot", color: "#2a1f16" }, cape: "#24201a", tatter: true, weapon: "sword", belt: "#5a3a1a", bracers: "#2a1a10" }),
  orc_warrior: () => humanoid({ scale: 1.22, bulk: 1.35, body: "bare", head: "brute", skin: "#5a6c34", hairStyle: "bald", tusks: true, mohawk: "#1a1410", legs: { style: "leather", color: "#2e2418" }, boots: { style: "fur", color: "#3a2a1a" }, pauldrons: "#6a6a6a", bracers: "#3a2416", weapon: "axe", eyes: "#ff3a2a", belt: "#3a2416" }),
  dark_cultist: () => humanoid(robe("#1c1226", { skin: "#8a7a72", faceVoid: true, helm: { style: "hood", color: "#1c1226" }, trim: "#6a2a8a", weapon: "staff", weaponColor: "#2a1a1a", glow: "#b05cff", eyes: "#d07aff" })),
  reef_crawler: () => spider({ body: "#3a6a6a", abd: "#c86a4a", mark: "#ffd0a0", leg: "#2a4a4a", glow: true, scale: 1.8 }),
  drowned_corsair: () => humanoid({ body: "bone", skin: "#a8b8a8", head: "skull", top: { style: "rags", color: "#2a3a3a" }, helm: { style: "tricorn", color: "#1a1a1a" }, weapon: "sword", weaponColor: "#6a8a8a", eyes: "#5affd0", cape: "#1a2a2a", tatter: true, belt: "#4a3a1a" }),
  tidecursed_wraith: () => humanoid(robe("#0a2a30", { scale: 1.2, faceVoid: true, helm: { style: "hood", color: "#0a2a30" }, tatter: true, weapon: "staff", weaponColor: "#1a3a3a", glow: "#3affc8", eyes: "#7affe0", cape: "#06181c" })),
  coral_colossus: () => humanoid({ scale: 2.2, bulk: 1.7, hunch: true, body: "stone", head: "brute", skin: "#c87a6a", hairStyle: "bald", boots: { style: "bare" }, rocky: true, eyes: "#5affe0", weapon: "club", weaponColor: "#8a4a4a" }),
  captain_blackbrine: () => humanoid({ scale: 1.35, bulk: 1.2, skin: "#9aaa9a", head: "skull", top: { style: "leather", color: "#1a1a22" }, legs: { style: "leather", color: "#1a1a1a" }, boots: { style: "boot", color: "#120e0a" }, helm: { style: "tricorn", color: "#0e0e0e" }, cape: "#4a0a10", tatter: true, weapon: "sword", weaponColor: "#c9a24e", glow: "#3affc8", eyes: "#3affc8", belt: "#c9a24e", pauldrons: "#c9a24e" }),
  forest_troll: () => humanoid({ scale: 1.75, bulk: 1.5, hunch: true, body: "bare", head: "brute", skin: "#667a64", hair: "#3a4a2a", hairStyle: "long", legs: { style: "leather", color: "#3a2a1a" }, boots: { style: "bare" }, loin: "#3a2a1a", weapon: "club", weaponColor: "#5a4632", tusks: true, eyes: "#ffcf3a", claws: true }),
  grubnak: () => humanoid({ scale: 1.65, bulk: 1.55, head: "goblin", skin: "#5a7a2a", ears: true, tusks: true, headScale: 1.15, helm: { style: "crown", color: "#b08a3a" }, top: { style: "leather", color: "#4a3420" }, legs: { style: "leather", color: "#2e2418" }, boots: { style: "fur", color: "#3a2a1a" }, pauldrons: "#b08a3a", bracers: "#3a2416", belt: "#b08a3a", cape: "#6a1a10", tatter: true, weapon: "axe", weaponColor: "#8a6a3a", eyes: "#ff3a1a" }),
  greymaw: () => wolf({ color: "#9a9aa4", dark: "#3a3a46", scale: 2.7 }),
  ixra: () => spider({ body: "#0e1a10", abd: "#1c3a14", mark: "#b8ff3a", leg: "#0a140a", glow: true, scale: 3.1 }),
  malzeth: () => humanoid(robe("#0e1e3a", { scale: 1.5, skin: "#9ab0c8", helm: { style: "hood", color: "#0e1e3a" }, trim: "#9ad8ff", tatter: true, weapon: "staff", weaponColor: "#cfe8ff", glow: "#7ad0ff", eyes: "#bfe8ff", cape: "#0a1428", beard: "#dfe8f0", beardStyle: "full" })),
  revenant: () => humanoid({ scale: 1.95, bulk: 1.4, skin: "#c8b8a0", head: "skull", top: { style: "plate", color: "#5a4234" }, legs: { style: "plate", color: "#4a3a30" }, boots: { style: "plate", color: "#3a2e26" }, gloves: { style: "gauntlet", color: "#5a4234" }, helm: { style: "great", color: "#4a382c" }, helmHorns: true, pauldrons: "#6a4a38", cape: "#2a0a0a", tatter: true, weapon: "sword", weaponColor: "#6a5a50", glow: "#ff2a2a", eyes: "#ff2a2a" }),
  pyrrhax: () => humanoid({ scale: 3.0, bulk: 1.5, body: "bare", head: "brute", skin: "#2a1a14", hairStyle: "bald", boots: { style: "bare" }, loin: "#140a06", horns: "#ffb03a", wings: "#3a1408", tail: "#2a120a", eyes: "#ffd23a", claws: true, weapon: "axe", weaponColor: "#ff7a1a", glow: "#ff7a1a" }),
  castle_barbarian: () => humanoid({ scale: 1.4, bulk: 1.5, body: "bare", skin: "#c08a64", hair: "#8a3a1a", hairStyle: "long", beard: "#8a3a1a", beardStyle: "full", legs: { style: "leather", color: "#3a2a1a" }, boots: { style: "fur", color: "#5a4a3a" }, pauldrons: "#5a4a3a", bracers: "#3a2416", belt: "#6a4a2a", mantle: "#6a5a4a", weapon: "axe", weaponColor: "#9aa0a6", eyes: "#ffd0a0" }),
  castle_berserker: () => humanoid({ scale: 1.45, bulk: 1.6, body: "bare", skin: "#b07a5a", hairStyle: "bald", mohawk: "#a02a1a", beard: "#a02a1a", beardStyle: "full", legs: { style: "leather", color: "#2a1a10" }, boots: { style: "fur", color: "#3a2a1a" }, bracers: "#5a1a10", belt: "#3a2416", weapon: "axe", weaponColor: "#7a2a1a", glow: "#ff3a1a", eyes: "#ff3a1a" }),
  castle_plague_ghoul: () => humanoid({ scale: 1.2, hunch: true, body: "bare", head: "skull", skin: "#6a7a4a", hairStyle: "bald", boots: { style: "bare" }, loin: "#2a2a1a", claws: true, eyes: "#aaff3a", glow: "#8aff3a" }),
  castle_crossbowman: () => humanoid({ skin: "#c8a080", helm: { style: "nasal", color: "#6a6a72" }, top: { style: "mail", color: "#5a5a62" }, legs: { style: "leather", color: "#2a2420" }, boots: { style: "boot", color: "#2a1f16" }, cape: "#1a2a5a", weapon: "bow", weaponColor: "#4a3a2a", eyes: "#ffe0b0", belt: "#5a3a1a" }),
  castle_pyromancer: () => humanoid(robe("#3a1206", { scale: 1.1, skin: "#c8906a", helm: { style: "hood", color: "#3a1206" }, trim: "#ff7a1a", weapon: "staff", weaponColor: "#2a1a10", glow: "#ff6a1a", eyes: "#ffb03a", cape: "#2a0a04" })),
  castle_frost_witch: () => humanoid(robe("#1a2a40", { scale: 1.1, skin: "#c8d8e8", hair: "#e8f0ff", hairStyle: "long", trim: "#9ad8ff", weapon: "staff", weaponColor: "#cfe8ff", glow: "#7ad0ff", eyes: "#bfe8ff", cape: "#0e1a2a", helm: { style: "circlet", color: "#cfe8ff" } })),
  castle_golem_warden: () => humanoid({ scale: 2.3, bulk: 1.8, hunch: true, body: "stone", head: "brute", skin: "#5a5650", hairStyle: "bald", boots: { style: "bare" }, rocky: true, pauldrons: "#7a6a4a", eyes: "#ffd36b", glow: "#ffd36b", weapon: "club", weaponColor: "#4a463e" }),
  castle_wraith_knight: () => humanoid({ scale: 1.4, bulk: 1.2, skin: "#9ab0c0", head: "skull", top: { style: "plate", color: "#3a4a5a" }, legs: { style: "plate", color: "#2a3a4a" }, boots: { style: "plate", color: "#1a2a3a" }, gloves: { style: "gauntlet", color: "#3a4a5a" }, helm: { style: "great", color: "#4a5a6a" }, cape: "#1a2a3a", tatter: true, weapon: "sword", weaponColor: "#9ad8ff", glow: "#5affe0", eyes: "#5affe0" }),
  castle_executioner: () => humanoid({ scale: 1.6, bulk: 1.6, body: "bare", skin: "#a87a5a", helm: { style: "hood", color: "#1a0a0a" }, legs: { style: "leather", color: "#1a1410" }, boots: { style: "boot", color: "#1a1410" }, bracers: "#2a1a10", belt: "#3a2416", weapon: "axe", weaponColor: "#8a8a92", eyes: "#ff5a3a" }),
  castle_battlemage: () => humanoid(robe("#5a1a1a", { scale: 1.1, skin: "#d8b8a0", helm: { style: "hood", color: "#5a1a1a" }, trim: "#ffd36b", weapon: "staff", weaponColor: "#c9a24e", glow: "#ff7a2a", eyes: "#ffb36a", cape: "#3a0a0a", pauldrons: "#c9a24e" })),
  castle_necromancer: () => humanoid(robe("#121a12", { scale: 1.1, skin: "#a8b0a0", head: "skull", helm: { style: "hood", color: "#121a12" }, trim: "#5aff8a", tatter: true, weapon: "staff", weaponColor: "#d8d2bc", glow: "#5aff8a", eyes: "#5aff8a", cape: "#0a100a" })),
  castle_gargoyle: () => humanoid({ scale: 1.6, bulk: 1.3, hunch: true, body: "stone", head: "brute", skin: "#6a6862", hairStyle: "bald", boots: { style: "bare" }, rocky: true, horns: "#4a4844", wings: "#5a5852", tail: "#5a5852", claws: true, eyes: "#7fe0ff" }),
  castle_hellhound: () => wolf({ color: "#2a1210", dark: "#120806", scale: 2.0 }),
  castle_assassin: () => humanoid({ scale: 1.05, skin: "#a88470", helm: { style: "hood", color: "#141418" }, top: { style: "leather", color: "#1e1e24" }, legs: { style: "leather", color: "#16161a" }, boots: { style: "boot", color: "#101012" }, gloves: { style: "gauntlet", color: "#1a1a1e" }, cape: "#0e0e12", tatter: true, weapon: "dagger", weaponColor: "#b0b8c8", glow: "#9a5aff", eyes: "#c08aff", belt: "#3a2a3a" }),
  castle_knight: () => humanoid({ scale: 1.4, bulk: 1.25, skin: "#c8a888", top: { style: "plate", color: "#8a929c" }, legs: { style: "plate", color: "#7a828c" }, boots: { style: "plate", color: "#5a626c" }, gloves: { style: "gauntlet", color: "#8a929c" }, helm: { style: "great", color: "#9aa2ac" }, pauldrons: "#9aa2ac", cape: "#1a2a5a", weapon: "sword", weaponColor: "#cfd6de", off: "shield", shieldKind: "iron", shieldColor: "#1a2a5a", eyes: "#9ad8ff" }),
  castle_royal_guard: () => humanoid({ scale: 1.45, bulk: 1.3, skin: "#c8a888", top: { style: "plate", color: "#b8943e" }, legs: { style: "plate", color: "#8a6a2a" }, boots: { style: "plate", color: "#5a4420" }, gloves: { style: "gauntlet", color: "#b8943e" }, helm: { style: "great", color: "#c9a24e" }, helmHorns: true, pauldrons: "#c9a24e", cape: "#7a1a1a", weapon: "sword", weaponColor: "#e8d8a8", off: "shield", shieldKind: "iron", shieldColor: "#7a1a1a", eyes: "#ffd36b" }),
  vexmoor: () => humanoid({ scale: 2.1, bulk: 1.45, skin: "#b89878", beard: "#2a2a2a", beardStyle: "full", top: { style: "plate", color: "#2a1a2a" }, legs: { style: "plate", color: "#1e141e" }, boots: { style: "plate", color: "#140e14" }, gloves: { style: "gauntlet", color: "#2a1a2a" }, helm: { style: "crown", color: "#ffd36b" }, pauldrons: "#c9a24e", mantle: "#7a1a1a", cape: "#5a0a1a", weapon: "sword", weaponColor: "#ffd36b", glow: "#ffb22e", eyes: "#ffd36b", belt: "#c9a24e" }),
};
export const buildMonster = (type) => MONSTER_BUILD[type]();

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const NPC_BUILD = {
  gilded: () => humanoid({ bulk: 1.1, skin: "#d8b090", top: { style: "tunic", color: "#6a1a2a" }, legs: { style: "cloth", color: "#2a1a24" }, boots: { style: "boot", color: "#2a1a10" }, hair: "#e8e0d0", beard: "#e8e0d0", beardStyle: "full", weapon: "sword", weaponColor: "#ffd36b", glow: "#ffcf5a", belt: "#c9a24e", cape: "#7a1a2a", mantle: "#c9a24e", helm: { style: "crown", color: "#c9a24e" } }),
  smith: () => humanoid({ bulk: 1.2, skin: "#c08a6a", top: { style: "leather", color: "#5a3a26" }, sleeveless: true, legs: { style: "cloth", color: "#3a2a1a" }, boots: { style: "boot", color: "#2a1a0e" }, beard: "#5a3a1a", beardStyle: "full", hair: "#3a2a1a", hairStyle: "bald", weapon: "hammer", belt: "#2a1a0e", gloves: { style: "leather", color: "#3a2416" } }),
  merchant: () => humanoid(robe("#6a3a2a", { skin: "#d6a888", hair: "#7a4a2a", beard: "#7a4a2a", beardStyle: "stubble", trim: "#c9a24e", helm: { style: "cap", color: "#4a2a1a" } })),
  healer: () => humanoid(robe("#e8e0cc", { skin: "#e0b898", hair: "#c8a060", hairStyle: "long", helm: { style: "hood", color: "#d8cc9c" }, trim: "#c9a24e", weapon: "staff", weaponColor: "#c9b07a", glow: "#ffe08a" })),
  druid: () => humanoid(robe("#2e5a3a", { skin: "#c09070", antlers: true, hair: "#bbb", hairStyle: "long", beard: "#bbb", beardStyle: "full", trim: "#8a6a3a", mantle: "#4a3a22", weapon: "staff", weaponColor: "#5a4a2a", glow: "#7affc8" })),
  elder: () => humanoid(robe("#4a3a5a", { skin: "#d0a888", beard: "#ddd", beardStyle: "full", hair: "#ccc", hairStyle: "long", trim: "#c9a24e", weapon: "staff", weaponColor: "#5a4632", glow: "#ffcf7a" })),
  guard: () => humanoid({ skin: "#c8946e", beard: "#3a2414", beardStyle: "stubble", top: { style: "mail", color: "#8a8f96" }, trim: "#7a1f1f", legs: { style: "plate", color: "#8a8f96" }, boots: { style: "plate", color: "#6a6e74" }, gloves: { style: "gauntlet", color: "#8a8f96" }, helm: { style: "nasal", color: "#8a8f96" }, cape: "#7a1f1f", weapon: "spear", off: "shield", shieldKind: "iron", shieldColor: "#7a1f1f", pauldrons: "#8a8f96" }),
  villager: () => humanoid({ skin: pick(["#d0a080", "#c08a6a", "#e0b898", "#9a6a4a"]), top: { style: "tunic", color: pick(["#6a5a3a", "#5a6a4a", "#7a4a3a", "#4a5a6a"]) }, legs: { style: "cloth", color: "#4a3a2a" }, boots: { style: "shoe", color: "#3a2a1a" }, hair: pick(["#4a2a1a", "#8a6a3a", "#2a1a10", "#a8a090"]), hairStyle: pick(["short", "long", "tail"]), beard: Math.random() < 0.4 ? "#4a2a1a" : null, beardStyle: "stubble" }),
  gravekeeper: () => humanoid({ skin: "#c8a890", beard: "#d0d0d0", beardStyle: "goatee", hair: "#b8b8b8", hairStyle: "bald", hunch: true, top: { style: "robe", color: "#2a2620" }, boots: { style: "boot", color: "#1a1410" }, helm: { style: "hood", color: "#1e1a16" }, belt: "#4a3a26", weapon: "staff", weaponColor: "#4a3a2a" }),
  sailor: () => humanoid({ bulk: 1.1, skin: "#b88466", beard: "#8a8a8a", beardStyle: "full", hair: "#7a7a7a", top: { style: "tunic", color: "#2a4a6a" }, legs: { style: "cloth", color: "#3a3428" }, boots: { style: "boot", color: "#2a1f16" }, helm: { style: "cap", color: "#1e2a3a" }, belt: "#4a3020" }),
  fishmonger: () => humanoid({ skin: "#d6a888", hair: "#8a4a2a", hairStyle: "tail", top: { style: "tunic", color: "#5a7a7a" }, legs: { style: "cloth", color: "#3a3428" }, boots: { style: "boot", color: "#2a1f16" }, belt: "#e4ddcc", weapon: "dagger" }),
  child: () => humanoid({ scale: 0.6, skin: "#e0b090", top: { style: "tunic", color: "#4a6a8a" }, hair: "#9a6a2a", headScale: 1.25 }),
};
function waystone() {
  const root = new THREE.Group(), st = mat("stone", "#6a6872"), rune = M("#9ad8ff", { emissive: "#5ab8ff", emissiveIntensity: 2.2 });
  mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 8), st, 0, 0.2, 0, root);
  mesh(new THREE.CylinderGeometry(0.35, 0.55, 3, 6), st, 0, 1.9, 0, root);
  mesh(new THREE.OctahedronGeometry(0.4, 0), rune, 0, 3.8, 0, root);
  for (let i = 0; i < 3; i++) mesh(B(0.08, 0.5, 0.05), rune, Math.sin(i * 2.1) * 0.46, 1.3 + i * 0.7, Math.cos(i * 2.1) * 0.46, root).rotation.y = i * 2.1;
  return { root, kind: "prop", height: 3.6 };
}
function board() {
  const root = new THREE.Group(), wood = mat("leather", "#5a3e24"), dark = mat("leather", "#3a2816"), paper = M("#e8dcb8"), seal = M("#b02a1a", { emissive: "#6a0a0a", emissiveIntensity: 0.6 }), gold = M("#ffd36b", { emissive: "#ffb22e", emissiveIntensity: 1.2 });
  for (const x of [-1.25, 1.25]) mesh(B(0.2, 2.8, 0.2), dark, x, 1.4, 0, root);
  mesh(B(2.6, 1.6, 0.12), wood, 0, 1.75, 0, root);
  for (const y of [0.95, 2.55]) mesh(B(2.8, 0.14, 0.18), dark, 0, y, 0, root);
  const roof = mesh(B(3.1, 0.1, 0.8), dark, 0, 2.9, 0.1, root); roof.rotation.x = 0.25;
  [[-0.8, 2.0, 0.08], [0.0, 1.85, -0.06], [0.75, 2.05, 0.1], [-0.35, 1.35, 0.04], [0.55, 1.4, -0.08]].forEach(([x, y, r]) => {
    const sh = mesh(B(0.62, 0.78, 0.02), paper, x, y, 0.08, root); sh.rotation.z = r;
    mesh(B(0.12, 0.12, 0.03), seal, x, y + 0.3, 0.1, root);
  });
  mesh(new THREE.OctahedronGeometry(0.12, 0), gold, 0, 3.1, 0.15, root);
  return { root, kind: "prop", height: 3.0 };
}
function trunk() {
  const root = new THREE.Group(), wood = mat("leather", "#5a3a20"), iron = mat("metal", "#3a3a40"), gold = mat("metal", "#c9a24e");
  mesh(B(1.6, 0.8, 0.95), wood, 0, 0.4, 0, root);
  mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.6, 12, 1, false, 0, Math.PI), wood, 0, 0.8, 0, root).rotation.z = Math.PI / 2;
  for (const x of [-0.6, 0, 0.6]) { mesh(B(0.1, 0.84, 1.0), iron, x, 0.4, 0, root); mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12, 1, false, 0, Math.PI), iron, x, 0.8, 0, root).rotation.z = Math.PI / 2; }
  mesh(B(0.22, 0.26, 0.06), gold, 0, 0.72, 0.5, root);
  return { root, kind: "prop", height: 1.6 };
}
function chest() {
  const root = new THREE.Group(), wood = mat("leather", "#4a3018"), iron = mat("metal", "#2e3a3a"), gold = M("#ffd36b", { emissive: "#ffb22e", emissiveIntensity: 1.6 });
  mesh(B(1.5, 0.75, 0.95), wood, 0, 0.38, 0, root);
  const lid = mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.5, 12, 1, false, 0, Math.PI), wood, 0, 0.76, -0.05, root); lid.rotation.z = Math.PI / 2; lid.rotation.x = -0.35;
  for (const x of [-0.55, 0.55]) mesh(B(0.1, 0.8, 1.0), iron, x, 0.4, 0, root);
  for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8), gold, -0.5 + (i % 4) * 0.33, 0.8 + (i > 3 ? 0.05 : 0), 0.1 + (i % 2) * 0.12, root);
  for (let i = 0; i < 5; i++) mesh(new THREE.DodecahedronGeometry(0.12 + (i % 2) * 0.06, 0), M("#6a8a7a"), Math.cos(i * 1.3) * 0.95, 0.08, Math.sin(i * 1.3) * 0.7, root);
  return { root, kind: "prop", height: 1.4 };
}
function cryptDoor() {
  const root = new THREE.Group(), iron = mat("metal", "#2a2a2e"), glow = M("#7affc8", { emissive: "#3affa8", emissiveIntensity: 2.2 });
  mesh(B(0.7, 0.9, 0.12), iron, 0, 1.4, 0, root);
  const sk = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat("cloth", "#d8d0b8"), 0, 1.5, 0.1, root); sk.scale.set(1, 1.1, 0.6);
  mesh(new THREE.SphereGeometry(0.05, 6, 6), glow, -0.07, 1.52, 0.2, root); mesh(new THREE.SphereGeometry(0.05, 6, 6), glow, 0.07, 1.52, 0.2, root);
  return { root, kind: "prop", height: 1.9 };
}
export const buildNpc = (kind) => kind === "board" ? board() : kind === "trunk" ? trunk() : kind === "chest" ? chest() : kind === "crypt_door" ? cryptDoor() : kind === "waystone" ? waystone() : (NPC_BUILD[kind] || NPC_BUILD.villager)();

const CLASS_LOOK = {
  warrior: { skin: "#c8946e", hair: "#3a2414", hairStyle: "short", beard: "#3a2414", beardStyle: "stubble", top: { style: "tunic", color: "#6a5a48" }, legs: { style: "leather", color: "#3a3028" }, boots: { style: "boot", color: "#3a2a1c" }, bracers: "#4a3020", pauldrons: "#80868e", belt: "#3a2414" },
  wizard: { skin: "#d8b090", hair: "#cfcfcf", hairStyle: "long", beard: "#d0d0d0", beardStyle: "full", top: { style: "robe", color: "#2a2e6a" }, trim: "#c9a24e", helm: { style: "hat", color: "#1e2050" }, boots: { style: "shoe", color: "#2a1f16" } },
  warlock: { skin: "#c8b0a8", hair: "#141414", hairStyle: "long", top: { style: "robe", color: "#3a0e1e" }, trim: "#8a1a2a", helm: { style: "hood", color: "#1e0810" }, cape: "#4a0a1e", robeCape: true, iris: "#8a1010", boots: { style: "shoe", color: "#1a0e0a" } },
  ranger: { skin: "#c49070", hair: "#6a4a2a", hairStyle: "tail", top: { style: "leather", color: "#4a5a2e" }, undershirt: "#3a4a2a", legs: { style: "leather", color: "#3a3020" }, helm: { style: "hood", color: "#2e3e22" }, cape: "#2e3e22", bracers: "#3a2a1a", boots: { style: "boot", color: "#3a2a1a" } },
};
const helmStyle = (id) => /cap/.test(id) ? "cap" : /crown_/.test(id) ? "crown" : /heartwood|circlet/.test(id) ? "circlet" : /dread|great/.test(id) ? "great" : /hood|cowl/.test(id) ? "hood" : "nasal";
const chestStyle = (id) => /robe|vestment/.test(id) ? "robe" : /plate/.test(id) ? "plate" : /chain|mail/.test(id) ? "mail" : /cloak|mantle/.test(id) ? "cloak" : /leather|garb|hide/.test(id) ? "leather" : "tunic";

const LOOK_KEYS = ["skin", "hair", "hairStyle", "beardStyle", "face", "eyes"];
export const parseLook = (str) => { const v = (str || "").split(","); return v.length === 6 && v[0] ? Object.fromEntries(LOOK_KEYS.map((k, i) => [k, v[i]])) : null; };
export const lookStr = (l) => (l ? LOOK_KEYS.map((k) => l[k]).join(",") : "");
function applyLook(look, l) {
  if (!l) return;
  look.skin = l.skin; look.hair = l.hair; look.hairStyle = l.hairStyle === "mohawk" ? "bald" : l.hairStyle; look.mohawk = l.hairStyle === "mohawk" ? l.hair : null;
  look.beard = l.beardStyle === "none" ? null : l.hair; look.beardStyle = l.beardStyle; look.head = l.face === "classic" ? "human" : l.face; look.iris = l.eyes;
}
export function buildPlayer(cls, eqStr, items) {
  const [main, off, head, chest, counts, feet, legs, hands, belt, lk] = (eqStr || "").split("|");
  const look = { ...(CLASS_LOOK[cls] || CLASS_LOOK.warrior) };
  applyLook(look, parseLook(lk));
  const col = (id, d) => items[id]?.color || d;
  if (chest) {
    const st = chestStyle(chest), c = col(chest, "#6b5a45");
    look.top = { style: st === "cloak" ? (look.top.style === "robe" ? "robe" : "tunic") : st, color: st === "cloak" ? (look.top.color) : c };
    if (st === "cloak") { look.cape = c; look.mantle = c; look.robeCape = true; }
    if (st === "plate") { look.pauldrons = c; look.gloves = look.gloves || { style: "gauntlet", color: c }; }
    if (st === "mail") look.trim = look.trim && look.top.style !== "robe" ? look.trim : { warrior: "#7a1f1f", ranger: "#2e3e22", wizard: "#2a2e6a", warlock: "#3a0e1e" }[cls];
  }
  if (head) { const hs = helmStyle(head); look.helm = { style: hs, color: col(head, "#8a8f96") }; if (head === "dreadknight_helm") look.helmHorns = true; }
  if (feet) look.boots = { style: /wolf/.test(feet) ? "fur" : /plate|sabaton/.test(feet) ? "plate" : "boot", color: col(feet, "#4a3a2a") };
  if (legs) look.legs = { style: /greave|plate/.test(legs) ? "plate" : /leather/.test(legs) ? "leather" : "cloth", color: col(legs, "#4a3a2a") };
  if (hands) look.gloves = { style: /gauntlet/.test(hands) ? "gauntlet" : "leather", color: col(hands, "#5a4030") };
  if (belt) look.belt = col(belt, "#3a2414");
  look.weapon = weaponKind(main); look.weaponColor = items[main]?.color;
  look.glow = main === "ember_staff" ? "#ff7a2a" : main === "cultist_staff" ? "#b05cff" : ["epic", "legendary"].includes(items[main]?.rarity) ? items[main].color : "#7fd0ff";
  look.off = off === "wooden_shield" || off === "iron_shield" || /shield|aegis|bulwark/.test(off || "") ? "shield" : off === "spell_tome" || /tome|grimoire/.test(off || "") ? "tome" : /quiver/.test(off || "") ? "quiver" : null;
  look.shieldKind = /iron|aegis|bulwark/.test(off || "") ? "iron" : "wood";
  look.shieldColor = items[off]?.color || (look.shieldKind === "iron" ? "#8a8f96" : "#6a4a2a");
  const rig = humanoid(look);
  rig.eqStr = eqStr;
  addGearGlow(rig, items[main]?.rarity, counts);
  return rig;
}

const GLOW = { legendary: "#ffa83a", epic: "#c070ff" };
function addGearGlow(rig, mainRarity, counts) {
  const [nl, ne] = (counts || "0,0").split(",").map(Number);
  rig.shimmer = [];
  if (GLOW[mainRarity] && rig.mainMesh) rig.mainMesh.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); o.material.emissive = new THREE.Color(GLOW[mainRarity]); o.material.emissiveIntensity = 0.9; rig.shimmer.push(o.material);
  });
  if (!nl && !ne) return;
  const col = nl ? GLOW.legendary : GLOW.epic, n = 10 + nl * 8 + ne * 4, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = i * 2.4, y = 0.15 + (i / n) * 2.0, r = 0.55 + Math.sin(i * 1.7) * 0.12; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const aura = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: 0.17, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  rig.aura = new THREE.Group(); rig.aura.add(aura); rig.root.add(rig.aura);
  rig.auraStrength = Math.min(1, 0.4 + nl * 0.2 + ne * 0.08);
}

export function animateGlow(rig, t) {
  const k = 0.5 + 0.5 * Math.sin(t * 3.2);
  for (const m of rig.shimmer) m.emissiveIntensity = 0.5 + k * 1.3;
  if (rig.aura) {
    rig.aura.rotation.y = t * 1.3;
    rig.aura.children[0].material.opacity = (0.45 + 0.4 * Math.sin(t * 5)) * rig.auraStrength + 0.15;
    rig.aura.children[0].position.y = Math.sin(t * 1.6) * 0.12;
  }
}

export function buildLoot(itemId, item) {
  const g = new THREE.Group(), col = RARITY[item.rarity] || "#ccc";
  if (itemId === "vexmoor_coffer") {
    const wood = M("#4a2a1a"), gold = M("#ffd36b", { metalness: 0.8, roughness: 0.3, emissive: "#b8861e", emissiveIntensity: 0.5 });
    mesh(B(0.7, 0.42, 0.48), wood, 0, 0.21, 0, g); mesh(B(0.72, 0.16, 0.5), wood, 0, 0.5, 0, g);
    for (const x of [-0.26, 0, 0.26]) mesh(B(0.05, 0.6, 0.52), gold, x, 0.3, 0, g);
    mesh(B(0.12, 0.12, 0.04), gold, 0, 0.36, 0.26, g);
  } else if (itemId === "gold") for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), M("#ffcc3a", { metalness: 0.8, roughness: 0.25, emissive: "#5a3a00" }), (i % 3 - 1) * 0.12, 0.03 + i * 0.035, (i % 2) * 0.1, g);
  else if (item.type === "weapon") { const w = weaponMesh(weaponKind(itemId), item.color); w.rotation.set(0, 0, Math.PI / 2); w.position.y = 0.1; w.scale.setScalar(0.7); g.add(w); }
  else if (item.type === "consumable") { const c = item.full === "mp" || (item.mana && !item.heal) ? "#3a6aff" : item.mana ? "#c9a24e" : "#d0302a"; mesh(new THREE.SphereGeometry(0.14, 8, 6), M(c, { emissive: c, emissiveIntensity: 0.6, roughness: 0.2 }), 0, 0.14, 0, g); mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), M("#8a6a4a"), 0, 0.3, 0, g); }
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

export { animateRig, setInvis, SHIMMER } from "./rig/anim";
