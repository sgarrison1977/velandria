import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildPlayer, animateRig, lookStr } from "@/game/models";
import { setEnv } from "@/game/rig/tex";

const SLOTS = ["main", "off", "head", "chest", "", "feet", "legs", "hands", "belt"];
export const eqString = (equipment, look) => SLOTS.map((s) => (s ? equipment?.[s]?.item || "" : "0,0")).join("|") + "|" + lookStr(look);
export const defaultEquip = (c) => c ? { main: { item: c.weapon }, off: c.offhand ? { item: c.offhand } : null, chest: { item: "padded_tunic" } } : {};
export const randomLook = (opts) => Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, v[Math.floor(Math.random() * v.length)]]));
export const firstLook = (opts) => Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, k === "skin" ? v[2] : k === "hair" ? v[1] : v[0]]));

export function CharPreview({ cls, eq, items, spin = true, zoomable = true, className = "look-preview", testid = "appearance-preview" }) {
  const ref = useRef(), st = useRef({});
  useEffect(() => {
    const S = st.current, cv = ref.current, r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; setEnv(r);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#c8d6e0", "#4a3c26", 1.4));
    const sun = new THREE.DirectionalLight("#ffe2b8", 2.8); sun.position.set(3, 5, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight("#8fb0ff", 1.2); rim.position.set(-3, 3, -4); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const holder = new THREE.Group(); scene.add(holder);
    Object.assign(st.current, { r, scene, cam, holder, close: false });
    let raf, last = performance.now(), drag = null;
    const size = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const zoom = () => { const c = st.current.close; cam.position.set(0, c ? 2.1 : 1.45, c ? 1.3 : 5.2); cam.lookAt(0, c ? 2.05 : 1.15, 0); };
    st.current.zoom = zoom; size(); zoom();
    const down = (e) => { drag = e.clientX; }, up = () => { drag = null; };
    const move = (e) => { if (drag !== null) { holder.rotation.y += (e.clientX - drag) * 0.012; drag = e.clientX; } };
    cv.addEventListener("pointerdown", down); window.addEventListener("pointerup", up); window.addEventListener("pointermove", move);
    const loop = () => { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; if (st.current.rig) animateRig(st.current.rig, {}, dt, now / 1000); if (drag === null && spin) holder.rotation.y += dt * 0.25; r.render(scene, cam); raf = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(raf); cv.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); window.removeEventListener("pointermove", move); S.rig?.dispose?.(); r.dispose(); };
  }, []);
  useEffect(() => {
    const s = st.current; if (!s.holder || !items) return;
    if (s.rig) { s.holder.remove(s.rig.root); s.rig.dispose?.(); }
    s.rig = buildPlayer(cls, eq, items); s.holder.add(s.rig.root);
  }, [cls, eq, items]);
  return (
    <div className={className} data-testid={testid}>
      <canvas ref={ref} />
      {zoomable && <button type="button" className="btn ghost look-zoom" data-testid="appearance-zoom-btn" onClick={() => { st.current.close = !st.current.close; st.current.zoom(); }}>Zoom face</button>}
    </div>
  );
}

const LABEL = { skin: "Skin tone", hair: "Hair color", hairStyle: "Hair style", beardStyle: "Beard", face: "Face", eyes: "Eye color" };
export function LookPicker({ opts, look, onChange }) {
  return (
    <div className="look-picker" data-testid="appearance-picker">
      {Object.entries(opts).map(([k, vals]) => (
        <div key={k} className="look-row">
          <label>{LABEL[k] || k}</label>
          <div className="look-opts">
            {vals.map((v) => v.startsWith("#")
              ? <button type="button" key={v} data-testid={`look-${k}-${v.slice(1)}`} className={`look-swatch ${look[k] === v ? "on" : ""}`} style={{ background: v }} onClick={() => onChange({ ...look, [k]: v })} />
              : <button type="button" key={v} data-testid={`look-${k}-${v}`} className={`look-chip ${look[k] === v ? "on" : ""}`} onClick={() => onChange({ ...look, [k]: v })}>{v}</button>)}
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" data-testid="appearance-randomize-btn" onClick={() => onChange(randomLook(opts))}>Randomize</button>
    </div>
  );
}
