import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Sword, Wand2, Crosshair, Shield, BookOpen, HardHat, Shirt, Footprints, Hand, Gem, FlaskConical, Coins, Bone, ScrollText, Package, Layers, Circle, X, Swords, Flame, Skull, EyeOff, Wind, Zap, DoorOpen, HeartPulse, Droplet, Move, Bug, Dumbbell, Radiation, Orbit } from "lucide-react";
import { RARITY } from "../../game/models";

export const RARITY_COLOR = RARITY;
export function iconFor(id, it) {
  if (!it) return Package;
  if (id === "gold") return Coins;
  if (it.type === "weapon") return /staff/.test(id) ? Wand2 : /bow/.test(id) ? Crosshair : Sword;
  if (it.type === "consumable") return FlaskConical;
  if (it.type === "material") return Bone;
  if (it.type === "quest") return ScrollText;
  return { off: /tome/.test(id) ? BookOpen : /quiver/.test(id) ? Layers : Shield, head: HardHat, chest: Shirt, legs: Layers, hands: Hand, feet: Footprints, ring: Circle, amulet: Gem }[it.slot] || Package;
}

export function ItemIcon({ id, item, qty, size = 44, dim, testid, onClick, onContextMenu, title, dragUid }) {
  const I = iconFor(id, item);
  const col = RARITY[item?.rarity] || "#888";
  return (
    <button type="button" data-testid={testid} onClick={onClick} onContextMenu={onContextMenu} className={`item-icon ${dim ? "dim" : ""}`} title={title}
      draggable={!!dragUid} onDragStart={dragUid ? (e) => { e.dataTransfer.setData("text/sx-uid", dragUid); e.dataTransfer.effectAllowed = "move"; } : undefined}
      style={{ width: size, height: size, borderColor: col, boxShadow: item?.rarity && item.rarity !== "common" ? `inset 0 0 12px ${col}55` : undefined }}>
      <I size={size * 0.5} color={col} strokeWidth={1.6} />
      {qty > 1 && <span className="item-qty">{qty}</span>}
    </button>
  );
}

const STAT = { str: "Str", sta: "Sta", wis: "Wis", int: "Int", dex: "Dex", hp_regen: "HP Regen /s", mp_regen: "Mana Regen /s", life_steal: "% Life Steal", mana_steal: "% Mana Steal" };
export function ItemTip({ id, item, me, extra }) {
  if (!item) return null;
  const eq = item.slot && me?.equipment?.[item.slot];
  const cur = eq && inst(window.__SX_ITEMS?.[eq.item], eq);
  const diff = (a, b) => { const d = (a || 0) - (b || 0); return d ? <span className={d > 0 ? "up" : "down"}> ({d > 0 ? "+" : ""}{d})</span> : null; };
  return (
    <div className="tip">
      <div className="tip-name" style={{ color: RARITY[item.rarity] }}>{item.name}</div>
      {item.props && <div className="tip-meta prop">✦ {Object.keys(item.props).length} random {Object.keys(item.props).length > 1 ? "properties" : "property"}</div>}
      <div className="tip-meta">{item.rarity} {item.slot ? `· ${item.slot}` : `· ${item.type}`}{item.lvl > 1 ? ` · req. lv ${item.lvl}` : ""}</div>
      {item.cls && <div className="tip-meta">{item.cls.join(" / ")}</div>}
      {item.dmg && <div>Damage {item.dmg[0]}–{item.dmg[1]} {item.magic ? "(magic)" : ""} · {item.spd}s{cur?.dmg && diff(item.dmg[0] + item.dmg[1], cur.dmg[0] + cur.dmg[1])}</div>}
      {item.armor > 0 && <div>Armor {item.armor}{cur && diff(item.armor, cur.armor)}</div>}
      {Object.entries(item.stats || {}).map(([k, v]) => <div key={k} className={STAT[k]?.startsWith("%") || k.endsWith("regen") ? "up prop" : "up"}>+{v}{STAT[k]?.startsWith("%") ? "" : " "}{STAT[k]}</div>)}
      {item.heal && <div className="up">Restores {item.heal} health</div>}
      {item.mana && <div className="up">Restores {item.mana} mana</div>}
      {item.desc && item.type !== "consumable" && <div className="tip-desc">{item.desc}</div>}
      {cur && cur !== item && <div className="tip-meta">Equipped: {cur.name}</div>}
      {extra}
    </div>
  );
}

export function Panel({ title, onClose, children, className = "", testid, style }) {
  return (
    <div className={`panel ${className}`} data-testid={testid} style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel-head">
        <span>{title}</span>
        <button type="button" className="panel-x" data-testid={`${testid}-close`} onClick={onClose}><X size={16} /></button>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function Bar({ value, max, kind, label, testid }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar bar-${kind}`} data-testid={testid}>
      <i style={{ width: `${pct}%` }} />
      <span>{label ?? `${Math.round(value)} / ${Math.round(max)}`}</span>
    </div>
  );
}

export function Hover({ tip, children }) {
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const tipRef = useRef();
  useLayoutEffect(() => {
    if (!rect || !tipRef.current) { setPos(null); return; }
    const tw = tipRef.current.offsetWidth, th = tipRef.current.offsetHeight, m = 8, W = window.innerWidth, H = window.innerHeight;
    let x = rect.left - tw - m;
    if (x < m) x = rect.right + m;
    if (x + tw > W - m) x = Math.max(m, Math.min(W - tw - m, rect.left + rect.width / 2 - tw / 2));
    let y = rect.top + rect.height / 2 - th / 2;
    if (x === Math.max(m, Math.min(W - tw - m, rect.left + rect.width / 2 - tw / 2)) && (x < rect.right && x + tw > rect.left)) y = rect.top - th - m < m ? rect.bottom + m : rect.top - th - m;
    y = Math.max(m, Math.min(H - th - m, y));
    setPos({ x, y });
  }, [rect]);
  return (
    <div className="hov" onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setRect(null)} onMouseDown={() => setRect(null)}>
      {children}
      {rect && createPortal(<div ref={tipRef} className="hov-tip" data-testid="tooltip" style={{ left: pos ? pos.x : -9999, top: pos ? pos.y : -9999 }}>{tip}</div>, document.body)}
    </div>
  );
}

export const inst = (item, s) => {
  if (!item || !s?.props) return item;
  const stats = { ...(item.stats || {}) };
  let armor = item.armor || 0;
  for (const [k, v] of Object.entries(s.props)) { if (k === "armor") armor += v; else stats[k] = (stats[k] || 0) + v; }
  return { ...item, name: s.pname || item.name, stats, armor, props: s.props };
};
const AB_ICONS = {
  agredi: [Wand2, "#9ac8ff", "#1a1a5a"], minor_mederi: [HeartPulse, "#9affb0", "#0a3a1a"], minor_sanatio: [Droplet, "#c8ff9a", "#1a3a0a"],
  double_stab: [Swords, "#ffe0a0", "#5a2a12"], attack_run: [Footprints, "#ffb070", "#4a1a0a"], spin_attack: [Layers, "#ffd0a0", "#4a2a0a"],
  multi_shot: [Orbit, "#ffe08a", "#3a1a2a"], arrow_barrage: [Crosshair, "#ffd36b", "#2a200a"], ignis: [Flame, "#ff8a3a", "#4a0a00"],
  multi_vis_nex: [Radiation, "#b0d8ff", "#0a1a4a"], radius: [Zap, "#e0f0ff", "#1a2a5a"], venenum: [Bug, "#9aff6a", "#13300a"],
  flamma_ventus: [Wind, "#ff7a2a", "#3a0a00"], tabes_viscera: [Skull, "#b0ff7a", "#1a2a0a"], teuri: [Shield, "#9ac8ff", "#1a2a4a"],
  velocitas: [Footprints, "#c8f0ff", "#0a2a3a"], robur: [Dumbbell, "#ffb060", "#4a1a0a"], contra_visus: [EyeOff, "#d0c0ff", "#1a1030"],
  pergere_trans: [Move, "#c0a0ff", "#20103a"], creare_porta: [DoorOpen, "#b080ff", "#200a3a"], power_strike: [Sword, "#e8c27a", "#5a2a12"], iron_guard: [Shield, "#9ac8ff", "#1a2a4a"], cleave: [Layers, "#ffb070", "#4a1a0a"], arcane_bolt: [Wand2, "#9ac8ff", "#1a1a5a"],
  flame_burst: [FlaskConical, "#ffb347", "#5a1a00"], aimed_shot: [Crosshair, "#ffe08a", "#3a2a0a"], venom_arrow: [Bone, "#9aff6a", "#13300a"], minor_heal: [Gem, "#9affb0", "#0a3a1a"],
  quickstep: [Footprints, "#c8f0ff", "#0a2a3a"], whirlwind: [Layers, "#ffd0a0", "#4a2a0a"], earthshatter: [Shield, "#d8a060", "#3a200a"], frost_nova: [Gem, "#a8e8ff", "#0a2a4a"], meteor_storm: [FlaskConical, "#ff5a1a", "#4a0a00"], volley: [Crosshair, "#ffd36b", "#2a200a"], multishot: [Crosshair, "#ffe08a", "#3a1a2a"], basic: [Sword, "#ccc", "#2a2a2a"] };
export function AbIcon({ id, size = 22 }) {
  const [I, c, bg] = AB_ICONS[id] || AB_ICONS.basic;
  return <span className="ab-glyph" style={{ background: `radial-gradient(circle at 50% 40%, ${bg}, #0b0908 80%)`, borderColor: c + "66" }}><I size={size} color={c} strokeWidth={1.8} /></span>;
}
