import * as THREE from "three";

const cache = {};
export const G = (key, fn) => (cache[key] = cache[key] || fn());
const V2 = (pts) => { const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)); return v[0].y > v[v.length - 1].y ? v.reverse() : v; };

export function sculpt(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
export const lathe = (key, pts, seg = 20) => G("l" + key, () => new THREE.LatheGeometry(V2(pts), seg, Math.PI));
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// limb hanging from 0 down to -len, with a muscle bulge
export function limb(r1, r2, len, bulge = 0, at = 0.3, seg = 14) {
  const k = [r1, r2, len, bulge, at].map((n) => n.toFixed(3)).join(",");
  return G("limb" + k, () => {
    const pts = [[0, r1 * 0.55]];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([r1 + (r2 - r1) * t + bulge * gauss(t, at, 0.28), -t * len]); }
    pts.push([0, -len - r2 * 0.5]);
    return new THREE.LatheGeometry(V2(pts), seg, Math.PI);
  });
}

// torso from waist (y=0) to neck base (~0.62); w = width scale, front chest bulge
export function torsoGeo(w = 1, chest = 1, bare = false) {
  return G(`torso${w}${chest}${bare}`, () => {
    const pts = [[0.16, -0.06], [0.17, 0.02], [0.155, 0.12], [0.165, 0.24], [0.19, 0.36], [0.205, 0.46], [0.205, 0.55], [0.175, 0.605], [0.1, 0.64], [0, 0.645]];
    const g = new THREE.LatheGeometry(V2(pts), 28, Math.PI, Math.PI * 2);
    return sculpt(g, (v) => {
      const front = Math.max(0, v.z / 0.2), back = Math.max(0, -v.z / 0.2), side = Math.abs(v.x) / 0.2;
      v.x *= 0.92 * w + gauss(v.y, 0.52, 0.1) * 0.14 * w;
      v.z *= 0.62 * (0.5 + 0.5 * w);
      v.z += front * (gauss(v.y, 0.42, 0.09) * 0.045 * chest + (bare ? gauss(v.y, 0.2, 0.08) * 0.012 : 0));
      v.z -= back * gauss(v.y, 0.15, 0.12) * 0.02;
      v.z -= back * -gauss(v.y, 0.46, 0.08) * 0.02 * side;
      if (bare) v.z -= front * gauss(Math.abs(v.x), 0, 0.03) * gauss(v.y, 0.4, 0.1) * 0.012;
      v.y += gauss(Math.abs(v.x), 0.2, 0.08) * gauss(v.y, 0.6, 0.06) * -0.03;
    });
  });
}
export const pelvisGeo = (w = 1) => G("pelvis" + w, () => {
  const g = new THREE.SphereGeometry(0.18, 22, 12, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.5);
  return sculpt(g, (v) => { v.x *= 0.95 * w; v.z *= 0.7 * (0.5 + 0.5 * w); v.y *= 1.1; });
});

// sculpted head of radius ~0.12 centered at origin, face toward +z
export const headGeo = (kind = "human") => G("head" + kind, () => {
  const g = new THREE.SphereGeometry(0.12, 34, 26);
  const brute = kind === "brute", skull = kind === "skull", gob = kind === "goblin";
  return sculpt(g, (v) => {
    const x = v.x / 0.12, y = v.y / 0.12, z = v.z / 0.12;
    let sx = 0.84, sy = 1.08, sz = 1.0;
    if (y < 0) { const j = Math.min(1, -y); sx *= 1 - j * (brute ? 0.12 : 0.28); if (z > 0) sz *= 1 + j * 0.12 * (brute ? 1.6 : 1); else sz *= 1 - j * 0.32; }
    if (y > 0.3 && z < 0) sz *= 1.08;
    v.set(x * sx, y * sy, z * sz);
    if (z > 0.55) {
      v.z += gauss(y, 0.3, 0.12) * 0.06 * (brute || skull ? 2 : 1);
      v.z -= gauss(Math.abs(x), 0.36, 0.14) * gauss(y, 0.12, 0.12) * (skull ? 0.3 : 0.09);
      v.x += Math.sign(x) * gauss(Math.abs(x), 0.6, 0.15) * gauss(y, -0.05, 0.15) * 0.05;
      if (gob) v.z += gauss(y, -0.3, 0.3) * 0.12;
    }
    if (y < -0.55 && z > 0.2) v.z += 0.04;
    v.multiplyScalar(0.12);
  });
});

// hair cap covering top & back; clumped strands
export const hairGeo = (style) => G("hair" + style, () => {
  const R = 0.128, g = new THREE.SphereGeometry(R, 32, 22, 0, Math.PI * 2, 0, Math.PI * (style === "long" ? 0.82 : 0.7));
  return sculpt(g, (v) => {
    const a = Math.atan2(v.x, v.z), f = Math.max(0, Math.cos(a)), hl = (style === "long" ? -0.75 : -0.45) + Math.pow(f, 1.3) * (style === "long" ? 1.1 : 0.85) - (Math.abs(Math.sin(a)) > 0.7 ? 0.1 : 0);
    if (v.y < hl * R) { const yy = hl * R, rr = Math.sqrt(Math.max(0, R * R - yy * yy)), cur = Math.hypot(v.x, v.z) || 1; v.x *= rr / cur * 0.97; v.z *= rr / cur * 0.97; v.y = yy; }
    v.x *= 0.9; v.y *= 1.08;
    const clump = 1 + Math.sin(a * 14 + v.y * 40) * 0.03;
    v.x *= clump; v.z *= clump;
  });
});
export const longHairBack = () => G("longback", () => {
  const g = new THREE.CylinderGeometry(0.11, 0.13, 0.3, 20, 6, true, Math.PI * 0.55, Math.PI * 0.9);
  return sculpt(g, (v) => { const a = Math.atan2(v.x, v.z); const k = 1 + Math.sin(a * 11) * 0.06; v.x *= k; v.z *= k; v.z -= (0.15 - v.y) * 0.15; });
});
export const beardGeo = (full) => G("beard" + full, () => {
  const g = full ? new THREE.SphereGeometry(0.115, 24, 16, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.5, Math.PI * 0.5) : new THREE.SphereGeometry(0.12, 24, 12, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.6, Math.PI * 0.4);
  if (!full) return sculpt(g, (v) => { const x = v.x / 0.12, y = v.y / 0.12, z = v.z / 0.12; let sx = 0.84, sz = 1; const j = Math.min(1, Math.max(0, -y)); sx *= 1 - j * 0.28; sz *= 1 + j * 0.12; v.set(x * sx * 0.12, y * 1.08 * 0.12, z * sz * 0.12); });
  return sculpt(g, (v) => { const a = Math.atan2(v.x, v.z); v.x *= 0.82; v.z *= 1.06; if (v.y < -0.06) v.y *= full ? 1.9 : 1.15; const k = 1 + Math.sin(a * 13 + v.y * 60) * 0.04; v.x *= k; v.z *= k; });
});

// skirt / robe hem: open cone with folds from waist (y=0) downward
export function skirtGeo(r1, r2, len, folds = 9, tatter = false) {
  return G(`skirt${r1}${r2}${len}${folds}${tatter}`, () => {
    const g = new THREE.CylinderGeometry(r1, r2, len, 36, 8, true);
    g.translate(0, -len / 2, 0);
    return sculpt(g, (v) => {
      const a = Math.atan2(v.x, v.z), t = -v.y / len, k = 1 + Math.sin(a * folds) * 0.07 * t;
      v.x *= k * 1.12; v.z *= k * 0.86;
      if (tatter && t > 0.85) v.y += Math.abs(Math.sin(a * 7.3) * Math.sin(a * 3.1)) * len * 0.18;
    });
  });
}
export const capeGeo = (len, w = 1, tatter = false) => G(`cape${len}${w}${tatter}`, () => {
  const g = new THREE.CylinderGeometry(0.2 * w, 0.36 * w, len, 30, 8, true, Math.PI * 0.62, Math.PI * 0.76);
  g.translate(0, -len / 2, 0);
  return sculpt(g, (v) => {
    const a = Math.atan2(v.x, v.z), t = -v.y / len; const k = 1 + Math.sin(a * 10) * 0.08 * t;
    v.x *= k; v.z *= k * 0.75; v.z -= t * 0.06;
    if (tatter && t > 0.82) v.y += Math.abs(Math.sin(a * 9.1)) * len * 0.12;
  });
});
export const sleeveBell = () => G("bell", () => new THREE.LatheGeometry(V2([[0.06, 0], [0.065, -0.1], [0.085, -0.2], [0.12, -0.28], [0.115, -0.285]]), 16, Math.PI));
export const pauldronGeo = (r) => G("pd" + r, () => sculpt(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), (v) => { v.y *= 0.75; v.x *= 1.1; }));
export const rockGeo = (r, seed) => G(`rock${r}${seed}`, () => {
  const g = new THREE.IcosahedronGeometry(r, 1);
  return sculpt(g, (v) => { const n = Math.sin(v.x * 37 + seed) * Math.sin(v.y * 29 + seed * 2) * Math.sin(v.z * 31); v.multiplyScalar(1 + n * 0.22); });
});
export const tube = (key, pts, r, seg = 12, taper = true) => G("tube" + key, () => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, r, 8, false);
  if (!taper) return g;
  const p = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; curve.getPointAt(t, c);
    for (let j = 0; j <= 8; j++) { const k = i * 9 + j; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(1 - t * 0.9).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
});
export const wingGeo = () => G("wing", () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(0.35, 0.45, 0.95, 0.55); s.quadraticCurveTo(0.8, 0.3, 0.9, 0.1);
  s.quadraticCurveTo(0.7, 0.05, 0.75, -0.2); s.quadraticCurveTo(0.5, -0.15, 0.5, -0.4); s.quadraticCurveTo(0.25, -0.2, 0, 0);
  return new THREE.ShapeGeometry(s, 10);
});
