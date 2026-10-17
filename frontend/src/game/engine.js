import * as THREE from "three";
import { Terrain, buildVegetation, buildWater, windUniform, cutUniform } from "./world3d";
import { buildStructures, animateStructures } from "./structures";
import { buildMonster, buildNpc, buildPlayer, buildLoot, proxy, animateGlow, animateRig, setInvis, SHIMMER, RARITY } from "./models";
import { getState, setState } from "./store";
import { sfx } from "./audio";
import { setEnv } from "./rig/tex";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,0.6)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const sprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return s; };
const AB_COLOR = { arcane_bolt: "#7fb8ff", flame_burst: "#ff7a2a", aimed_shot: "#ffd36b", venom_arrow: "#7aff5a", power_strike: "#ffe0a0", cleave: "#ffc080", minor_heal: "#7aff9a", iron_guard: "#9ac8ff", quickstep: "#c8f0ff", whirlwind: "#ffc080", earthshatter: "#d8a060", frost_nova: "#a8e8ff", meteor_storm: "#ff5a1a", volley: "#ffd36b", multishot: "#ffe08a",
  agredi: "#7fb8ff", minor_mederi: "#7aff9a", minor_sanatio: "#c8ff7a", double_stab: "#ffe0a0", attack_run: "#ffb070", spin_attack: "#ffc080", multi_shot: "#ffe08a",
  arrow_barrage: "#ffd36b", ignis: "#ff6a1a", multi_vis_nex: "#a0d0ff", radius: "#e8f4ff", venenum: "#7aff5a", flamma_ventus: "#ff7a2a", tabes_viscera: "#a8ff5a",
  teuri: "#9ac8ff", velocitas: "#c8f0ff", robur: "#ffb060", contra_visus: "#c0a8ff", pergere_trans: "#c0a0ff", creare_porta: "#b080ff" };

export class Engine {
  constructor({ canvas, overlay, data, world, net, meId, quality }) {
    Object.assign(this, { canvas, overlay, data, world, net, meId });
    this.entities = new Map(); this.fxList = []; this.nums = []; this.hover = null; this.discovered = new Set(JSON.parse(localStorage.getItem(`sx_disc_${meId}`) || "[]"));
    this.yaw = 0; this.zoom = 19; this.camTarget = new THREE.Vector3(90, 0, 195); this.clock = new THREE.Clock();
    this.quality = quality || "high"; this.stepT = 0; this.lastRegion = ""; this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.mouseIn = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); setEnv(this.renderer);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === "high" ? 1.5 : 1));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color("#2a3631"); scene.fog = new THREE.FogExp2("#2a3631", 0.011);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 150);
    scene.add((this.hemi = new THREE.HemisphereLight("#b8cad4", "#4a3c26", 1.35)));
    this.waypoint = JSON.parse(localStorage.getItem(`sx_wp_${meId}`) || "null");
    this.wpBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: "#ffd36b", transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.wpBeam.visible = false; scene.add(this.wpBeam);
    this.lantern = new THREE.PointLight("#ffb070", 0, 30, 1.2); scene.add(this.lantern); this.cave = 0;
    const rim = (this.rim = new THREE.DirectionalLight("#8fb0ff", 0.6)); rim.position.set(60, 40, -80); scene.add(rim);
    const sun = (this.sun = new THREE.DirectionalLight("#ffe2b8", 3.0));
    sun.castShadow = true; const sz = this.quality === "high" ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 160 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    this.terrain = new Terrain(world);
    scene.add(this.terrain.buildMesh());
    buildVegetation(world, this.terrain, scene);
    buildWater(world, this.terrain, scene);
    this.animatedProps = buildStructures(world, this.terrain, scene);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.4, 20), new THREE.MeshBasicMaterial({ color: "#ffe08a", transparent: true, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; scene.add(this.marker);
    this.proxies = [];
    for (const [id, n] of Object.entries(data.npcs)) this.addEntity(id, "npc", { name: n.name, role: n.role, x: n.pos[0], z: n.pos[1], npcKind: n.kind, ambient: n.ambient });
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.bindInput(); this.resize();
    window.addEventListener("resize", this.resize);
    this.running = true; this.fpsAcc = []; this.loop();
  }
  dispose() { this.running = false; window.removeEventListener("resize", this.resize); this.unbind?.(); this.renderer.dispose(); this.overlay.innerHTML = ""; }
  resize = () => { const w = this.canvas.clientWidth, h = this.canvas.clientHeight; this.renderer.setSize(w, h, false); if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2); } this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
  groundY(x, z) {
    let h = this.terrain.height(x, z);
    for (const b of this.world.bridges) if (Math.hypot(b.x - x, b.z - z) < 5.5) h = Math.max(h, 0.42);
    return h;
  }

  // ---------- entities
  addEntity(id, kind, o) {
    let rig, r = 0.5, hgt = 1.9;
    if (kind === "monster") { rig = buildMonster(this.data.monsters[o.type]?.base || o.type); const md = this.data.monsters[o.type]; r = Math.max(0.6, md.radius); if (md.model_scale) rig.root.scale.multiplyScalar(md.model_scale); hgt = rig.height * (md.model_scale || 1); }
    else if (kind === "npc") rig = buildNpc(o.npcKind);
    else if (kind === "player") rig = buildPlayer(o.cls, o.eq, this.data.items);
    else { rig = { root: buildLoot(o.item, this.data.items[o.item]) }; r = 0.5; hgt = 0.6; }
    const grp = new THREE.Group(); grp.add(rig.root);
    const px = proxy(r, hgt, { kind, id }); grp.add(px); this.proxies.push(px);
    const e = { id, kind, rig, grp, px, x: o.x, z: o.z, tx: o.x, tz: o.z, rot: o.rot || 0, trot: o.rot || 0, anim: {}, ...o, height: hgt };
    grp.position.set(o.x, this.groundY(o.x, o.z), o.z);
    if (kind === "npc") { e.home = [o.x, o.z]; e.wanderT = 0; }
    this.scene.add(grp); this.entities.set(id, e);
    return e;
  }
  removeEntity(e) {
    this.scene.remove(e.grp); this.proxies = this.proxies.filter((p) => p !== e.px);
    if (e.plate) e.plate.remove();
    e.rig.dispose?.();
    this.entities.delete(e.id);
  }
  onSnapshot(s) {
    const seen = new Set();
    for (const [id, name, lv, cls, x, z, rot, mv, hp, mhp, eq, dead, ld, inv] of s.p) {
      seen.add(id);
      let e = this.entities.get(id);
      if (e && e.eq !== eq) { this.removeEntity(e); e = null; }
      if (!e) e = this.addEntity(id, "player", { name, level: lv, cls, x, z, rot, eq });
      Object.assign(e, { tx: x, tz: z, trot: rot, level: lv, hp, max: mhp, linkdead: ld }); setInvis(e.rig, !!inv);
      e.anim.moving = !!mv; e.anim.dead = !!dead;
    }
    for (const [id, type, x, z, rot, st, hp, mhp, aggro] of s.m) {
      seen.add(id);
      let e = this.entities.get(id);
      if (e && e.anim.dead && st !== 2) { this.removeEntity(e); e = null; }
      if (!e) e = this.addEntity(id, "monster", { type, name: this.data.monsters[type].name, level: this.data.monsters[type].level, x, z, rot });
      Object.assign(e, { tx: x, tz: z, trot: rot, hp, max: mhp, aggro });
      e.anim.moving = st === 1; e.anim.dead = st === 2;
    }
    for (const [id, item, qty, x, z, mine, pname] of s.l) {
      seen.add(id);
      let e = this.entities.get(id);
      if (!e) e = this.addEntity(id, "loot", { item, qty, x, z, mine, name: pname || this.data.items[item].name });
      e.mine = mine;
    }
    for (const [id, x, z, owner, rem] of s.g || []) {
      seen.add(id);
      const g = this.entities.get(id) || this.addGate(id, x, z, owner);
      g.endAt = performance.now() / 1000 + rem;
      if (!g.total) g.total = Math.max(rem, 1);
    }
    for (const e of [...this.entities.values()]) if (e.kind !== "npc" && !seen.has(e.id)) {
      if (e.kind === "loot" && e.picked !== true) this.puff(e.x, e.z, RARITY[this.data.items[e.item].rarity] || "#fff");
      this.removeEntity(e);
    }
    const [mx, mz, hp, mp, tgt] = s.me;
    this.me = { x: mx, z: mz };
    const st = getState();
    const t = tgt && this.entities.get(tgt);
    const target = t ? { id: tgt, type: t.type, name: t.name, level: t.level, hp: t.hp, max: t.max } : null;
    const patch = {};
    if (hp !== st.hp || mp !== st.mp) Object.assign(patch, { hp, mp });
    const ot = st.target;
    if (!!ot !== !!target || (target && (ot.id !== target.id || ot.hp !== target.hp))) patch.target = target;
    if (Object.keys(patch).length) setState(patch);
    this.targetId = tgt;
  }
  onFx(f) {
    const src = f.src && this.entities.get(f.src), tgt = f.tgt && this.entities.get(f.tgt);
    const near = (e) => e && this.me && Math.hypot(e.x - this.me.x, e.z - this.me.z) < 30;
    switch (f.k) {
      case "attack": case "mattack":
        if (src) { src.anim.atk = 1; if (f.style !== "melee") src.anim.cast = 0; }
        if (src && tgt && f.style !== "melee") this.projectile(src, tgt, f.style === "arrow" ? "#e8d8b0" : f.style === "spell" ? "#b05cff" : "#7fb8ff", f.style === "arrow");
        if (near(src)) sfx(f.style === "melee" ? "swing" : f.style === "arrow" ? "bow" : "zap");
        if (f.miss && tgt) this.number(tgt, "miss", "#bbb");
        break;
      case "dmg": if (tgt) { tgt.anim.hurt = 1; tgt.lastHit = performance.now(); this.number(tgt, f.v, f.crit ? "#ffcf3a" : f.dt === "poison" ? "#8aff5a" : f.dt === "magic" ? "#9ac8ff" : "#fff", f.crit); if (near(tgt)) sfx(f.crit ? "crit" : "hit"); } break;
      case "pdmg": if (tgt) { tgt.anim.hurt = 1; this.number(tgt, f.v, "#ff5040"); if (f.tgt === this.meId) { sfx("hurt"); this.shake = 0.25; } } break;
      case "death": if (tgt) { tgt.anim.dead = true; if (near(tgt)) sfx("mdeath"); } break;
      case "pdeath": if (tgt) tgt.anim.dead = true; if (f.tgt === this.meId) sfx("death"); break;
      case "heal": if (tgt) { this.burst(tgt, "#7aff9a", 14, 1.4); if (f.v) this.number(tgt, `+${f.v}`, "#7aff9a"); if (near(tgt)) sfx("heal"); } break;
      case "levelup": if (src) { this.pillar(src); sfx("levelup"); } break;
      case "slam": if (src) { this.shock(src.x, src.z, "#b060ff", f.r); this.shock(src.x, src.z, "#ff6a3a", f.r * 0.6); src.anim.atk = 1; if (near(src)) { sfx("heavy"); this.shake = 0.4; } } break;
      case "rot": if (tgt) this.rotCloud(tgt); break;
      case "cast": if (src) this.castFx(src, tgt || (f.x != null ? { x: f.x, z: f.z, height: 0 } : null), f.ab); break;
      default:
    }
  }
  addGate(id, x, z, owner) {
    const root = new THREE.Group(), c = "#b080ff";
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 40), new THREE.MeshBasicMaterial({ color: c }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: "#6a30d0", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const swirl = new THREE.Group(); swirl.add(ring, disc); swirl.position.y = 1.2; root.add(swirl);
    const base = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.2, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    base.rotation.x = -Math.PI / 2; base.position.y = 0.05; root.add(base);
    const timer = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.1, 48), new THREE.MeshBasicMaterial({ color: "#e0c8ff", transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    timer.rotation.x = -Math.PI / 2; timer.position.y = 0.07; root.add(timer);
    const gl = sprite(c, 3); gl.position.y = 1.2; root.add(gl);
    root.position.set(x, this.groundY(x, z), z); this.scene.add(root);
    const e = { id, kind: "gate", name: `Portal (${owner})`, x, z, tx: x, tz: z, rot: 0, trot: 0, anim: {}, grp: root, rig: { root, height: 2.4, gate: swirl, disc, timer }, hp: 0, max: 0 };
    this.entities.set(id, e); this.shock(x, z, c, 3); sfx("spell");
    return e;
  }
  castFx(src, tgt, ab) {
    const c = AB_COLOR[ab] || "#fff";
    const melee = ["power_strike", "cleave", "whirlwind", "earthshatter", "double_stab", "attack_run", "spin_attack"].includes(ab);
    src.anim.cast = melee ? 0 : 1;
    if (melee) src.anim.atk = 1;
    if (Math.hypot(src.x - (this.me?.x || 0), src.z - (this.me?.z || 0)) < 30) sfx(melee ? "heavy" : ab === "minor_heal" ? "heal" : "spell");
    if (ab === "whirlwind") { this.shock(src.x, src.z, c, 6); this.shock(src.x, src.z, "#fff0d0", 3.5); }
    if (ab === "frost_nova") { this.shock(src.x, src.z, c, 7); this.burst(src, c, 30, 3); }
    if (ab === "earthshatter" && tgt) { this.shock(tgt.x, tgt.z, c, 6); if (src.id === this.meId) this.shake = 0.35; }
    if (ab === "meteor_storm" && tgt) { for (let i = 0; i < 3; i++) setTimeout(() => this.projectile(src, tgt, c, false, 1.3, () => this.shock(tgt.x + (Math.random() - 0.5) * 4, tgt.z + (Math.random() - 0.5) * 4, c, 7)), i * 140); }
    if (ab === "volley" && tgt) { for (let i = 0; i < 4; i++) setTimeout(() => this.projectile(src, tgt, c, true, 1), i * 90); this.shock(tgt.x, tgt.z, c, 6); }
    if (ab === "arcane_bolt" && tgt) this.projectile(src, tgt, c, false, 0.9);
    if ((ab === "aimed_shot" || ab === "venom_arrow") && tgt) this.projectile(src, tgt, c, true, 1);
    if (ab === "flame_burst" && tgt) { this.projectile(src, tgt, c, false, 1.1, () => this.shock(tgt.x, tgt.z, c, 4.5)); }
    if (ab === "cleave") this.shock(src.x, src.z, c, 4);
    if (ab === "power_strike" && tgt) { this.shock(tgt.x, tgt.z, c, 1.6); if (src.id === this.meId) this.shake = 0.2; }
    if (ab === "iron_guard") this.aura(src, c, 10);
    if (ab === "quickstep") this.aura(src, c, 5);
    if (ab === "minor_heal" || ab === "minor_mederi") this.burst(src, c, 20, 2);
    if (ab === "minor_sanatio") { this.burst(src, c, 16, 1.5); this.aura(src, c, 2); }
    if (ab === "attack_run" && !tgt) { this.shock(src.x, src.z, c, 1.8); if (src.id === this.meId) this.shake = 0.08; }
    if ((ab === "double_stab" || ab === "attack_run") && tgt) { this.shock(tgt.x, tgt.z, c, 1.4); if (src.id === this.meId) this.shake = 0.15; }
    if (ab === "spin_attack") { this.shock(src.x, src.z, c, 5); this.shock(src.x, src.z, "#fff0d0", 3); }
    if ((ab === "multi_shot" || ab === "arrow_barrage") && tgt) this.projectile(src, tgt, c, true, 1);
    if (ab === "agredi" && tgt) this.projectile(src, tgt, c, false, 0.9);
    if (ab === "ignis" && tgt) this.projectile(src, tgt, c, false, 1.3, () => this.shock(tgt.x, tgt.z, c, 2.5));
    if (ab === "multi_vis_nex" && tgt) this.projectile(src, tgt, c, false, 0.8, () => this.puff(tgt.x, tgt.z, c));
    if (ab === "radius" && tgt) this.beam(src, tgt, c);
    if (ab === "venenum" && tgt) this.projectile(src, tgt, c, false, 0.7, () => this.burst(tgt, c, 10, 1));
    if (ab === "flamma_ventus" && tgt) this.cone(src, tgt, c);
    if (ab === "tabes_viscera") this.aura(src, "#c01818", 2);
    if (["teuri", "velocitas", "robur", "contra_visus"].includes(ab)) { this.aura(src, c, 3); this.burst(src, c, 14, 2); }
    if (ab === "pergere_trans") { this.burst(src, c, 18, 2); this.shock(src.x, src.z, c, 2); }
    if (ab === "creare_porta" && tgt) this.shock(tgt.x, tgt.z, c, 2.5);
  }
  rotCloud(e) {
    const top = () => this.groundY(e.x, e.z) + (e.height || 1.5) + 0.6;
    for (let i = 0; i < 9; i++) {
      const s = sprite(i % 3 ? "#b01010" : "#5a0606", 0.9 + Math.random() * 0.6), ox = (Math.random() - 0.5) * 1.1, oz = (Math.random() - 0.5) * 1.1, oy = Math.random() * 0.35, ph = Math.random() * 6;
      s.material.blending = THREE.NormalBlending;
      this.addFx(s, 2.2, (t) => { s.position.set(e.x + ox + Math.sin(t * 5 + ph) * 0.12, top() + oy, e.z + oz); s.material.opacity = Math.min(1, t * 6) * (1 - t) * 0.9; s.scale.setScalar((0.8 + t * 0.8) * (1.2 + Math.sin(t * 9 + ph) * 0.1)); });
    }
    for (let i = 0; i < 14; i++) {
      const d = sprite("#d01c1c", 0.18), ox = (Math.random() - 0.5) * 0.9, oz = (Math.random() - 0.5) * 0.9, dl = Math.random() * 1.4;
      this.addFx(d, 2.2, (t) => { const k = Math.max(0, (t * 2.2 - dl) / 0.8); d.visible = k > 0 && k < 1; d.position.set(e.x + ox, top() - k * ((e.height || 1.5) + 0.6), e.z + oz); d.material.opacity = 1 - k; });
    }
  }
  beam(src, tgt, color) {
    const a = new THREE.Vector3(src.x, this.groundY(src.x, src.z) + 1.3, src.z), b = new THREE.Vector3(tgt.x, this.groundY(tgt.x, tgt.z) + (tgt.height || 1) * 0.55, tgt.z);
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.addFx(m, 0.35, (t) => { m.material.opacity = 1 - t; m.scale.set(1 + t * 2, 1, 1 + t * 2); });
  }
  cone(src, tgt, color) {
    const ang = Math.atan2(tgt.x - src.x, tgt.z - src.z);
    for (let i = 0; i < 18; i++) {
      const s = sprite(i % 3 ? color : "#ffd080", 0.9), a = ang + (Math.random() - 0.5) * 1.3, sp = 0.6 + Math.random() * 0.4;
      this.addFx(s, 0.6, (t) => { const r = t * 10 * sp; s.position.set(src.x + Math.sin(a) * r, this.groundY(src.x, src.z) + 1 + t * 0.5, src.z + Math.cos(a) * r); s.material.opacity = 1 - t; s.scale.setScalar(0.6 + t * 2); });
    }
  }

  // ---------- effects
  addFx(obj, dur, upd, done) { this.scene.add(obj); this.fxList.push({ obj, t: 0, dur, upd, done }); }
  projectile(src, tgt, color, arrow, size = 0.6, done) {
    const o = new THREE.Group();
    if (arrow) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.8), new THREE.MeshBasicMaterial({ color })); o.add(a); o.add(sprite(color, 0.5)); }
    else { o.add(sprite(color, size * 1.6)); o.add(new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.25, 1), new THREE.MeshBasicMaterial({ color: "#fff" }))); }
    const from = new THREE.Vector3(src.x, this.groundY(src.x, src.z) + 1.3, src.z);
    const d = Math.hypot(tgt.x - src.x, tgt.z - src.z);
    this.addFx(o, Math.max(0.12, d / (arrow ? 38 : 26)), (t) => {
      const to = new THREE.Vector3(tgt.x, this.groundY(tgt.x, tgt.z) + tgt.height * 0.55, tgt.z);
      o.position.lerpVectors(from, to, t); o.position.y += Math.sin(t * Math.PI) * (arrow ? 0.6 : 0.3); o.lookAt(to);
    }, done);
  }
  shock(x, z, color, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, this.groundY(x, z) + 0.15, z);
    const fl = sprite(color, r * 1.4); fl.position.set(x, this.groundY(x, z) + 0.8, z);
    this.addFx(fl, 0.5, (t) => { fl.material.opacity = 1 - t; fl.scale.setScalar(r * (1 + t)); });
    this.addFx(m, 0.55, (t) => { m.scale.setScalar(0.3 + t * r); m.material.opacity = 1 - t; });
  }
  burst(e, color, n, up) {
    for (let i = 0; i < n; i++) {
      const s = sprite(color, 0.35), a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.6;
      this.addFx(s, 0.9 + Math.random() * 0.5, (t) => { s.position.set(e.x + Math.cos(a + t * 3) * r, this.groundY(e.x, e.z) + t * up * 1.6, e.z + Math.sin(a + t * 3) * r); s.material.opacity = 1 - t; });
    }
  }
  puff(x, z, color) { const s = sprite(color, 0.8); s.position.set(x, this.groundY(x, z) + 0.4, z); this.addFx(s, 0.4, (t) => { s.scale.setScalar(0.8 + t * 1.5); s.material.opacity = 1 - t; }); }
  aura(e, color, dur) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.addFx(m, dur, (t, now) => { m.position.set(e.x, this.groundY(e.x, e.z) + 1.1, e.z); m.rotation.y = now * 2; m.material.opacity = 0.22 * (1 - t * 0.5) + Math.sin(now * 6) * 0.05; });
  }
  pillar(e) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#ffd36b", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.addFx(m, 2.2, (t) => { m.position.set(e.x, this.groundY(e.x, e.z) + 7, e.z); m.scale.set(1 + t, 1, 1 + t); m.material.opacity = 0.7 * (1 - t); });
    this.shock(e.x, e.z, "#ffd36b", 5); this.burst(e, "#ffe9a0", 30, 3);
  }
  number(e, v, color, big) {
    const el = document.createElement("div");
    el.className = "dmg-num" + (big ? " crit" : ""); el.textContent = v; el.style.color = color;
    this.overlay.appendChild(el);
    this.nums.push({ el, e, x: e.x, z: e.z, t: 0, off: (Math.random() - 0.5) * 30 });
  }

  // ---------- input
  pick(ev) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.proxies, false);
    const pri = { monster: 0, loot: 1, npc: 2, player: 3 };
    const list = hits.map((h) => this.entities.get(h.object.userData.id)).filter((e) => e && !(e.kind === "monster" && e.anim.dead) && e.id !== this.meId);
    list.sort((a, b) => pri[a.kind] - pri[b.kind]);
    return list[0] || null;
  }
  pointerGround() {
    if (!this.lastMove) return null;
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((this.lastMove.clientX - r.left) / r.width) * 2 - 1, -((this.lastMove.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    return this.groundPoint();
  }
  groundPoint() {
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let h = 0, p = null;
    for (let i = 0; i < 4; i++) { const t = (h - o.y) / d.y; if (t < 0) return null; p = o.clone().addScaledVector(d, t); h = this.groundY(p.x, p.z); }
    return p;
  }
  bindInput() {
    const c = this.canvas;
    const down = (ev) => {
      setState({ ctx: null });
      if (ev.button === 1) { this.drag = { x: ev.clientX, yaw: this.yaw }; ev.preventDefault(); return; }
      if (ev.button !== 0) return;
      sfx.unlock?.();
      if (this.placing) { const gp = this.pointerGround(); const cb = this.placing; this.placing = null; if (gp) cb(gp); return; }
      const e = this.pick(ev);
      if (e?.kind === "monster") { this.net.send({ t: "target", id: e.id }); sfx("click"); return; }
      if (e?.kind === "loot") { this.net.send({ t: "pickup", id: e.id }); return; }
      if (e?.kind === "npc" && !e.ambient) { this.net.send({ t: "npc", id: e.id }); return; }
      const p = this.groundPoint();
      if (p) { this.net.send({ t: "move", x: +p.x.toFixed(2), z: +p.z.toFixed(2) }); }
      this.hold = { t0: performance.now(), last: performance.now(), dir: false };
    };
    const ctx = (ev) => {
      ev.preventDefault();
      const e = this.pick(ev);
      if (!e) return;
      if (e.kind === "npc") { if (e.ambient) setState({ ctx: { x: ev.clientX, y: ev.clientY, kind: "npcinfo", id: e.id, name: e.name, role: e.role } }); else this.net.send({ t: "npc", id: e.id }); }
      else if (e.kind === "player") setState({ ctx: { x: ev.clientX, y: ev.clientY, kind: "player", id: e.id, name: e.name, level: e.level, cls: e.cls } });
      else if (e.kind === "monster") setState({ ctx: { x: ev.clientX, y: ev.clientY, kind: "monster", id: e.id, name: e.name, level: e.level, type: e.type } });
    };
    const move = (ev) => {
      this.mouseIn = true; this.lastMove = ev;
      if (this.drag) this.yaw = this.drag.yaw + (ev.clientX - this.drag.x) * 0.006;
    };
    const up = (ev) => {
      this.drag = null;
      if (ev.button === 0 && this.hold) { if (this.hold.dir) this.net.send({ t: "stop" }); this.hold = null; }
    };
    const wheel = (ev) => { this.zoom = Math.max(14, Math.min(48, this.zoom + Math.sign(ev.deltaY) * 2.5)); };
    c.addEventListener("mousedown", down); c.addEventListener("contextmenu", ctx); c.addEventListener("mousemove", move); window.addEventListener("mouseup", up); c.addEventListener("wheel", wheel, { passive: true });
    c.addEventListener("mouseleave", () => { this.mouseIn = false; });
    this.unbind = () => { window.removeEventListener("mouseup", up); };
  }
  updateHover() {
    if (!this.lastMove || !this.mouseIn) { if (this.hover) { this.hover = null; } return; }
    const e = this.pick(this.lastMove);
    this.hover = e;
    
  }

  // ---------- nameplates
  plate(e) {
    if (!e.plate) {
      const el = document.createElement("div");
      el.className = `plate plate-${e.kind}`;
      el.innerHTML = `<div class="plate-name"></div><div class="plate-sub"></div><div class="plate-hp"><i></i></div>`;
      this.overlay.appendChild(el); e.plate = el; e.plateName = el.children[0]; e.plateSub = el.children[1]; e.plateHp = el.children[2]; e.plateBar = el.children[2].firstChild;
    }
    return e.plate;
  }
  updatePlates(now) {
    const v = new THREE.Vector3(), W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    for (const e of this.entities.values()) {
      const d = this.me ? Math.hypot(e.x - this.me.x, e.z - this.me.z) : 99;
      const hovered = this.hover === e, targeted = this.targetId === e.id;
      let show = false, name = e.name, sub = "", hp = null;
      if (e.kind === "player") { show = d < 45; name = `${e.name}${e.linkdead ? " (linkdead)" : ""}`; sub = `Lv ${e.level} ${e.cls}`; if (e.id !== this.meId && e.hp < e.max) hp = e.hp / e.max; }
      else if (e.kind === "monster") { show = !e.anim.dead && (hovered || targeted || e.aggro || (e.lastHit && now - e.lastHit < 5000)); sub = `Lv ${e.level}`; hp = e.hp / e.max; }
      else if (e.kind === "npc") { show = hovered || (!e.ambient && d < 18); sub = hovered ? e.role : ""; }
      else if (e.kind === "gate") { show = d < 25; }
      else { const rar = this.data.items[e.item].rarity; show = hovered || (rar !== "common" && d < 14); name = e.qty > 1 ? `${e.name} ×${e.qty}` : e.name; }
      if (!show) { if (e.plate) e.plate.style.display = "none"; continue; }
      v.set(e.x, e.grp.position.y + e.height + 0.35, e.z).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { if (e.plate) e.plate.style.display = "none"; continue; }
      const el = this.plate(e);
      el.style.display = "block";
      el.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%)`;
      if (e._n !== name) { e.plateName.textContent = name; e._n = name; }
      if (e._s !== sub) { e.plateSub.textContent = sub; e._s = sub; }
      if (e.kind === "loot") e.plateName.style.color = RARITY[this.data.items[e.item].rarity];
      el.classList.toggle("is-target", targeted); el.classList.toggle("is-hover", hovered);
      e.plateHp.style.display = hp === null ? "none" : "block";
      if (hp !== null) e.plateBar.style.width = `${Math.max(0, hp * 100)}%`;
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += this.dt;
      if (n.t > 1.1) { n.el.remove(); this.nums.splice(i, 1); continue; }
      v.set(n.x, this.groundY(n.x, n.z) + 2.2 + n.t * 1.4, n.z).project(this.camera);
      n.el.style.transform = `translate(${((v.x + 1) / 2) * W + n.off}px, ${((1 - v.y) / 2) * H}px) translate(-50%,-50%) scale(${n.t < 0.12 ? 1.5 - n.t * 4 : 1})`;
      n.el.style.opacity = n.t > 0.7 ? 1 - (n.t - 0.7) / 0.4 : 1;
    }
  }

  // ---------- main loop
  dungeonAt(x) { return (this.world.dungeons || []).find((d) => x >= d.x0 - 20 && x <= d.x0 + d.w + 20); }
  regionAt(x, z) {
    let best = null;
    for (const r of this.world.regions) { const d = Math.hypot(r.x - x, r.z - z); if (d < r.r && (!best || d / r.r < best.k)) best = { r, k: d / r.r }; }
    if (best) return best.r.name;
    if (z > this.world.oh) return this.dungeonAt(x)?.name || "The Hollow Deep";
    const rd = this.terrain.sample(this.terrain.RD, x, z);
    if (x < 330) return rd < 6 ? "Titus Forest Road" : "Westwood";
    if (x < 700) return rd < 6 ? "The Long Road" : "Shadowpine Deep";
    if (x > 1110) return rd < 6 ? "Marches Road" : "The Sundered Marches";
    return rd < 6 ? "Elderglen Road" : "Mossveil Wilds";
  }
  loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = (this.dt = Math.min(0.05, this.clock.getDelta())), now = performance.now(), t = this.clock.elapsedTime;
    windUniform.value = t;
    const k = Math.min(1, dt * 10);
    for (const e of this.entities.values()) {
      if (e.kind === "npc" && e.ambient) this.wander(e, dt);
      const dx = e.tx - e.x, dz = e.tz - e.z;
      if (Math.hypot(dx, dz) > 8) { e.x = e.tx; e.z = e.tz; } else { e.x += dx * k; e.z += dz * k; }
      let dr = e.trot - e.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); e.rot += dr * Math.min(1, dt * 12);
      e.grp.position.set(e.x, this.groundY(e.x, e.z), e.z);
      if (e.rig.gate) { const f = Math.max(0.02, Math.min(1, (e.endAt - performance.now() / 1000) / (e.total || 10))); e.rig.timer.scale.setScalar(f); e.rig.timer.material.color.set(f < 0.3 ? "#ff5a5a" : "#e0c8ff"); e.rig.gate.rotation.y = this.yaw || 0; e.rig.disc.rotation.z = t * 2; e.rig.disc.material.opacity = 0.4 + 0.2 * Math.sin(t * 4); continue; }
      if (e.rig.body) { if (e.rig.invisOn) SHIMMER.uniforms.uTime.value = t; e.rig.root.rotation.y = e.rot; animateRig(e.rig, e.anim, dt, t); if (e.rig.shimmer) animateGlow(e.rig, t); }
      else if (e.kind === "npc") { if (e.rig.kind === "prop" && e.npcKind !== "trunk") e.rig.root.rotation.y = t * 0.3; }
      else { e.rig.root.rotation.y = t * 1.2; e.rig.root.position.y = 0.05 + Math.sin(t * 2.5 + e.x) * 0.05; }
    }
    const me = this.entities.get(this.meId);
    if (me) {
      const mp = new THREE.Vector3(me.x, me.grp.position.y, me.z);
      if (this.camTarget.distanceTo(mp) > 25) this.camTarget.copy(mp); else this.camTarget.lerp(mp, Math.min(1, dt * 8));
      cutUniform.value.set(me.x, me.grp.position.y, me.z);
      if (me.anim.moving) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.36; sfx("step"); } }
      const cx = Math.floor(me.x / 20), cz = Math.floor(me.z / 20);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const key = `${cx + i},${cz + j}`; if (!this.discovered.has(key)) { this.discovered.add(key); this.discDirty = true; } }
      const reg = this.regionAt(me.x, me.z);
      if (reg !== this.lastRegion) { this.lastRegion = reg; setState({ region: reg }); }
      const wp = this.waypoint;
      if (wp && Math.hypot(wp.x - me.x, wp.z - me.z) < 4) { this.setWaypoint(null); sfx("loot"); }
      this.wpBeam.visible = !!wp;
      if (wp) this.wpBeam.position.set(wp.x, this.groundY(wp.x, wp.z) + 20, wp.z);
      this.cave += ((me.z > this.world.oh ? 1 : 0) - this.cave) * Math.min(1, dt * 3);
      const k = this.cave;
      this.hemi.intensity = 1.35 - k * 1.0; this.sun.intensity = 3.0 - k * 2.6; this.rim.intensity = 0.6 - k * 0.45;
      this.scene.fog.density = 0.011 + k * 0.022; this.scene.fog.color.setRGB(0.165 * (1 - k) + 0.035 * k, 0.212 * (1 - k) + 0.035 * k, 0.192 * (1 - k) + 0.05 * k); this.scene.background.copy(this.scene.fog.color);
      this.lantern.intensity = k * 45; this.lantern.position.set(me.x, me.grp.position.y + 4, me.z + 1);
    }
    const pitch = 0.95, sh = this.shake > 0 ? (this.shake -= dt) * 0.6 : 0;
    const ct = this.camTarget;
    this.camera.position.set(ct.x + Math.sin(this.yaw) * Math.cos(pitch) * this.zoom + (Math.random() - 0.5) * sh, ct.y + Math.sin(pitch) * this.zoom, ct.z + Math.cos(this.yaw) * Math.cos(pitch) * this.zoom + (Math.random() - 0.5) * sh);
    this.camera.lookAt(ct.x, ct.y + 1, ct.z);
    this.sun.position.set(ct.x - 30, ct.y + 60, ct.z + 20); this.sun.target.position.copy(ct);
    const tgt = this.targetId && this.entities.get(this.targetId);
    this.ring.visible = !!tgt;
    if (tgt) { this.ring.position.set(tgt.x, tgt.grp.position.y + 0.06, tgt.z); this.ring.scale.setScalar(Math.max(0.8, tgt.px.geometry.parameters.radiusTop) * (1 + Math.sin(t * 5) * 0.05)); }
    if (this.marker.visible) { this.markerT += dt; this.marker.scale.setScalar(1 + this.markerT * 2); this.marker.material.opacity = 1 - this.markerT * 1.6; if (this.markerT > 0.6) this.marker.visible = false; }
    for (let i = this.fxList.length - 1; i >= 0; i--) {
      const f = this.fxList[i]; f.t += dt;
      const p = Math.min(1, f.t / f.dur); f.upd(p, t);
      if (p >= 1) { this.scene.remove(f.obj); this.fxList.splice(i, 1); f.done && f.done(); }
    }
    animateStructures(this.animatedProps, t);
    this.updateHover();
    this.holdWalk(now);
    if (this.quality === "low") this.renderer.render(this.scene, this.camera); else this.composer.render();
    this.updatePlates(now);
    this.fpsAcc.push(dt);
    if (this.fpsAcc.length >= 60) { const fps = Math.round(60 / this.fpsAcc.reduce((a, b) => a + b, 0)); this.fpsAcc = []; setState({ fps }); this.slow = fps < 24 ? (this.slow || 0) + 1 : 0; if (this.slow >= 2 && this.quality !== "low") { this.setQuality(this.quality === "high" ? "medium" : "low"); this.slow = 0; } if (this.discDirty) { this.discDirty = false; localStorage.setItem(`sx_disc_${this.meId}`, JSON.stringify([...this.discovered])); } }
  };
  holdWalk(now) {
    const h = this.hold, me = this.entities.get(this.meId);
    if (!h || !me || !this.lastMove || now - h.t0 < 220 || now - h.last < 150) return;
    h.last = now; h.dir = true;
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((this.lastMove.clientX - r.left) / r.width) * 2 - 1, -((this.lastMove.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const p = this.groundPoint();
    if (!p) return;
    const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
    if (d < 0.6) return;
    const x = me.x + (dx / d) * 7, z = me.z + (dz / d) * 7;
    this.net.send({ t: "move", x: +x.toFixed(2), z: +z.toFixed(2), hold: 1 });
  }
  wander(e, dt) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 4 + Math.random() * 6;
      const a = Math.random() * 6.28, r = Math.random() * 6;
      const nx = e.home[0] + Math.cos(a) * r, nz = e.home[1] + Math.sin(a) * r;
      if (!this.terrain.blocked(nx, nz)) e.goal = [nx, nz];
    }
    if (e.goal) {
      const dx = e.goal[0] - e.tx, dz = e.goal[1] - e.tz, d = Math.hypot(dx, dz);
      if (d < 0.1) { e.goal = null; e.anim.moving = false; return; }
      const s = Math.min(d, 1.4 * dt), nx = e.tx + (dx / d) * s, nz = e.tz + (dz / d) * s;
      if (this.terrain.blocked(nx, nz)) { e.goal = null; e.anim.moving = false; return; }
      e.tx = nx; e.tz = nz; e.trot = Math.atan2(dx, dz); e.anim.moving = true;
    }
  }
  setQuality(q) { this.quality = q; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "high" ? 1.5 : q === "medium" ? 1 : 0.7)); this.renderer.shadowMap.enabled = q !== "low"; this.sun.castShadow = q !== "low"; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); this.resize(); }

  // ---------- map rendering
  setWaypoint(wp) {
    this.waypoint = wp; localStorage.setItem(`sx_wp_${this.meId}`, JSON.stringify(wp));
  }
  mapToWorld(px, pz) {
    const t = this._mapT; if (!t) return null;
    const ir = this._inset;
    for (const r of ir || []) if (px >= r.x && px <= r.x + r.w && pz >= r.y && pz <= r.y + r.h) return { x: r.d.x0 + (px - r.x) / r.s, z: r.d.z0 + (pz - r.y) / r.s };
    return { x: t.sx + px / t.scale, z: t.sz + pz / t.scale };
  }
  drawMap(ctx, w, h, opts = {}) {
    const W = this.world.w, H = this.world.h, src = this.terrain.mapCanvas;
    const me = this.me || { x: 90, z: 200 };
    let sx = 0, sz = 0, sw = W, shh = H;
    if (opts.radius) { sw = shh = opts.radius * 2; sx = me.x - opts.radius; sz = me.z - opts.radius; }
    else if (me.z > this.world.oh) { const d = this.dungeonAt(me.x) || { x0: 370, z0: 452, w: 380 }; sx = d.x0; sz = d.z0; sw = d.w; shh = d.w * h / w; }
    else shh = this.world.oh;
    const scale = w / sw;
    if (!opts.radius) { this._mapT = { sx, sz, scale }; this._inset = null; }
    ctx.fillStyle = "#0b0d0c"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, sx * 2, sz * 2, sw * 2, shh * 2, 0, 0, w, h);
    const P = (x, z) => [(x - sx) * scale, (z - sz) * scale];
    ctx.fillStyle = "rgba(12,22,14,0.5)";
    if (!opts.radius) for (const [x, z] of this.world.trees) { if (Math.random() < 0.35) { const [px, pz] = P(x, z); ctx.fillRect(px, pz, 1.2, 1.2); } }
    ctx.fillStyle = "#3f6a7a";
    for (const l of this.world.lakes) { const [px, pz] = P(l.x, l.z); ctx.beginPath(); ctx.ellipse(px, pz, l.rx * scale, l.rz * scale, 0, 0, 6.28); ctx.fill(); }
    ctx.strokeStyle = "#3f6a7a"; ctx.lineWidth = Math.max(1.5, 4 * scale);
    for (const s of this.world.streams) { ctx.beginPath(); s.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }); ctx.stroke(); }
    ctx.strokeStyle = "#a88a5a"; ctx.lineWidth = Math.max(1.2, 3 * scale);
    for (const path of [this.world.main_road, ...this.world.paths.map((p) => p.pts)]) { ctx.beginPath(); path.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }); ctx.stroke(); }
    ctx.fillStyle = "#8a7a62";
    for (const b of this.world.buildings) { const [px, pz] = P(b.x - b.w / 2, b.z - b.d / 2); ctx.fillRect(px, pz, b.w * scale, b.d * scale); }
    for (const s of this.world.safe_zones) { const [px, pz] = P(s.x - s.half, s.z - s.half); ctx.strokeStyle = "#e6c46a"; ctx.lineWidth = 1.5; ctx.strokeRect(px, pz, s.half * 2 * scale, s.half * 2 * scale); }
    if (!opts.radius || opts.fog) {
      ctx.fillStyle = "rgba(6,7,6,0.88)";
      const cs = 20 * scale;
      for (let i = Math.floor(sx / 20); i <= Math.ceil((sx + sw) / 20); i++) for (let j = Math.floor(sz / 20); j <= Math.ceil((sz + shh) / 20); j++) if (!this.discovered.has(`${i},${j}`)) { const [px, pz] = P(i * 20, j * 20); ctx.fillRect(px - 0.5, pz - 0.5, cs + 1, cs + 1); }
    }
    const dot = (x, z, c, r) => { const [px, pz] = P(x, z); if (px < -5 || pz < -5 || px > w + 5 || pz > h + 5) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, pz, r, 0, 6.28); ctx.fill(); };
    for (const e of this.entities.values()) {
      if (e.kind === "npc" && !e.ambient) dot(e.x, e.z, this.data.npcs[e.id].merchant ? "#ffd23a" : this.data.npcs[e.id].healer ? "#7aff9a" : "#e0e0ff", opts.radius ? 3 : 2);
      else if (e.kind === "monster" && opts.radius && !e.anim.dead) dot(e.x, e.z, "#e04030", 2.2);
      else if (e.kind === "player" && e.id !== this.meId) dot(e.x, e.z, "#5ab0ff", 3);
      else if (e.kind === "gate") dot(e.x, e.z, "#b080ff", 3.5);
      else if (e.kind === "loot" && opts.radius) dot(e.x, e.z, RARITY[this.data.items[e.item].rarity], 1.6);
    }
    if (!opts.radius) {
      ctx.font = "600 13px 'IM Fell English SC', serif"; ctx.textAlign = "center";
      for (const r of this.world.regions) {
        const key = `${Math.floor(r.x / 20)},${Math.floor(r.z / 20)}`;
        if (!this.discovered.has(key)) continue;
        const [px, pz] = P(r.x, r.z);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(r.name, px + 1, pz + 1); ctx.fillStyle = r.lvl === "Safe town" ? "#ffe08a" : "#e8dcc0"; ctx.fillText(r.name, px, pz);
        ctx.font = "11px 'Alegreya Sans', sans-serif"; ctx.fillStyle = "#b8a888"; ctx.fillText(r.lvl === "-" ? "" : `Lv ${r.lvl}`, px, pz + 13); ctx.font = "600 13px 'IM Fell English SC', serif";
      }
    }
    for (const pt of this.world.portals || []) {
      const [px, pz] = P(pt.x, pt.z); if (px < -10 || pz < -10 || px > w + 10 || pz > h + 10) continue;
      const r = opts.radius ? 5 : 6;
      ctx.fillStyle = "rgba(120,70,255,0.35)"; ctx.beginPath(); ctx.arc(px, pz, r + 3, 0, 6.28); ctx.fill();
      ctx.strokeStyle = "#b090ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, pz, r, 0, 6.28); ctx.stroke();
      ctx.fillStyle = "#e0d0ff"; ctx.beginPath(); ctx.arc(px, pz, 2, 0, 6.28); ctx.fill();
      if (!opts.radius) { ctx.font = "600 13px 'IM Fell English SC', serif"; ctx.textAlign = "center"; ctx.fillStyle = "#000"; const lbl = pt.z < this.world.oh ? `${pt.name} (${pt.name.includes("Pits") ? "Grinding Dungeon" : "Dungeon"})` : pt.name; ctx.fillText(lbl, px + 1, pz - r - 5); ctx.fillStyle = "#c8b0ff"; ctx.fillText(lbl, px, pz - r - 6); }
    }
    if (!opts.radius && me.z <= this.world.oh && opts.inset !== false) {
      const ds = this.world.dungeons || [{ name: "The Hollow Deep", label: "The Hollow Deep — beneath the cave", entry: "Hollow Deep", x0: 370, z0: 452, w: 380, h: 138 }];
      this._inset = [];
      ds.forEach((d, k) => {
        const iw = Math.round(w * 0.22), ih = Math.round(iw * d.h / d.w), ix = Math.round(w * (0.16 + k * 0.4)), iy = h - ih - 10;
        ctx.fillStyle = "rgba(8,6,14,0.92)"; ctx.fillRect(ix - 4, iy - 20, iw + 8, ih + 24);
        ctx.strokeStyle = "#8a6aff"; ctx.lineWidth = 1.5; ctx.strokeRect(ix - 4, iy - 20, iw + 8, ih + 24);
        ctx.drawImage(src, d.x0 * 2, d.z0 * 2, d.w * 2, d.h * 2, ix, iy, iw, ih);
        const isc = iw / d.w, IP = (x, z) => [ix + (x - d.x0) * isc, iy + (z - d.z0) * isc];
        this._inset.push({ x: ix, y: iy, w: iw, h: ih, s: isc, d });
        ctx.font = "600 12px 'IM Fell English SC', serif"; ctx.textAlign = "left"; ctx.fillStyle = "#c8b0ff"; ctx.fillText(d.label, ix, iy - 6);
        ctx.textAlign = "center"; ctx.font = "10px 'Alegreya Sans', sans-serif";
        for (const r of this.world.regions) if (r.z > this.world.oh && r.x >= d.x0 && r.x <= d.x0 + d.w) { const [px, pz] = IP(r.x, r.z); ctx.fillStyle = r.lvl.includes("Boss") ? "#ff7a5a" : "#e8dcc0"; ctx.fillText(`${r.name.replace("Throne of the ", "").replace(/ — .*/, "")} (${r.lvl})`, px, pz + 3); }
        const ent = (this.world.portals || []).find((p) => p.z < this.world.oh && p.name === d.entry);
        if (ent) { const [ex, ez] = P(ent.x, ent.z); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(176,144,255,0.6)"; ctx.beginPath(); ctx.moveTo(ex, ez + 8); ctx.lineTo(ix + iw * 0.5, iy - 20); ctx.stroke(); ctx.setLineDash([]); }
      });
    }
    for (const pm of this.party?.members || []) {
      if (pm.id === this.meId) continue;
      const ent = this.entities.get(pm.id), x = ent ? ent.x : pm.x, z = ent ? ent.z : pm.z;
      const [px, pz] = P(x, z), inView = px > 4 && pz > 4 && px < w - 4 && pz < h - 4 && (!opts.radius || Math.hypot(px - w / 2, pz - h / 2) < w / 2 - 6);
      if (inView) { ctx.fillStyle = "#5aff8a"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, pz, 4, 0, 6.28); ctx.fill(); ctx.stroke(); if (!opts.radius) { ctx.font = "600 11px 'Alegreya Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#5aff8a"; ctx.fillText(pm.name, px, pz - 7); } }
      else if (opts.radius) { const a = Math.atan2(pz - h / 2, px - w / 2), R = w / 2 - 8; ctx.fillStyle = "#5aff8a"; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R, 3.5, 0, 6.28); ctx.fill(); }
    }
    const wp = this.waypoint;
    if (wp) {
      const ins = !opts.radius && wp.z > this.world.oh && me.z <= this.world.oh && (this._inset || []).find((r) => wp.x >= r.d.x0 && wp.x <= r.d.x0 + r.d.w);
      const [wx, wz] = ins ? [ins.x + (wp.x - ins.d.x0) * ins.s, ins.y + (wp.z - ins.d.z0) * ins.s] : P(wp.x, wp.z);
      const inside = wx > 6 && wz > 6 && wx < w - 6 && wz < h - 6 && (!opts.radius || Math.hypot(wx - w / 2, wz - h / 2) < w / 2 - 8);
      if (inside) {
        ctx.fillStyle = "#ffd36b"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(wx, wz - 7); ctx.lineTo(wx + 5, wz); ctx.lineTo(wx, wz + 7); ctx.lineTo(wx - 5, wz); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (opts.radius) {
        const a = Math.atan2(wz - h / 2, wx - w / 2), R = w / 2 - 12, ax = w / 2 + Math.cos(a) * R, az = h / 2 + Math.sin(a) * R;
        ctx.save(); ctx.translate(ax, az); ctx.rotate(a); ctx.fillStyle = "#ffd36b"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (opts.radius) { ctx.font = "600 11px 'Alegreya Sans', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText(`${Math.round(Math.hypot(wp.x - me.x, wp.z - me.z))}m`, w / 2 + 1, h - 15); ctx.fillStyle = "#ffd36b"; ctx.fillText(`${Math.round(Math.hypot(wp.x - me.x, wp.z - me.z))}m`, w / 2, h - 16); }
    }
    const [mx, mz] = P(me.x, me.z);
    ctx.save(); ctx.translate(mx, mz); ctx.rotate(-(this.entities.get(this.meId)?.rot || 0) + Math.PI);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
}
