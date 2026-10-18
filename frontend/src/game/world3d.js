import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const windUniform = { value: 0 };
export const swayUniform = { value: localStorage.getItem("sx_still_grass") ? 0 : 1 };
export const cutUniform = { value: new THREE.Vector3(0, -99, 0) };
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z) => vnoise(x * 0.02, z * 0.02) * 0.6 + vnoise(x * 0.07, z * 0.07) * 0.3 + vnoise(x * 0.21, z * 0.21) * 0.1;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

export class Terrain {
  constructor(world) {
    this.w = world;
    this.fw = world.w / 2; this.fh = world.h / 2;
    this.RD = this.field(); this.SD = this.field();
    this.stamp(this.RD, world.main_road, 3.2);
    world.paths.forEach((p) => this.stamp(this.RD, p.pts, p.w));
    world.streams.forEach((s) => this.stamp(this.SD, s, 2.6));
    const bytes = Uint8Array.from(atob(world.grid), (c) => c.charCodeAt(0));
    this.grid = bytes;
  }
  field() { return new Float32Array(this.fw * this.fh).fill(99); }
  stamp(F, pts, width) {
    const R = 6;
    for (const [x, z] of pts) {
      const cx = Math.floor(x / 2), cz = Math.floor(z / 2);
      for (let j = cz - R; j <= cz + R; j++) for (let i = cx - R; i <= cx + R; i++) {
        if (i < 0 || j < 0 || i >= this.fw || j >= this.fh) continue;
        const d = Math.hypot(i * 2 + 1 - x, j * 2 + 1 - z) - width;
        const k = j * this.fw + i;
        if (d < F[k]) F[k] = d;
      }
    }
  }
  sample(F, x, z) {
    const fx = x / 2 - 0.5, fz = z / 2 - 0.5;
    const i = Math.max(0, Math.min(this.fw - 2, Math.floor(fx))), j = Math.max(0, Math.min(this.fh - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const a = F[j * this.fw + i], b = F[j * this.fw + i + 1], c = F[(j + 1) * this.fw + i], d = F[(j + 1) * this.fw + i + 1];
    return mix(mix(a, b, tx), mix(c, d, tx), tz);
  }
  blocked(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 0 || zi < 0 || xi >= this.w.w || zi >= this.w.h) return true;
    const k = zi * this.w.w + xi;
    return (this.grid[k >> 3] >> (7 - (k & 7))) & 1;
  }
  townFactor(x, z) {
    let m = 999;
    for (const [k, c] of Object.entries(this.w.towns)) m = Math.min(m, k === "elderglen" ? Math.hypot((x - c[0]) * 0.85, z - c[1]) : Math.hypot(x - c[0], z - c[1]) * (k === "semel" ? 1 : 1.15));
    return smooth(40, 75, m);
  }
  lake(x, z) {
    let m = 99;
    for (const l of this.w.lakes) m = Math.min(m, Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz));
    return m;
  }
  caveHeight(x, z) {
    if (!this.blocked(x, z)) return vnoise(x * 0.5, z * 0.5) * 0.12;
    let n = 0;
    for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6], [1.1, 1.1], [-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1]]) n += this.blocked(x + dx, z + dz) ? 1 : 0;
    return 0.4 + (n / 8) * 3.2 + fbm(x * 0.7, z * 0.7) * 1.4;
  }
  coast(x, z) {
    const u = x - (this.w.ox || 0), v = z - (this.w.oz || 0), qx = Math.abs(u - 800) - 720, qy = Math.abs(v - 200) - 120;
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 150;
    const main = d + 26 * Math.sin(u * 0.0105 + v * 0.006) + 16 * Math.sin(u * 0.023 - v * 0.017 + 1.7) + 8 * Math.sin(u * 0.057 + v * 0.049 + 0.6) + 4 * Math.sin(u * 0.13 - v * 0.11 + 2.1);
    return Math.min(main, this.isle(x, z));
  }
  isle(x, z) {
    const I = this.w.isles; if (!I) return 999;
    const wb = 4 * Math.sin(x * 0.09 + z * 0.07) + 2.5 * Math.sin(x * 0.21 - z * 0.17 + 1.3);
    let d = 999;
    for (const i of I) d = Math.min(d, Math.hypot(x - i.x, z - i.z) - i.r + wb);
    for (const [a, b] of this.w.isle_bars || []) {
      const A = I[a], B = I[b], dx = B.x - A.x, dz = B.z - A.z, t = Math.max(0, Math.min(1, ((x - A.x) * dx + (z - A.z) * dz) / (dx * dx + dz * dz)));
      d = Math.min(d, Math.hypot(x - A.x - t * dx, z - A.z - t * dz) - 8 + wb * 0.15);
    }
    return d;
  }
  height(x, z) {
    if (z > this.w.oh - 3) return this.caveHeight(x, z);
    const cd = this.w.ox ? this.coast(x, z) : -99;
    if (cd > -3) return -1.2 - Math.min(5, (cd + 3) * 0.12) + vnoise(x * 0.2, z * 0.2) * 0.3;
    return mix(-0.9, this.landHeight(x, z), smooth(-3, -18, cd));
  }
  landHeight(x, z) {
    const rd = this.sample(this.RD, x, z), sd = this.sample(this.SD, x, z);
    let amp = 5.5;
    if (x - (this.w.ox || 0) > 880 && z - (this.w.oz || 0) < 130) amp = 11;
    let h = (fbm(x, z) - 0.45) * amp;
    h *= smooth(1, 14, rd) * 0.85 + 0.15 * (rd < 0 ? 0 : 1);
    if (rd < 1) h *= 0.15;
    h *= this.townFactor(x, z);
    if (h < 0) h = -0.3 * (1 - Math.exp(h / 0.3));
    if (sd < 7) h = mix(h, mix(-1.0, h, smooth(1.5, 7, sd)), smooth(0.5, 3.5, rd));
    const lk = this.lake(x, z);
    if (lk < 1.4) h = mix(-1.3, h, smooth(0.8, 1.4, lk));
    return h;
  }
  groundColor(x, z, out) {
    if (z > this.w.oh - 3) {
      const n = fbm(x * 2.3, z * 2.3), moss = smooth(0.6, 0.8, vnoise(x * 0.3, z * 0.3));
      const wall = this.blocked(x, z) ? 1 : 0, v = 0.75 + n * 0.5;
      out[0] = (wall ? 0.27 : 0.13) * v; out[1] = (wall ? 0.25 : 0.13 + moss * 0.05) * v; out[2] = (wall ? 0.23 : 0.14) * v;
      return;
    }
    const n = fbm(x * 3.1, z * 3.1), n2 = vnoise(x * 0.6, z * 0.6), lx = x - (this.w.ox || 0);
    const cd = this.w.ox ? this.coast(x, z) : -99;
    if (cd > -3) { const deep = smooth(-3, 40, cd); out[0] = mix(0.12, 0.04, deep); out[1] = mix(0.32, 0.12, deep); out[2] = mix(0.38, 0.26, deep); return; }
    const east = smooth(780, 900, lx), mid = smooth(330, 480, lx) * (1 - east);
    let r = mix(0.3, 0.22, mid), g = mix(0.4, 0.3, mid), b = mix(0.16, 0.14, mid);
    r = mix(r, 0.18, east); g = mix(g, 0.32, east); b = mix(b, 0.24, east);
    const far = smooth(1110, 1250, lx);
    r = mix(r, 0.42, far); g = mix(g, 0.38, far); b = mix(b, 0.18, far);
    const dirt = smooth(0.55, 0.8, n2) * 0.6;
    r = mix(r, 0.3, dirt); g = mix(g, 0.24, dirt); b = mix(b, 0.15, dirt);
    const v = 0.82 + n * 0.36;
    r *= v; g *= v; b *= v;
    const rd = this.sample(this.RD, x, z);
    if (rd < 1.6) {
      const t = smooth(1.6, -0.3, rd), nn = 0.85 + hash(Math.floor(x * 3), Math.floor(z * 3)) * 0.25;
      r = mix(r, 0.5 * nn, t); g = mix(g, 0.39 * nn, t); b = mix(b, 0.25 * nn, t);
      if (rd > 0.2 && rd < 1.2) { r *= 0.9; g *= 0.9; b *= 0.88; }
    }
    const sd = this.sample(this.SD, x, z);
    if (sd < 3) { const t = smooth(3, 0.5, sd); r = mix(r, 0.16, t); g = mix(g, 0.15, t); b = mix(b, 0.11, t); }
    const tf = 1 - this.townFactor(x, z);
    if (tf > 0) { r = mix(r, r * 1.08 + 0.02, tf); g = mix(g, g * 1.05, tf); }
    const sand = smooth(-16, -5, cd);
    if (sand > 0) { const sn = 0.92 + n * 0.16; r = mix(r, 0.62 * sn, sand); g = mix(g, 0.55 * sn, sand); b = mix(b, 0.38 * sn, sand); }
    out[0] = r; out[1] = g; out[2] = b;
  }
  buildMesh() {
    const { w, h } = this.w, S = 2, nx = w / S + 1, nz = h / S + 1;
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = i * S, z = j * S;
      pos[k * 3] = x; pos[k * 3 + 1] = this.height(x, z); pos[k * 3 + 2] = z;
      uv[k * 2] = x / w; uv[k * 2 + 1] = z / h;
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const PX = 2, cw = w * PX, ch = h * PX;
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(cw, ch), d = img.data, c = [0, 0, 0];
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      this.groundColor(i / PX, j / PX, c);
      const k = (j * cw + i) * 4;
      d[k] = Math.min(255, c[0] * 255); d[k + 1] = Math.min(255, c[1] * 255); d[k + 2] = Math.min(255, c[2] * 255); d[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.mapCanvas = cv;
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const detail = detailTexture();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detail };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vWxz;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWxz = position.xz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vWxz;\nuniform sampler2D detailMap;")
        .replace("#include <map_fragment>", "#include <map_fragment>\nvec3 dt = texture2D(detailMap, vWxz*0.33).rgb * texture2D(detailMap, vWxz*0.071).rgb;\ndiffuseColor.rgb *= dt*2.6;");
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
}

function detailTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#a0a0a0"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.random() * 80 | 0;
    ctx.strokeStyle = `rgb(${v},${v},${v})`; ctx.lineWidth = 1 + Math.random();
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28, l = 2 + Math.random() * 6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
function windify(mat, amt = 0.12, cut = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.uniforms.uSway = swayUniform;
    sh.uniforms.uCut = cutUniform;
    if (cut) sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vCut;\nuniform vec3 uCut;")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      { vec3 ca = uCut + vec3(0.0, 1.0, 0.0); vec3 cd = normalize(cameraPosition - ca); vec3 cp = vCut - ca; float ct = dot(cp, cd); float d = length(cp - cd * ct);
        if (ct > 1.2 && d < 3.6) { float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453); if (n > smoothstep(1.6, 3.6, d) * 0.95) discard; } }`);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;\nuniform float uSway;\nvarying vec3 vCut;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x*0.21 + instanceMatrix[3].z*0.17;
      ${amt ? `transformed.x += uSway * sin(uWind*1.3+ph) * ${amt.toFixed(3)} * max(0.0, position.y);
      transformed.z += uSway * cos(uWind*1.1+ph) * ${(amt * 0.6).toFixed(3)} * max(0.0, position.y);` : "ph += 0.0;"}
      vCut = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
  };
  return mat;
}
const tr = (g, x, y, z, s = 1, ry = 0, rx = 0, rz = 0) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)));
  return g;
};
function jitter(g, amt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 0.5;
    p.setXYZ(i, p.getX(i) * (1 + k * amt), p.getY(i) * (1 + k * amt * 0.6), p.getZ(i) * (1 - k * amt));
  }
  g.computeVertexNormals();
  return g;
}

function canvasTex(draw, w = 128, h = 128) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const rnd = (() => { let sd = 1337; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; })();
function leafTex(hue, sat, needles) {
  return canvasTex((c, w, h) => {
    if (needles) {
      c.strokeStyle = `hsl(${hue},${sat}%,18%)`; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 6); c.stroke();
      for (let i = 0; i < 70; i++) {
        const y = 8 + rnd() * (h - 14), side = rnd() < 0.5 ? -1 : 1, len = 10 + (y / h) * 26 * rnd() + 8;
        c.strokeStyle = `hsl(${hue + rnd() * 14 - 7},${sat}%,${14 + rnd() * 22}%)`; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 + side * len, y - len * 0.5); c.stroke();
      }
      return;
    }
    for (let i = 0; i < 46; i++) {
      const x = 14 + rnd() * (w - 28), y = 14 + rnd() * (h - 28), r = 7 + rnd() * 9, a = rnd() * Math.PI;
      c.fillStyle = `hsl(${hue + rnd() * 18 - 9},${sat + rnd() * 10}%,${16 + rnd() * 26}%)`;
      c.beginPath(); c.ellipse(x, y, r, r * 0.48, a, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
    }
  });
}
function barkTex(base, light) {
  const t = canvasTex((c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, wd = 1 + rnd() * 3, l = 20 + rnd() * 80, y = rnd() * h;
      c.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.35)" : light; c.fillRect(x, y, wd, l); c.fillRect(x, y - h, wd, l);
    }
  }, 64, 128);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5);
  return t;
}
function shade(g, lo, hi, y0, y1) {
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), a = new THREE.Color(lo), b = new THREE.Color(hi), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); c.copy(a).lerp(b, k); cols.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return g;
}
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!["position", "normal", "uv"].includes(k)) n.deleteAttribute(k); return n; };
function cards(blobs, n, size, droop = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [bx, by, bz, br] = blobs[i % blobs.length];
    const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1) * 0.8, r = br * (0.75 + rnd() * 0.35);
    const x = bx + Math.sin(v) * Math.cos(u) * r, y = by + Math.cos(v) * r * 0.8, z = bz + Math.sin(v) * Math.sin(u) * r;
    const g = clean(new THREE.PlaneGeometry(size, size));
    g.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 1.4 + droop); g.rotateY(Math.atan2(x - bx, z - bz) + (rnd() - 0.5) * 0.8); g.translate(x, y, z);
    out.push(g);
  }
  return out;
}
function canopy(blobs, n, size, lo, hi, y0, y1) {
  const core = mergeGeometries(blobs.map(([x, y, z, r]) => clean(tr(new THREE.IcosahedronGeometry(r * 0.78, 1), x, y, z))));
  const leaves = mergeGeometries(cards(blobs, n, size));
  return [shade(jitter(core, 0.12), lo, hi, y0, y1), shade(leaves, lo, hi, y0, y1)];
}
function pineTiers(tiers, lo, hi) {
  const core = [], br = [];
  tiers.forEach(([y, r, hgt]) => {
    core.push(clean(tr(new THREE.ConeGeometry(r * 0.7, hgt, 8), 0, y, 0)));
    const k = Math.round(7 + r * 3);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rnd() * 0.4, g = clean(new THREE.PlaneGeometry(r * 1.05, hgt * 0.95));
      g.translate(0, -hgt * 0.1, 0); g.rotateX(-0.95 - rnd() * 0.3); g.translate(0, 0, r * 0.45); g.rotateY(a); g.translate(0, y + hgt * 0.15, 0);
      br.push(g);
    }
  });
  const y0 = tiers[0][0] - tiers[0][2] / 2, y1 = tiers[tiers.length - 1][0] + tiers[tiers.length - 1][2] / 2;
  return [shade(jitter(mergeGeometries(core), 0.08), lo, hi, y0, y1), shade(mergeGeometries(br), lo, hi, y0, y1)];
}
function treeSpecies() {
  const bt = barkTex("#4a3524", "rgba(140,110,80,0.25)"), btg = barkTex("#5a5048", "rgba(160,150,140,0.25)"), btp = barkTex("#7a6c5c", "rgba(220,210,190,0.3)");
  const BM = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
  const bark = BM(bt), barkGrey = BM(btg), barkPale = BM(btp);
  const LM = (tex, o = {}) => windify(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, ...o }), 0, true);
  const CM = (o = {}) => windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, ...o }), 0, true);
  const pineL = LM(leafTex(130, 35, true)), oakL = LM(leafTex(95, 45, false)), elderL = LM(leafTex(170, 40, false), { emissive: "#0b2a2a", emissiveIntensity: 0.35 });
  const pineC = CM(), oakC = CM(), elderC = CM({ emissive: "#0b2a2a", emissiveIntensity: 0.3 });
  const roots = (r) => [0, 1, 2, 3, 4].map((i) => clean(tr(new THREE.CylinderGeometry(0.04, r * 0.45, 1.0, 5), Math.cos(i * 1.3) * r, 0.12, Math.sin(i * 1.3) * r, 1, 0, Math.sin(i * 1.3) * 1.1, -Math.cos(i * 1.3) * 1.1)));
  const limb = (x, y, z, l, rad, rx, rz) => clean(tr(new THREE.CylinderGeometry(rad * 0.4, rad, l, 5), x, y, z, 1, 0, rx, rz));
  const pine = pineTiers([[2.7, 2.1, 2.6], [3.9, 1.75, 2.4], [5.0, 1.35, 2.2], [6.0, 0.9, 1.8], [6.9, 0.5, 1.4]], "#0e2414", "#3c6a3a");
  const oak = canopy([[0, 3.8, 0, 1.9], [1.4, 3.3, 0.4, 1.4], [-1.2, 3.5, -0.5, 1.4], [0.2, 4.8, 0.5, 1.3], [-0.4, 3.2, 1.2, 1.2], [0.6, 3.4, -1.3, 1.2]], 110, 1.25, "#1e3410", "#7a9a3a", 2, 6);
  const elder = canopy([[0, 3.6, 0, 2.3], [0, 5.3, 0, 1.8], [0, 6.8, 0, 1.3], [1.2, 4.2, 0.6, 1.3], [-1.1, 4.6, -0.7, 1.3]], 120, 1.3, "#0a2a28", "#3f8a78", 2, 8);
  return [
    { parts: [[mergeGeometries([clean(tr(new THREE.CylinderGeometry(0.14, 0.3, 3.4, 7), 0, 1.7, 0)), ...roots(0.35)]), bark], [pine[0], pineC], [pine[1], pineL]] },
    { parts: [[mergeGeometries([clean(tr(new THREE.CylinderGeometry(0.22, 0.42, 3, 7), 0, 1.5, 0)), limb(0.55, 2.9, 0, 1.7, 0.16, 0, -0.85), limb(-0.5, 2.8, 0.2, 1.5, 0.14, 0.4, 0.8), limb(0, 3.1, -0.5, 1.4, 0.12, -0.8, 0), ...roots(0.45)]), bark], [oak[0], oakC], [oak[1], oakL]] },
    { parts: [[mergeGeometries([clean(tr(new THREE.CylinderGeometry(0.16, 0.4, 4.6, 7), 0, 2.3, 0)), ...roots(0.45)]), barkPale], [elder[0], elderC], [elder[1], elderL]] },
    { parts: [[mergeGeometries([clean(tr(new THREE.CylinderGeometry(0.1, 0.34, 3.8, 6), 0, 1.9, 0)), limb(0.55, 3.0, 0, 1.8, 0.09, 0, -1.0), limb(-0.45, 2.5, 0.2, 1.5, 0.08, 0.5, 0.9),
      limb(0, 3.3, 0.45, 1.2, 0.07, 0.9, 0), limb(0.9, 3.7, 0.1, 0.8, 0.04, 0, -0.4), limb(-0.8, 3.1, 0.4, 0.7, 0.035, 0.3, 0.5), ...roots(0.4)]), barkGrey]] },
  ];
}

export function buildVegetation(world, terrain, scene) {
  const CH = 110, chunks = new Map();
  const add = (key, cx, cz, kind, mat4, color) => {
    const k = `${key}:${Math.floor(cx / CH)}:${Math.floor(cz / CH)}`;
    if (!chunks.has(k)) chunks.set(k, { key, kind, list: [] });
    chunks.get(k).list.push([mat4, color]);
  };
  const species = treeSpecies();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const mk = (x, y, z, sc, ry, sx = sc, sy = sc, tilt = 0) => new THREE.Matrix4().compose(v.set(x, y, z), q.setFromEuler(e.set(tilt, ry, tilt * 0.5)), s.set(sx, sy, sc));
  const col = new THREE.Color();
  for (const [x, z, kind, sc, ry] of world.trees) {
    const y = terrain.height(x, z) - 0.1;
    const m4 = mk(x, y, z, sc, ry, sc, sc * (0.9 + (ry % 1) * 0.3));
    const tint = 0.8 + ((x * 7.3 + z * 3.1) % 1) * 0.4;
    species[kind].parts.forEach((_, pi) => add(`t${kind}_${pi}`, x, z, "tree", m4, col.setRGB(tint, tint, tint).clone()));
  }
  const rockGeo = [jitter(new THREE.DodecahedronGeometry(1, 0), 0.35), jitter(new THREE.IcosahedronGeometry(1, 0), 0.4)];
  const rockMat = M("#6f6a62"), mossRock = M("#5d6550");
  for (const [x, z, sc, ry] of world.rocks) {
    const y = terrain.height(x, z);
    add(`r${Math.floor(ry) % 2}`, x, z, "rock", mk(x, y + sc * 0.2, z, sc, ry, sc * 1.2, sc * 0.75), col.setHSL(0.08, 0.06, 0.35 + (ry % 1) * 0.2).clone());
  }
  const bushGeo = jitter(mergeGeometries([tr(new THREE.IcosahedronGeometry(0.8, 1), 0, 0.5, 0), tr(new THREE.IcosahedronGeometry(0.6, 0), 0.6, 0.4, 0.2), tr(new THREE.IcosahedronGeometry(0.55, 0), -0.5, 0.35, -0.3)]), 0.2);
  const bushMat = [windify(M("#36502a"), 0.05), windify(M("#2a4a40"), 0.05)];
  for (const [x, z, sc, k] of world.bushes) {
    const y = terrain.height(x, z);
    add(`b${k}`, x, z, "bush", mk(x, y, z, sc, x * 3.7, sc, sc * 0.8), col.setHSL(k ? 0.42 : 0.26, 0.4, 0.22 + ((x * 1.3) % 1) * 0.12).clone());
  }
  const grassGeo = grassGeometry();
  const grassMat = windify(new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.25);
  for (const [x, z, sc] of world.grass) {
    const y = terrain.height(x, z);
    add("g", x, z, "grass", mk(x, y, z, sc, x * 5.1), col.setHSL(x - (world.ox || 0) > 820 ? 0.38 : 0.22, 0.45, 0.28 + ((z * 1.7) % 1) * 0.14).clone());
  }
  const geos = {}, mats = {};
  species.forEach((sp, k) => sp.parts.forEach(([g, m], pi) => { geos[`t${k}_${pi}`] = g; mats[`t${k}_${pi}`] = m; }));
  geos.r0 = rockGeo[0]; geos.r1 = rockGeo[1]; mats.r0 = rockMat; mats.r1 = mossRock;
  geos.b0 = geos.b1 = bushGeo; mats.b0 = bushMat[0]; mats.b1 = bushMat[1];
  geos.g = grassGeo; mats.g = grassMat;
  const group = new THREE.Group();
  for (const { key, kind, list } of chunks.values()) {
    const im = new THREE.InstancedMesh(geos[key], mats[key], list.length);
    list.forEach(([m4, c], i) => { im.setMatrixAt(i, m4); im.setColorAt(i, c); });
    im.castShadow = (kind === "tree" && !mats[key].alphaTest) || kind === "rock";
    im.receiveShadow = kind !== "grass";
    im.computeBoundingSphere();
    group.add(im);
  }
  scene.add(group);
  return group;
}

function grassGeometry() {
  const a = new THREE.PlaneGeometry(0.9, 0.6); a.translate(0, 0.3, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const c = a.clone().rotateY(Math.PI / 4);
  return mergeGeometries([a, b, c]);
}
function grassTexture() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
  const ctx = cv.getContext("2d");
  for (let i = 0; i < 22; i++) {
    const x = 4 + Math.random() * 56, h = 30 + Math.random() * 32, l = 40 + Math.random() * 40;
    ctx.strokeStyle = `hsl(${80 + Math.random() * 30},40%,${l}%)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 10, 64 - h / 2, x + (Math.random() - 0.5) * 16, 64 - h); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// shore-distance field baked once; the sea shader rolls foam bands toward the beaches with it
export const waterLight = { value: 1 };
const WATER_VS = `
varying vec2 vSea; varying vec3 vView;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vSea = wp.xz; vView = cameraPosition - wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `
uniform vec3 uColor; uniform vec3 uEmissive; uniform vec3 uSun; uniform float uOpacity; uniform float uTime; uniform float uLight;
#ifdef SEA
uniform sampler2D uShore; uniform vec2 uSize;
#endif
varying vec2 vSea; varying vec3 vView;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec3 base = uColor; float a = uOpacity, foam = 0.0;
#ifdef SEA
  vec2 suv = vSea / uSize;
  float cd = (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) ? 60.0 : texture2D(uShore, suv).r * 63.75 - 8.0;
  float near = 1.0 - smoothstep(0.0, 16.0, cd);
  if (near > 0.0 || cd < 0.0) {
    float wob = sin(vSea.x * 0.11 + vSea.y * 0.07) * 1.2 + sin(vSea.x * 0.031 - vSea.y * 0.047 + uTime * 0.3) * 1.8;
    float brk = 0.6 + 0.4 * sin(vSea.x * 0.37 + vSea.y * 0.29 + uTime * 0.5);
    float crest = smoothstep(0.955, 0.995, sin(cd * 0.55 + uTime * 1.25 + wob)) * near * brk;
    float run = sin(uTime * 1.25 + wob);
    float swash = smoothstep(-3.2, -2.2, cd) * (1.0 - smoothstep(-1.6 + run * 1.2, -0.6 + run * 1.2, cd)) * (0.35 + 0.3 * run);
    foam = clamp(crest * 0.55 + swash, 0.0, 0.8);
    base = mix(base, vec3(0.0152, 0.107, 0.133), near * 0.45);
  }
#endif
  vec3 n = normalize(vec3(sin(vSea.x * 0.21 + uTime * 0.9) * 0.06 + sin(vSea.y * 0.47 - uTime * 1.3) * 0.03, 1.0, sin(vSea.y * 0.19 + uTime * 0.7) * 0.06 + sin(vSea.x * 0.43 + uTime * 1.1) * 0.03));
  vec3 v = normalize(vView), l = normalize(vec3(-0.43, 0.86, 0.29));
  float spec = pow(max(dot(n, normalize(l + v)), 0.0), 90.0);
  float fres = pow(1.0 - max(v.y, 0.0), 3.0);
  vec3 col = base * vec3(0.68, 0.59, 0.49) * uLight + uEmissive + uSun * spec * 0.9 * uLight + vec3(0.04, 0.06, 0.08) * fres * uLight;
  col = mix(col, vec3(0.79, 0.89, 0.91) * (0.25 + 0.75 * uLight), foam) + vec3(0.013, 0.017, 0.02) * foam;
  gl_FragColor = vec4(col, mix(a, 0.97, foam));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
function waterMaterial(color, emissive, opacity, sea) {
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, fog: true, depthWrite: false, defines: sea ? { SEA: "" } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uColor: { value: new THREE.Color(color) }, uEmissive: { value: new THREE.Color(emissive) }, uSun: { value: new THREE.Color("#ffe2b8") },
      uOpacity: { value: opacity }, uShore: { value: sea?.tex || null }, uSize: { value: sea?.size || new THREE.Vector2() },
    }]),
  });
}
function seaMaterial(world, terrain) {
  const S = 4, tw = Math.ceil(world.w / S), th = Math.ceil(world.oh / S), data = new Uint8Array(tw * th * 4);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const cd = terrain.coast(i * S + S / 2, j * S + S / 2), k = (j * tw + i) * 4;
    data[k] = Math.max(0, Math.min(255, (cd + 8) * 4)); data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, tw, th, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return waterMaterial("#16465e", "#06202c", 0.9, { tex, size: new THREE.Vector2(tw * S, th * S) });
}
const shareWater = (m) => { m.uniforms.uTime = windUniform; m.uniforms.uLight = waterLight; return m; };

export function buildWater(world, terrain, scene) {
  const mat = shareWater(waterMaterial("#1d3a3f", "#0a1c20", 0.86));
  if (world.ox) {
    const E = 2500, sea = new THREE.Mesh(new THREE.PlaneGeometry(world.w + E * 2, world.oh - 2 + E), shareWater(seaMaterial(world, terrain)));
    sea.rotation.x = -Math.PI / 2; sea.position.set(world.w / 2, -0.55, (world.oh - 2 - E) / 2); scene.add(sea);
  }
  for (const s of world.streams) {
    const pos = [], idx = [];
    s.forEach(([x, z], i) => {
      const [x2, z2] = s[Math.min(s.length - 1, i + 1)], [x0, z0] = s[Math.max(0, i - 1)];
      const dx = x2 - x0, dz = z2 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 3.6, nz = dx / l * 3.6;
      pos.push(x + nx, -0.45, z + nz, x - nx, -0.45, z - nz);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    scene.add(m);
  }
  for (const l of world.lakes) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    m.rotation.x = -Math.PI / 2; m.scale.set(l.rx * 1.15, l.rz * 1.15, 1); m.position.set(l.x, -0.6, l.z);
    scene.add(m);
  }
  const plank = M("#5b4128"), rail = M("#3d2b1b");
  for (const b of world.bridges) {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 10), plank); deck.position.y = 0.25; g.add(deck);
    for (let i = -4; i <= 4; i += 1) { const p = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.9), rail); p.position.set(0, 0.42, i); g.add(p); }
    for (const sx of [-2.5, 2.5]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 10), rail); r.position.set(sx, 1.1, 0); g.add(r);
      for (let i = -5; i <= 5; i += 2.5) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), rail); post.position.set(sx, 0.6, i); g.add(post); }
    }
    g.position.set(b.x, terrain.height(b.x, b.z) * 0 + 0, b.z);
    g.rotation.y = -b.rot;
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    scene.add(g);
  }
}

export function plazaTexture(style) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1024;
  const ctx = cv.getContext("2d"), S = 1024 / 88;
  ctx.fillStyle = style === "semel" ? "#3a3631" : "#2c3430"; ctx.fillRect(0, 0, 1024, 1024);
  for (let j = 0; j < 88; j++) for (let i = 0; i < 88 + 1; i++) {
    const off = (j % 2) * 0.5, x = (i - off) * S, y = j * S;
    const l = 30 + Math.random() * 16;
    ctx.fillStyle = style === "semel" ? `hsl(${30 + Math.random() * 10},${8 + Math.random() * 8}%,${l + 12}%)` : `hsl(${140 + Math.random() * 40},${10 + Math.random() * 10}%,${l}%)`;
    const w = style === "semel" ? S : S * (0.8 + Math.random() * 0.4);
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, S - 2, 2); ctx.fill();
    if (style !== "semel" && Math.random() < 0.3) { ctx.fillStyle = "rgba(70,110,60,0.5)"; ctx.fillRect(x + Math.random() * S, y + Math.random() * S, 6, 6); }
  }
  const b0 = (22 - 16) * 2 * S, b1 = (22 + 16) * 2 * S;
  ctx.strokeStyle = style === "semel" ? "#c9a24e" : "#6fd0d8"; ctx.lineWidth = 10; ctx.globalAlpha = 0.8;
  ctx.strokeRect(b0, b0, b1 - b0, b1 - b0);
  ctx.lineWidth = 3; ctx.strokeRect(b0 + 12, b0 + 12, b1 - b0 - 24, b1 - b0 - 24);
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
