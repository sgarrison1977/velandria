import React, { useMemo, useState } from "react";
import { togglePanel } from "../../game/store";
import { sfx } from "../../game/audio";
import { Panel, ItemIcon } from "./ui";

const STATS = [["dmg", "Damage"], ["str", "Strength"], ["sta", "Stamina"], ["dex", "Dexterity"], ["int", "Intelligence"], ["wis", "Wisdom"],
  ["max_hp", "Max HP"], ["max_mp", "Max Mana"], ["hp_regen", "HP Regen /s"], ["mp_regen", "Mana Regen /s"], ["life_steal", "% Life Steal"],
  ["mana_steal", "% Mana Steal"], ["crit", "% Crit"], ["armor", "Armor"], ["move_speed", "% Move Speed"], ["fire_dmg", "Fire Damage"],
  ["frost_dmg", "Frost Damage"], ["lightning_dmg", "Lightning Damage"]];

const CATS = [["weapons", "Weapons", (it) => it.type === "weapon"], ["off", "Off-hand", (it) => it.slot === "off"], ["head", "Helms", (it) => it.slot === "head"],
  ["chest", "Chest", (it) => it.slot === "chest"], ["limbs", "Legs · Hands · Belts · Boots", (it) => ["legs", "hands", "belt", "feet"].includes(it.slot)],
  ["jewel", "Rings & Amulets", (it) => it.slot === "ring" || it.slot === "amulet"], ["use", "Potions & Food", (it) => it.type === "consumable"],
  ["mat", "Materials", (it) => it.type === "material"]];

function ItemPicker({ data, item, setItem }) {
  const [cat, setCat] = useState("weapons"), [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = q.trim().toLowerCase(), test = CATS.find((c) => c[0] === cat)[2];
    return Object.entries(data.items).filter(([k, it]) => it.type !== "quest" && it.type !== "gold" && (f ? it.name.toLowerCase().includes(f) || k.includes(f) : test(it)))
      .sort((a, b) => (a[1].lvl || 1) - (b[1].lvl || 1) || a[1].name.localeCompare(b[1].name));
  }, [data, cat, q]);
  return (
    <div className="give-picker">
      <div className="give-tabs">{CATS.map(([k, l]) => <button key={k} type="button" data-testid={`give-cat-${k}`} className={`give-tab ${cat === k && !q ? "on" : ""}`} onClick={() => { setCat(k); setQ(""); }}>{l}</button>)}</div>
      <input data-testid="give-search-input" className="give-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all items…" />
      <div className="give-grid">{list.map(([k, it]) => (
        <button key={k} type="button" data-testid={`give-item-${k}`} className={`give-item r-${it.rarity} ${item === k ? "on" : ""}`} onClick={() => setItem(k)} title={it.desc || it.name}>
          <ItemIcon id={k} item={it} size={34} /><span className="gi-name">{it.name}</span><span className="gi-lvl">{it.lvl > 1 ? `lv ${it.lvl}` : ""}</span>
        </button>))}
        {!list.length && <div className="gi-empty">No items match.</div>}
      </div>
    </div>
  );
}

function StatRow({ row, i, set, remove }) {
  return (
    <div className="give-row">
      <select data-testid={`give-stat-key-${i}`} value={row.k} onChange={(e) => set(i, { ...row, k: e.target.value })}>
        {STATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input data-testid={`give-stat-val-${i}`} type="number" value={row.v} onChange={(e) => set(i, { ...row, v: e.target.value })} />
      <button type="button" className="btn ghost" data-testid={`give-stat-remove-${i}`} onClick={() => remove(i)}>×</button>
    </div>
  );
}

export function AdminGivePanel({ data, net }) {
  const [to, setTo] = useState(""), [item, setItem] = useState(""), [qty, setQty] = useState(1), [pname, setPname] = useState("");
  const [rows, setRows] = useState([{ k: "dex", v: 50 }]);
  const it = data.items[item], gear = it && (it.type === "weapon" || it.type === "armor");
  const send = () => {
    const props = {};
    for (const r of rows) if (Number(r.v)) props[r.k] = (props[r.k] || 0) + Number(r.v);
    sfx("coin"); net.send({ t: "give", to, item, qty: Number(qty) || 1, pname, props: gear ? props : {} });
  };
  return (
    <Panel title="Keeper's Gift" testid="admin-give" className="admin-give" onClose={() => togglePanel("give", false)}>
      <label>Character<input data-testid="give-to-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. Gribb" /></label>
      <ItemPicker data={data} item={item} setItem={setItem} />
      {it && <div className="give-chosen" data-testid="give-chosen-item">Selected: <b className={`r-${it.rarity}`}>{it.name}</b></div>}
      {gear ? <>
        <label>Custom name<input data-testid="give-name-input" value={pname} maxLength={48} onChange={(e) => setPname(e.target.value)} placeholder={it.name} /></label>
        <div className="give-stats">{rows.map((r, i) => <StatRow key={i} row={r} i={i} set={(j, v) => setRows(rows.map((x, k) => (k === j ? v : x)))} remove={(j) => setRows(rows.filter((_, k) => k !== j))} />)}</div>
        <button type="button" className="btn ghost" data-testid="give-add-stat-btn" onClick={() => setRows([...rows, { k: "str", v: 10 }])}>+ Add stat</button>
      </> : it && <label>Quantity<input data-testid="give-qty-input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
      <button type="button" className="btn" data-testid="give-submit-btn" disabled={!to.trim() || !item} onClick={send}>Give</button>
    </Panel>
  );
}
