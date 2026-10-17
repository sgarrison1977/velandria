import * as THREE from "three";

const lerp = (a, b, k) => a + (b - a) * k;
export const SHIMMER = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: "varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = (modelMatrix * vec4(position,1.0)).y; gl_Position = projectionMatrix * mv; }",
  fragmentShader: "uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float band = 0.5 + 0.5 * sin(vY * 14.0 - uTime * 4.0); float a = f * (0.55 + 0.45 * band) + 0.04 + 0.03 * sin(uTime * 3.0); gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * a, a); }",
});
export function setInvis(rig, on) {
  if (!!rig.invisOn === on) return;
  rig.invisOn = on;
  rig.root.traverse((o) => {
    if (!o.isMesh || o.material?.isMeshBasicMaterial) return;
    if (on) { o.userData.base = o.userData.m && o.material === HURT ? o.userData.m : o.material; o.material = SHIMMER; o.castShadow = false; }
    else if (o.userData.base) { o.material = o.userData.base; o.castShadow = true; }
  });
}
const HURT = new THREE.MeshStandardMaterial({ color: "#ff6a5a", emissive: "#ff2a1a", emissiveIntensity: 0.9 });

function humanoidAnim(rig, a, dt, t, moving) {
  const p = a.phase, sw = moving ? Math.sin(p) : 0, cw = moving ? Math.cos(p) : 0;
  const { legL, legR, armL, armR, torso, body, head } = rig;
  legL.hip.rotation.x = sw * 0.6; legR.hip.rotation.x = -sw * 0.6;
  legL.knee.rotation.x = moving ? 0.08 + Math.max(0, -cw) * 1.0 : 0.04; legR.knee.rotation.x = moving ? 0.08 + Math.max(0, cw) * 1.0 : 0.04;
  legL.ankle.rotation.x = -(legL.hip.rotation.x + legL.knee.rotation.x) * 0.6; legR.ankle.rotation.x = -(legR.hip.rotation.x + legR.knee.rotation.x) * 0.6;
  body.position.y = moving ? cw * cw * 0.04 - 0.012 : 0;
  body.position.z = 0;
  body.rotation.y = sw * 0.07;
  const breath = Math.sin(t * 1.8 + rig.seed);
  torso.rotation.set(rig.lean + (moving ? 0.07 : breath * 0.012), -sw * 0.16, sw * 0.03);
  head.rotation.set(moving ? -0.05 : breath * 0.02, moving ? sw * 0.08 : Math.sin(t * 0.37 + rig.seed) * 0.22, 0);
  const out = 0.1 + (rig.bulk - 1) * 0.35;
  armL.sh.rotation.set(-sw * 0.55, 0, -out - (moving ? 0 : breath * 0.015)); armR.sh.rotation.set(sw * 0.55, 0, out + (moving ? 0 : breath * 0.015));
  armL.el.rotation.x = -0.22 - Math.max(0, sw) * 0.45; armR.el.rotation.x = -0.22 - Math.max(0, -sw) * 0.45;
  const wk = rig.weaponKind;
  if (wk === "staff" || wk === "spear") { armR.sh.rotation.x = -0.25 + sw * 0.15; armR.el.rotation.x = -0.75; }
  if (wk === "bow") { armL.el.rotation.x = -0.5; }
  if (a.atk > 0) {
    const q = 1 - a.atk, env = Math.sin(q * Math.PI);
    if (wk === "bow") {
      const draw = Math.min(1, q / 0.55);
      armL.sh.rotation.set(-1.5, -0.25, 0); armL.el.rotation.x = 0;
      armR.sh.rotation.set(-1.5, 0.35, 0); armR.el.rotation.x = q < 0.6 ? -1.9 * draw : -1.9 + (q - 0.6) * 2;
      torso.rotation.y = -0.5 * env;
    } else if (wk === "staff") {
      armR.sh.rotation.x = -0.3 - 1.4 * env; armR.el.rotation.x = -0.5 + env * 0.3; torso.rotation.x = rig.lean + 0.12 * env;
    } else {
      const wind = q < 0.3 ? q / 0.3 : 1, strike = q < 0.3 ? 0 : Math.min(1, (q - 0.3) / 0.35), back = q > 0.7 ? (q - 0.7) / 0.3 : 0;
      const ease = 1 - (1 - strike) ** 3;
      const sx = lerp(lerp(armR.sh.rotation.x, -2.5, wind) + ease * 3.0, armR.sh.rotation.x, back);
      armR.sh.rotation.set(sx, 0, out + 0.25 * wind * (1 - back));
      armR.el.rotation.x = lerp(-1.0 * wind + ease * 0.8, -0.22, back);
      torso.rotation.y = lerp(0.4 * wind - ease * 0.85, 0, back);
      armL.sh.rotation.x = -0.6 * env; armL.el.rotation.x = -0.9 * env;
      body.position.z = 0.12 * env;
    }
  }
  if (a.cast > 0) {
    const c = Math.sin(a.cast * Math.PI);
    armL.sh.rotation.x = lerp(armL.sh.rotation.x, -1.9, c); armR.sh.rotation.x = lerp(armR.sh.rotation.x, -2.1, c);
    armL.sh.rotation.z = lerp(armL.sh.rotation.z, 0.2, c); armR.sh.rotation.z = lerp(armR.sh.rotation.z, -0.2, c);
    armL.el.rotation.x = -0.25 * c; armR.el.rotation.x = -0.25 * c;
    torso.rotation.x = rig.lean - 0.1 * c; head.rotation.x = -0.15 * c;
  }
  if (a.spin > 0) {
    const q = 1 - a.spin, e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2, env = Math.sin(q * Math.PI);
    body.rotation.y = e * Math.PI * 2;
    armR.sh.rotation.set(-0.35, 0, lerp(armR.sh.rotation.z, 1.45, env)); armR.el.rotation.x = -0.1;
    armL.sh.rotation.set(-0.2, 0, lerp(armL.sh.rotation.z, -1.2, env)); armL.el.rotation.x = -0.2;
    torso.rotation.x = rig.lean + 0.15 * env; torso.rotation.z = -0.12 * env;
    legL.knee.rotation.x = legR.knee.rotation.x = 0.35 * env; body.position.y = -0.06 * env;
  }
  if (a.hurt > 0) { torso.rotation.x -= a.hurt * 0.18; head.rotation.x -= a.hurt * 0.2; }
  if (rig.cape) rig.cape.rotation.x = lerp(rig.cape.rotation.x, (moving ? 0.3 : 0.06) + Math.sin(t * 2.3 + rig.seed) * 0.04 + Math.abs(sw) * 0.06, Math.min(1, dt * 5));
  if (rig.wings) rig.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.5 + Math.sin(t * 9) * 0.35); });
  if (rig.tail) { rig.tail.rotation.y = Math.sin(t * 2.2 + rig.seed) * 0.35; rig.tail.rotation.x = Math.sin(t * 1.3) * 0.08; }
}

export function animateRig(rig, a, dt, t) {
  const moving = a.moving, sp = rig.kind === "humanoid" ? 7.5 : rig.kind === "spider" ? 11 : 10;
  a.phase = (a.phase || 0) + dt * (moving ? sp : 0);
  a.atk = Math.max(0, (a.atk || 0) - dt * 2.4);
  a.cast = Math.max(0, (a.cast || 0) - dt * 2);
  a.spin = Math.max(0, (a.spin || 0) - dt * 2.1);
  a.hurt = Math.max(0, (a.hurt || 0) - dt * 4);
  const sw = moving ? Math.sin(a.phase) : 0;
  if (a.dead) {
    a.deadT = (a.deadT || 0) + dt;
    const k = Math.min(1, a.deadT * 2.5), sink = Math.max(0, a.deadT - 2.2) * 0.6;
    if (rig.kind === "humanoid") {
      rig.body.rotation.x = -k * Math.PI / 2; rig.body.position.y = 0.12 * k - sink;
      rig.legL.knee.rotation.x = rig.legR.knee.rotation.x = 0.5 * k;
      rig.armL.sh.rotation.z = -1.2 * k; rig.armR.sh.rotation.z = 1.2 * k;
    } else if (rig.kind === "quad") { rig.body.rotation.z = k * Math.PI / 2; rig.body.position.y = 0.72 - 0.32 * k - sink; }
    else { rig.legs.forEach((l) => { l.up.rotation.z = 0.7 - k * 1.5; l.kn.rotation.z = -1.9 - k * 0.8; }); rig.body.position.y = 0.45 - 0.15 * k - sink; }
    return;
  }
  if (a.deadT) { a.deadT = 0; rig.body.rotation.set(0, 0, 0); rig.body.position.y = rig.kind === "spider" ? 0.45 : rig.kind === "quad" ? 0.72 : 0; }
  const atkCurve = a.atk > 0 ? Math.sin((1 - a.atk) * Math.PI) : 0;
  if (rig.kind === "humanoid") humanoidAnim(rig, a, dt, t, moving);
  else if (rig.kind === "spider") {
    rig.legs.forEach((l) => { l.up.rotation.z = 0.7 + (moving ? Math.max(0, Math.sin(a.phase + l.ph)) * 0.4 : Math.sin(t * 1.5 + l.ph) * 0.03); l.up.rotation.x = moving ? Math.cos(a.phase + l.ph) * 0.28 : 0; });
    rig.body.position.y = 0.45 + (moving ? Math.abs(Math.sin(a.phase * 2)) * 0.03 : Math.sin(t * 2) * 0.01);
    rig.body.position.z = atkCurve * 0.35;
    rig.body.rotation.x = -atkCurve * 0.4;
    for (let i = 0; i < 2; i++) rig.legs[i].up.rotation.z = 0.7 + atkCurve * 0.9;
  } else {
    rig.legs.forEach((l) => { l.up.rotation.x = moving ? Math.sin(a.phase + l.ph) * 0.65 : 0; l.kn.rotation.x = moving ? Math.max(0, Math.sin(a.phase + l.ph + 1)) * -0.7 : 0; });
    rig.body.position.y = 0.72 + (moving ? Math.abs(Math.sin(a.phase)) * 0.05 : Math.sin(t * 2) * 0.008);
    rig.body.rotation.x = moving ? Math.sin(a.phase * 2) * 0.03 : 0;
    rig.head.rotation.x = -atkCurve * 0.5 + (moving ? 0 : Math.sin(t * 1.2) * 0.05);
    rig.head.position.z = 0.55 + atkCurve * 0.25;
    if (rig.tail) rig.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.4;
  }
  void sw;
  const flash = a.hurt > 0 && !rig.invisOn;
  if (flash !== a.flashOn) {
    a.flashOn = flash;
    rig.root.traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial && !o.material.isPointsMaterial) { if (flash) { o.userData.m = o.material; o.material = HURT; } else if (o.userData.m) o.material = o.userData.m; } });
  }
}
