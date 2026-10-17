import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let envTex = null;
const SHINY = new Set(["metal", "chain", "scale"]);
export function setEnv(renderer) {
  if (!envTex) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
  Object.entries(mats).forEach(([k, m]) => { if (m.userData.shiny) { m.envMap = envTex; m.envMapIntensity = 0.55; m.needsUpdate = true; } });
}

const N = 128;
const rnd = (s) => () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296;
function canvasTex(draw, rep = 1, seed = 7) {
  const c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N), r = rnd(seed);
  draw(img.data, r);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const vnoise = (r, cells) => {
  const v = Array.from({ length: cells * cells }, r);
  return (x, y) => {
    const fx = (x / N) * cells, fy = (y / N) * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const at = (a, b) => v[((b % cells) * cells) + (a % cells)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
};
const fill = (d, f) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.max(0, Math.min(255, f(x, y))), i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } };

const DRAW = {
  cloth: (d, r) => { const n = vnoise(r, 8); fill(d, (x, y) => 205 + ((x % 4 < 2) ^ (y % 4 < 2) ? 22 : 0) + n(x, y) * 28 + (r() - 0.5) * 14); },
  leather: (d, r) => { const n = vnoise(r, 6), m = vnoise(r, 24); fill(d, (x, y) => 190 + n(x, y) * 45 + m(x, y) * 25 - (Math.abs(Math.sin((x + n(x, y) * 40) * 0.09)) < 0.03 ? 40 : 0)); },
  metal: (d, r) => { const n = vnoise(r, 4), rows = Array.from({ length: N }, () => r()); fill(d, (x, y) => 200 + rows[y] * 30 + n(x, y) * 25); },
  chain: (d, r) => { fill(d, (x, y) => { const cx = (x % 8) - 4, cy = ((y + (Math.floor(x / 8) % 2) * 4) % 8) - 4, q = Math.hypot(cx, cy); return q > 1.5 && q < 3.5 ? 235 - q * 8 : 70 + r() * 20; }); },
  skin: (d, r) => { const n = vnoise(r, 10), m = vnoise(r, 32); fill(d, (x, y) => 228 + n(x, y) * 18 + m(x, y) * 9); },
  fur: (d, r) => { const n = vnoise(r, 5); const s = Array.from({ length: N }, () => r()); fill(d, (x, y) => 150 + s[(x + Math.floor(n(x, y) * 30)) % N] * 90 + n(x, y) * 15); },
  stone: (d, r) => { const n = vnoise(r, 6), m = vnoise(r, 20); fill(d, (x, y) => 160 + n(x, y) * 60 + m(x, y) * 35 - (Math.abs(n(x, y) - 0.5) < 0.02 ? 70 : 0)); },
  bone: (d, r) => { const n = vnoise(r, 7), m = vnoise(r, 28); fill(d, (x, y) => 200 + n(x, y) * 40 + m(x, y) * 15); },
  hair: (d, r) => { const s = Array.from({ length: N }, () => r()), n = vnoise(r, 4); fill(d, (x, y) => 140 + s[(x + Math.floor(n(x, y) * 12)) % N] * 115); },
  scale: (d, r) => { fill(d, (x, y) => { const row = Math.floor(y / 8), cx = ((x + (row % 2) * 4) % 8) - 4, cy = (y % 8); return 120 + Math.max(0, 1 - Math.hypot(cx, cy - 1) / 6) * 130 + r() * 10; }); },
};
const REP = { cloth: 4, leather: 2, metal: 1, chain: 6, skin: 1, fur: 3, stone: 1, bone: 1, hair: 2, scale: 5 };
const tex = {};
const getTex = (k) => (tex[k] = tex[k] || canvasTex(DRAW[k], REP[k], k.length * 31 + 3));

const BASE = {
  cloth: { roughness: 0.95, metalness: 0, bump: 1.2 },
  leather: { roughness: 0.68, metalness: 0.02, bump: 1.6 },
  metal: { roughness: 0.32, metalness: 0.85, bump: 0.6 },
  chain: { roughness: 0.42, metalness: 0.8, bump: 3 },
  skin: { roughness: 0.58, metalness: 0, bump: 0.5 },
  fur: { roughness: 1, metalness: 0, bump: 2.5 },
  stone: { roughness: 0.95, metalness: 0, bump: 3 },
  bone: { roughness: 0.75, metalness: 0, bump: 1.2 },
  hair: { roughness: 0.75, metalness: 0, bump: 1.5 },
  scale: { roughness: 0.4, metalness: 0.45, bump: 2.5 },
  plain: { roughness: 0.6, metalness: 0 },
};
const mats = {};
export function mat(kind, color, extra = {}) {
  const key = kind + color + JSON.stringify(extra);
  if (mats[key]) return mats[key];
  const b = BASE[kind] || BASE.plain, o = { color, roughness: b.roughness, metalness: b.metalness, ...extra };
  if (DRAW[kind]) { const t = getTex(kind); o.map = t; o.bumpMap = t; o.bumpScale = b.bump; }
  if (kind === "metal") o.roughnessMap = getTex("metal");
  const PHYS = { skin: { sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffb0a0"), clearcoat: 0.05, clearcoatRoughness: 0.7 },
    cloth: { sheen: 0.8, sheenRoughness: 0.75, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35) },
    hair: { sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#fff4e0"), 0.5), anisotropy: 0.6 },
    leather: { clearcoat: 0.25, clearcoatRoughness: 0.45 }, fur: { sheen: 0.7, sheenRoughness: 0.8, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4) } }[kind];
  const m = PHYS ? new THREE.MeshPhysicalMaterial({ ...o, ...PHYS }) : new THREE.MeshStandardMaterial(o);
  if (SHINY.has(kind) || o.metalness > 0.5) { m.userData.shiny = true; if (envTex) { m.envMap = envTex; m.envMapIntensity = 0.55; } }
  return (mats[key] = m);
}
export const glowMat = (c, i = 2.2) => mat("plain", c, { emissive: c, emissiveIntensity: i });
