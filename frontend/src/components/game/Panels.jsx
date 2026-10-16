import React, { useState } from "react";
import { Plus, Lock, Check } from "lucide-react";
import { useStore, togglePanel } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, AbIcon, inst } from "./ui";
import { sfx } from "../../game/audio";

const SLOTS = [["head", "Head"], ["amulet", "Amulet"], ["main", "Main hand"], ["chest", "Chest"], ["off", "Off hand"], ["hands", "Hands"], ["legs", "Legs"], ["feet", "Feet"], ...[1, 2, 3, 4, 5, 6].map((i) => [`ring${i}`, `Ring ${i}`])];

export function Equipment({ data, net, me }) {
  return (
    <div className="equip-grid" data-testid="equipment-grid">
      {SLOTS.map(([slot, label]) => {
        const e = me.equipment[slot], it = e && data.items[e.item];
        const drop = (ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("drop-hot"); const uid = ev.dataTransfer.getData("text/sx-uid"); if (uid) { sfx("click"); net.send({ t: "equip", uid, slot }); } };
        return (
          <div key={slot} className="equip-slot" data-testid={`equip-drop-${slot}`} onDragOver={(ev) => { ev.preventDefault(); ev.currentTarget.classList.add("drop-hot"); }} onDragLeave={(ev) => ev.currentTarget.classList.remove("drop-hot")} onDrop={drop}>
            {e ? <Hover tip={<ItemTip id={e.item} item={inst(it, e)} extra={<div className="tip-meta">Click to unequip</div>} />}>
              <ItemIcon id={e.item} item={it} testid={`equip-slot-${slot}`} onClick={() => { sfx("click"); net.send({ t: "unequip", slot }); }} />
            </Hover> : <div className="item-icon empty" data-testid={`equip-slot-${slot}`} />}
            <em>{label}</em>
          </div>
        );
      })}
    </div>
  );
}

export function InventoryGrid({ data, me, onSlot, onRight, sellMode }) {
  const cells = Array.from({ length: data.inv_slots }, (_, i) => me.inventory[i]);
  return (
    <div className="inv-grid" data-testid="inventory-grid">
      {cells.map((s, i) => s ? (
        <Hover key={s.uid} tip={<ItemTip id={s.item} item={inst(data.items[s.item], s)} me={me} extra={sellMode ? <div className="tip-meta gold-t">Sells for {Math.max(1, Math.floor(data.items[s.item].price * data.sell_ratio))}g each</div> : <div className="tip-meta">Right-click to {data.items[s.item].type === "consumable" ? "use" : "equip"}{data.items[s.item].slot === "ring" ? " · drag onto a ring slot to choose it" : ""}</div>} />}>
          <ItemIcon id={s.item} item={data.items[s.item]} qty={s.qty} testid={`inv-slot-${i}`} dragUid={data.items[s.item].slot ? s.uid : undefined} onClick={() => onSlot(s)} onContextMenu={(e) => { e.preventDefault(); onRight && onRight(s); }} />
        </Hover>
      ) : <div key={`e${i}`} className="item-icon empty" data-testid={`inv-slot-${i}`} />)}
    </div>
  );
}

export function InventoryPanel({ data, net }) {
  const me = useStore((s) => s.me);
  const [sel, setSel] = useState(null);
  if (!me) return null;
  const s = sel && me.inventory.find((x) => x.uid === sel);
  const it = s && data.items[s.item];
  const use = (slot) => { sfx("click"); net.send({ t: "use", uid: slot.uid }); };
  return (
    <Panel title="Inventory & Equipment" testid="inventory-panel" className="inv-panel" onClose={() => togglePanel("inventory", false)}>
      <Equipment data={data} net={net} me={me} />
      <div className="inv-head"><span>Bag <b data-testid="inventory-count">{me.inventory.length}/{data.inv_slots}</b></span><span className="gold-t" data-testid="inventory-gold">{me.gold.toLocaleString()} gold</span></div>
      <InventoryGrid data={data} me={me} onSlot={(x) => setSel(x.uid)} onRight={use} />
      {s && <div className="inv-detail" data-testid="inventory-detail">
        <ItemTip id={s.item} item={inst(it, s)} me={me} />
        <div className="row">
          {(it.type === "consumable" || it.type === "weapon" || it.type === "armor") && <button type="button" className="btn" data-testid="inventory-use-btn" onClick={() => use(s)}>{it.type === "consumable" ? "Use" : "Equip"}</button>}
          {it.type !== "quest" && <button type="button" className="btn ghost" data-testid="inventory-destroy-btn" onClick={() => { net.send({ t: "destroy", uid: s.uid }); setSel(null); }}>Discard</button>}
        </div>
      </div>}
    </Panel>
  );
}

const ATTRS = [["str", "Strength"], ["sta", "Stamina"], ["wis", "Wisdom"], ["int", "Intelligence"], ["dex", "Dexterity"]];
export function CharacterPanel({ data, net }) {
  const me = useStore((s) => s.me);
  if (!me) return null;
  return (
    <Panel title="Character" testid="character-panel" className="char-panel" onClose={() => togglePanel("character", false)}>
      <div className="char-head"><b>{me.name}</b><span>Level {me.level} {data.classes[me.cls].name}</span></div>
      <div className="char-points" data-testid="attr-points">Unspent attribute points: <b>{me.attr_points}</b> <small>· earned three per level</small></div>
      {ATTRS.map(([k, label]) => (
        <div className="attr-row" key={k}>
          <Hover tip={<div className="tip"><div className="tip-desc">{data.attr_info[k]}</div><div className="tip-meta">Base {me.attrs[k]} · gear +{me.tot[k] - me.attrs[k]}</div></div>}>
            <span className="attr-name">{label}</span>
          </Hover>
          <b data-testid={`attr-${k}-value`}>{me.tot[k]}</b>
          <button type="button" className="plus" data-testid={`attr-${k}-plus`} disabled={!me.attr_points} onClick={() => { sfx("click"); net.send({ t: "alloc", attr: k }); }}><Plus size={14} /></button>
        </div>
      ))}
      <div className="derived" data-testid="derived-stats">
        <div><em>Health</em><b>{me.max_hp}</b></div><div><em>Mana</em><b>{me.max_mp}</b></div>
        <div><em>Damage</em><b data-testid="stat-damage">{me.dmg[0]}–{me.dmg[1]}</b></div><div><em>Attack speed</em><b>{me.attack_interval}s</b></div>
        <div><em>Armor</em><b data-testid="stat-armor">{me.armor}</b></div><div><em>Crit chance</em><b>{(me.crit * 100).toFixed(1)}%</b></div>
        <div><em>Range</em><b>{me.range}m</b></div><div><em>Experience</em><b>{me.xp.toLocaleString()}</b></div>
      </div>
    </Panel>
  );
}

export function SkillsPanel({ data, net }) {
  const me = useStore((s) => s.me);
  if (!me) return null;
  const list = Object.entries(data.abilities).filter(([, a]) => a.cls.includes(me.cls));
  return (
    <Panel title="Skills & Spells" testid="skills-panel" className="skills-panel" onClose={() => togglePanel("skills", false)}>
      <div className="char-points" data-testid="skill-points">Skill points: <b>{me.skill_points}</b> <small>· earned three per level</small></div>
      <div className="skill-row base"><AbIcon id="basic" /><div><b>Basic Attack</b><p>Left-click an enemy to auto-attack ({me.range}m, every {me.attack_interval}s).</p></div></div>
      {list.map(([id, a]) => {
        const un = me.abilities.includes(id), can = !un && me.level >= a.level && me.skill_points > 0;
        return (
          <div key={id} className={`skill-row ${un ? "" : "locked"}`} data-testid={`skill-${id}`}>
            <AbIcon id={id} />
            <div><b>{a.name}</b> <small>unlocks at lv {a.level} · {a.cost} mana{a.charge ? " · 5 min charge" : ""}</small><p>{a.desc}</p></div>
            {un ? <span className="learned"><Check size={14} /> Learned</span>
              : <button type="button" className="btn" data-testid={`skill-unlock-${id}`} disabled={!can} onClick={() => { sfx("levelup"); net.send({ t: "unlock", ab: id }); }}>{me.level < a.level ? <><Lock size={12} /> Lv {a.level}</> : "Learn"}</button>}
          </div>
        );
      })}
      <p className="hint">Assign keys to abilities under Settings → Key Bindings.</p>
    </Panel>
  );
}

export function QuestPanel({ data }) {
  const me = useStore((s) => s.me);
  if (!me) return null;
  const qs = Object.entries(me.quests);
  return (
    <Panel title="Quest Journal" testid="quest-panel" className="quest-panel" onClose={() => togglePanel("quests", false)}>
      {!qs.length && <p className="hint">No quests yet. Speak with Elder Toman and Captain Rhea in Titus's square (right-click them).</p>}
      {qs.map(([id, q]) => {
        const d = data.quests[id], giver = data.npcs[d.turnin];
        let prog = "";
        if (d.kind === "kill") prog = `${data.monsters[d.target].name}: ${q.k}/${d.count}`;
        if (d.kind === "kill_collect") prog = `${data.monsters[d.target].name}: ${q.k}/${d.count} · ${data.items[d.collect].name}: ${Math.min(d.collect_count, me.inventory.filter((s) => s.item === d.collect).reduce((a, s) => a + s.qty, 0))}/${d.collect_count}`;
        if (d.kind === "deliver") prog = `Deliver the ${data.items[d.item].name} to ${giver.name}`;
        return (
          <div key={id} className={`quest ${q.s}`} data-testid={`quest-${id}`}>
            <b>{d.name}</b> <span className="qstate">{q.s === "done" ? "Completed" : "Active"}</span>
            <p>{d.text}</p>
            {q.s !== "done" && <div className="qprog">{prog} · return to {giver.name}</div>}
            <div className="tip-meta">Reward: {d.reward.xp} xp, {d.reward.gold} gold{d.reward.items.map(([i, n]) => `, ${n > 1 ? n + "× " : ""}${data.items[i].name}`).join("")}</div>
          </div>
        );
      })}
    </Panel>
  );
}
