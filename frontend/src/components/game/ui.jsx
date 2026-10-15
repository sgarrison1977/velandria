import React from "react";
import { Sword, Wand2, Crosshair, Shield, BookOpen, HardHat, Shirt, Footprints, Hand, Gem, FlaskConical, Coins, Bone, ScrollText, Package, Layers, Circle, X } from "lucide-react";
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

export function ItemIcon({ id, item, qty, size = 44, dim, testid, onClick, onContextMenu, title }) {
  const I = iconFor(id, item);
  const col = RARITY[item?.rarity] || "#888";
  return (
    <button type="button" data-testid={testid} onClick={onClick} onContextMenu={onContextMenu} className={`item-icon ${dim ? "dim" : ""}`} title={title}
      style={{ width: size, height: size, borderColor: col, boxShadow: item?.rarity && item.rarity !== "common" ? `inset 0 0 12px ${col}55` : undefined }}>
      <I size={size * 0.5} color={col} strokeWidth={1.6} />
      {qty > 1 && <span className="item-qty">{qty}</span>}
    </button>
  );
}

const STAT = { str: "Str", sta: "Sta", wis: "Wis", int: "Int", dex: "Dex" };
export function ItemTip({ id, item, me, extra }) {
  if (!item) return null;
  const eq = item.slot && me?.equipment?.[item.slot];
  const cur = eq && window.__SX_ITEMS?.[eq.item];
  const diff = (a, b) => { const d = (a || 0) - (b || 0); return d ? <span className={d > 0 ? "up" : "down"}> ({d > 0 ? "+" : ""}{d})</span> : null; };
  return (
    <div className="tip">
      <div className="tip-name" style={{ color: RARITY[item.rarity] }}>{item.name}</div>
      <div className="tip-meta">{item.rarity} {item.slot ? `· ${item.slot}` : `· ${item.type}`}{item.lvl > 1 ? ` · req. lv ${item.lvl}` : ""}</div>
      {item.cls && <div className="tip-meta">{item.cls.join(" / ")}</div>}
      {item.dmg && <div>Damage {item.dmg[0]}–{item.dmg[1]} {item.magic ? "(magic)" : ""} · {item.spd}s{cur?.dmg && diff(item.dmg[0] + item.dmg[1], cur.dmg[0] + cur.dmg[1])}</div>}
      {item.armor > 0 && <div>Armor {item.armor}{cur && diff(item.armor, cur.armor)}</div>}
      {Object.entries(item.stats || {}).map(([k, v]) => <div key={k} className="up">+{v} {STAT[k]}</div>)}
      {item.heal && <div className="up">Restores {item.heal} health</div>}
      {item.mana && <div className="up">Restores {item.mana} mana</div>}
      {item.desc && <div className="tip-desc">{item.desc}</div>}
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
  return <div className="hov">{children}<div className="hov-tip">{tip}</div></div>;
}

const AB_ICONS = { power_strike: [Sword, "#e8c27a", "#5a2a12"], iron_guard: [Shield, "#9ac8ff", "#1a2a4a"], cleave: [Layers, "#ffb070", "#4a1a0a"], arcane_bolt: [Wand2, "#9ac8ff", "#1a1a5a"],
  flame_burst: [FlaskConical, "#ffb347", "#5a1a00"], aimed_shot: [Crosshair, "#ffe08a", "#3a2a0a"], venom_arrow: [Bone, "#9aff6a", "#13300a"], minor_heal: [Gem, "#9affb0", "#0a3a1a"],
  quickstep: [Footprints, "#c8f0ff", "#0a2a3a"], basic: [Sword, "#ccc", "#2a2a2a"] };
export function AbIcon({ id, size = 22 }) {
  const [I, c, bg] = AB_ICONS[id] || AB_ICONS.basic;
  return <span className="ab-glyph" style={{ background: `radial-gradient(circle at 50% 40%, ${bg}, #0b0908 80%)`, borderColor: c + "66" }}><I size={size} color={c} strokeWidth={1.8} /></span>;
}
