import * as THREE from "three";

// A fixed pool of point lights re-assigned to the nearest static light anchors.
// Keeps the scene's light count constant (no shader recompiles) and small (cheap fragments).
export class LightPool {
  constructor(scene, n = 8) {
    this.anchors = []; this.pool = []; this.next = 0;
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight("#000000", 0, 1, 1.6); scene.add(l); this.pool.push(l); }
  }
  harvest(root) {
    root.updateMatrixWorld(true);
    const found = [];
    root.traverse((o) => { if (o.isPointLight && !o.userData.keep && !this.pool.includes(o)) found.push(o); });
    for (const l of found) {
      const p = new THREE.Vector3(); l.getWorldPosition(p);
      this.anchors.push({ p, color: l.color.clone(), i: l.intensity, d: l.distance, decay: l.decay, flick: l.name === "flicker", ph: Math.random() * 10 });
      l.parent.remove(l);
    }
  }
  update(x, z, t) {
    if (t > this.next) {
      this.next = t + 0.25;
      for (const a of this.anchors) a.k = (a.p.x - x) ** 2 + (a.p.z - z) ** 2;
      this.near = this.anchors.filter((a) => a.k < 90 * 90).sort((a, b) => a.k - b.k).slice(0, this.pool.length);
    }
    const near = this.near || [];
    this.pool.forEach((l, i) => {
      const a = near[i];
      if (!a) { l.intensity = 0; return; }
      l.position.copy(a.p); l.color.copy(a.color); l.distance = a.d; l.decay = a.decay;
      l.intensity = a.flick ? a.i * (0.85 + Math.sin(t * 17 + a.ph) * 0.08 + Math.sin(t * 7.3 + a.ph) * 0.07) : a.i;
    });
  }
}
