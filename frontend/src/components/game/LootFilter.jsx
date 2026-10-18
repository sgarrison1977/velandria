import React, { useState } from "react";
import { RARITY } from "../../game/models";

const KEY = "sx_loot_filter";
const DEFAULT = { rarities: ["common", "uncommon", "rare", "epic", "legendary"], gold: true, consumables: true, materials: true, props_only: false, names: [], names_only: false };
export const getLootFilter = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT; } };

function Check({ id, label, on, set, color }) {
  return (
    <label className="lf-check" data-testid={`loot-filter-${id}`}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {color && <i className="lf-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
      <span>{label}</span>
    </label>
  );
}

export function LootFilterSettings() {
  const [f, setF] = useState(getLootFilter), [txt, setTxt] = useState(getLootFilter().names.join(", "));
  const save = (n) => { setF(n); localStorage.setItem(KEY, JSON.stringify(n)); };
  const tog = (r, on) => save({ ...f, rarities: on ? [...new Set([...f.rarities, r])] : f.rarities.filter((x) => x !== r) });
  return (
    <div className="loot-filter" data-testid="loot-filter-settings">
      <p className="hint">Controls what the "Pick up all nearby loot" hotkey grabs. Clicking an item on the ground always picks it up.</p>
      <h4>Gear by glow color</h4>
      <div className="lf-row">{Object.entries(RARITY).map(([r, c]) => <Check key={r} id={r} label={r[0].toUpperCase() + r.slice(1)} color={c} on={f.rarities.includes(r)} set={(on) => tog(r, on)} />)}</div>
      <Check id="props-only" label="Only gear with bonus properties" on={f.props_only} set={(v) => save({ ...f, props_only: v })} />
      <h4>Other loot</h4>
      <div className="lf-row">
        <Check id="gold" label="Gold" on={f.gold} set={(v) => save({ ...f, gold: v })} />
        <Check id="consumables" label="Potions" on={f.consumables} set={(v) => save({ ...f, consumables: v })} />
        <Check id="materials" label="Materials & trophies" on={f.materials} set={(v) => save({ ...f, materials: v })} />
      </div>
      <h4>Always pick up items named</h4>
      <input className="lf-names" data-testid="loot-filter-names" placeholder="e.g. ring, ancients, vampiric" value={txt}
        onChange={(e) => { setTxt(e.target.value); save({ ...f, names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }); }} onKeyDown={(e) => e.stopPropagation()} />
      <Check id="names-only" label="Only pick up items matching these names (ignore everything else)" on={f.names_only} set={(v) => save({ ...f, names_only: v })} />
      <button type="button" className="btn ghost" data-testid="loot-filter-reset" onClick={() => { save(DEFAULT); setTxt(""); }}>Reset to pick up everything</button>
    </div>
  );
}
