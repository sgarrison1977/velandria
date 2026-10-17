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
  return { off: /tome/.test(id) ? BookOpen : /quiver/.test(id) ? Layers : Shield, head: HardHat, chest: Shirt, legs: Layers, hands: Hand, feet: Footprints, belt: Layers, ring: Circle, amulet: Gem }[it.slot] || Package;
}

const ITEM_ART = {"leather_belt":"belt_leather","studded_belt":"belt_studded","hunters_sash":"belt_leather","sorcerers_cord":"belt_studded","warlord_girdle":"belt_ornate","titan_girdle":"belt_ornate","gold":"gold","rusty_sword":"rusty_sword","iron_sword":"iron_sword","spider_fang_blade":"fang_blade","steel_longsword":"iron_sword","orc_cleaver":"cleaver","troll_maul":"maul","dawnblade":"golden_blade","oak_staff":"oak_staff","ember_staff":"ember_staff","cultist_staff":"dark_staff","hunting_bow":"hunting_bow","longbow":"longbow","bandit_bow":"longbow","wooden_shield":"wooden_shield","iron_shield":"iron_shield","spell_tome":"tome","quiver":"quiver","leather_cap":"leather_cap","iron_helm":"iron_helm","padded_tunic":"tunic","chainmail":"chainmail","mystic_robe":"robe","bandit_leathers":"leathers","leather_pants":"pants","iron_greaves":"greaves","leather_gloves":"gloves","troll_hide_gloves":"gloves","leather_boots":"boots","wolf_boots":"boots","ring_vigor":"ring_gold","ring_focus":"ring_green","amulet_dawn":"amulet_sun","vampiric_blade":"blood_blade","soulreaver_blade":"dark_blade","doom_blade":"dark_blade","wraith_staff":"void_staff","void_staff":"void_staff","abyss_staff":"dark_staff","bloodthorn_bow":"blood_bow","stormcaller_bow":"storm_bow","heartseeker_bow":"blood_bow","wraithweave_robe":"wraith_robe","golemstone_plate":"plate","broodsilk_cloak":"cloak","dreadknight_helm":"dread_helm","fiendhide_boots":"magic_boots","ring_vampire":"ring_red","dire_fang":"fang","brood_silk":"silk","wraith_essence":"essence","golem_core":"core","dread_shard":"shard","fiend_horn":"horn","crown_hollow":"dark_crown","warden_signet":"ring_green","grove_mantle":"green_mantle","heartwood_crown":"wood_crown","tidecaller_boots":"magic_boots","drowned_moon_cloak":"cloak","sunhollow_seal":"ring_legend","eye_of_sunmere":"amulet_blue","sunforged_blade":"golden_blade","starfall_staff":"star_staff","galeheart_bow":"storm_bow","aegis_dawn":"golden_shield","codex_eternity":"codex","quiver_windrider":"wind_quiver","dragonscale_plate":"plate","archmage_vestments":"robe","shadowstalker_garb":"leathers","crown_valor":"gold_crown","titan_greaves":"greaves","gauntlets_might":"gauntlets","boots_wind":"magic_boots","ring_ancients":"ring_legend","amulet_eternity":"amulet_blue","cultist_amulet":"amulet_dark","minor_hp":"hp_small","hp_potion":"hp_large","minor_mp":"mp_small","mp_potion":"mp_large","bread":"bread","spider_silk":"silk","imp_horn":"horn","wolf_pelt":"pelt","goblin_ear":"ear","bone_dust":"bone_dust","bandit_insignia":"insignia","venom_sac":"venom","orc_tusk":"tusk","cultist_sigil":"sigil","troll_hide":"hide","sealed_letter":"letter"};
const artFor = (id, it) => ITEM_ART[id] || (it?.type === "weapon" ? (/staff/.test(id) ? "oak_staff" : /bow/.test(id) ? "longbow" : "iron_sword") : it?.slot === "ring" ? "ring_gold" : it?.slot === "amulet" ? "amulet_sun" : null);

export function ItemIcon({ id, item, qty, size = 44, dim, testid, onClick, onContextMenu, title, dragUid, dragSlot, locked }) {
  const I = iconFor(id, item);
  const col = RARITY[item?.rarity] || "#888";
  return (
    <button type="button" data-testid={testid} onClick={onClick} onContextMenu={onContextMenu} className={`item-icon ${dim ? "dim" : ""} ${locked ? "locked" : ""}`} title={title}
      draggable={!!(dragUid || dragSlot)} onDragStart={dragUid || dragSlot ? (e) => { e.dataTransfer.setData(dragSlot ? "text/sx-slot" : "text/sx-uid", dragSlot || dragUid); e.dataTransfer.effectAllowed = "move"; window.dispatchEvent(new CustomEvent("sx-drag", { detail: dragSlot ? "bag" : item?.slot || "none" })); } : undefined}
      onDragEnd={dragUid || dragSlot ? () => window.dispatchEvent(new CustomEvent("sx-drag", { detail: null })) : undefined}
      style={{ width: size, height: size, borderColor: col, boxShadow: item?.rarity && item.rarity !== "common" ? `inset 0 0 12px ${col}55` : undefined }}>
      {artFor(id, item) ? <img src={`/items/${artFor(id, item)}.webp`} alt="" draggable={false} className="item-art" /> : <I size={size * 0.5} color={col} strokeWidth={1.6} />}
      {qty > 1 && <span className="item-qty">{qty}</span>}
    </button>
  );
}

const STAT = { dmg: "Damage", str: "Strength", sta: "Stamina", wis: "Wisdom", int: "Intelligence", dex: "Dexterity", hp_regen: "HP Regen /s", mp_regen: "Mana Regen /s", life_steal: "% Life Steal", mana_steal: "% Mana Steal",
  crit: "% Critical Hit Chance", max_hp: "Max Health", max_mp: "Max Mana", armor: "Armor", move_speed: "% Movement Speed" };
export const cantUse = (it, me) => !!(it && me && it.slot && ((it.lvl || 1) > me.level || (it.cls && !it.cls.includes(me.cls))));
function Compare({ item, cur }) {
  const keys = [...new Set([...Object.keys(item.stats || {}), ...Object.keys(cur?.stats || {})])];
  const rows = [];
  if (item.dmg || cur?.dmg) rows.push(["Avg damage", ((item.dmg?.[0] || 0) + (item.dmg?.[1] || 0)) / 2 - ((cur?.dmg?.[0] || 0) + (cur?.dmg?.[1] || 0)) / 2]);
  rows.push(["Armor", (item.armor || 0) - (cur?.armor || 0)]);
  keys.forEach((k) => rows.push([STAT[k] || k, (item.stats?.[k] || 0) - (cur?.stats?.[k] || 0)]));
  const shown = rows.filter(([, d]) => d);
  return (
    <div className="tip-compare" data-testid="tip-compare">
      <div className="tip-meta">{cur ? `If swapped with ${cur.name}:` : "Slot is empty — equipping gives:"}</div>
      {shown.length ? shown.map(([n, d]) => <div key={n} className={d > 0 ? "up" : "down"}>{d > 0 ? "▲ +" : "▼ "}{Math.round(d * 10) / 10} {n.replace(/^% /, "% ")}</div>) : <div className="tip-meta">No stat change</div>}
    </div>
  );
}
export function ItemTip({ id, item, me, extra, equipped }) {
  if (!item) return null;
  const rslot = item.slot === "ring" ? ["ring1", "ring2", "ring3", "ring4", "ring5", "ring6"].find((r) => !me?.equipment?.[r]) || "ring1" : item.slot;
  const eq = rslot && me?.equipment?.[rslot];
  const cur = eq && inst(window.__SX_ITEMS?.[eq.item], eq);
  const diff = (a, b) => { const d = (a || 0) - (b || 0); return d ? <span className={d > 0 ? "up" : "down"}> ({d > 0 ? "+" : ""}{d})</span> : null; };
  return (
    <div className="tip">
      <div className="tip-name" style={{ color: RARITY[item.rarity] }}>{item.name}</div>
      {item.props && <div className="tip-meta prop">✦ {Object.keys(item.props).length} random {Object.keys(item.props).length > 1 ? "properties" : "property"}</div>}
      <div className="tip-meta">{item.rarity} {item.slot ? `· ${item.slot}` : `· ${item.type}`}</div>
      {item.lvl > 1 && <div className={`tip-meta ${me && me.level < item.lvl ? "down" : ""}`} data-testid="tip-req-level">Requires level {item.lvl}{me && me.level < item.lvl ? ` — you are level ${me.level}` : ""}</div>}
      {item.cls && me && !item.cls.includes(me.cls) && <div className="tip-meta down">Your class cannot use this</div>}
      {item.cls && <div className="tip-meta">{item.cls.join(" / ")}</div>}
      {item.dmg && <div>Damage {item.dmg[0]}–{item.dmg[1]} {item.magic ? "(magic)" : ""} · {item.spd}s</div>}
      {item.armor > 0 && <div>Armor {item.armor}</div>}
      {Object.entries(item.stats || {}).map(([k, v]) => <div key={k} className={STAT[k]?.startsWith("%") || k.endsWith("regen") || item.props?.[k] ? "up prop" : "up"}>+{v}{STAT[k]?.startsWith("%") ? "" : " "}{STAT[k] || k.replace(/_/g, " ")}</div>)}
      {item.heal && <div className="up">Restores {item.heal} health</div>}{item.full && <div className="up">Restores all {item.full === "hp" ? "health" : "mana"}</div>}
      {item.mana && <div className="up">Restores {item.mana} mana</div>}
      {item.desc && item.type !== "consumable" && <div className="tip-desc">{item.desc}</div>}
      {!equipped && me && item.slot && <Compare item={item} cur={cur} />}
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
  if (!item || (!s?.props && s?.lvl == null)) return item;
  const stats = { ...(item.stats || {}) };
  let armor = item.armor || 0;
  for (const [k, v] of Object.entries(s.props || {})) { if (k === "armor") armor += v; else stats[k] = (stats[k] || 0) + v; }
  return { ...item, name: s.pname || item.name, stats, armor, props: s.props, lvl: s.lvl ?? item.lvl };
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
