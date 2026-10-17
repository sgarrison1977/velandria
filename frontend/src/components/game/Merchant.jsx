import React, { useState, useEffect, useRef } from "react";
import { Coins } from "lucide-react";
import { useStore, setState, togglePanel } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, RARITY_COLOR, AbIcon, inst, cantUse } from "./ui";
import { keyLabel } from "./HUD";
import { audioCfg, setAudio, sfx } from "../../game/audio";

export function MerchantWindow({ data, net }) {
  const m = useStore((s) => s.merchant), me = useStore((s) => s.me);
  const [qty, setQty] = useState({});
  if (!m || !me) return null;
  const npc = data.npcs[m.npc];
  return (
    <Panel title={m.name} testid="merchant-window" className="merchant" onClose={() => setState({ merchant: null })}>
      <div className="merchant-top"><span>{npc.name} · {npc.role}</span><span className="purse" data-testid="merchant-gold"><Coins size={18} /> {me.gold.toLocaleString()} gold</span></div>
      <div className="merchant-cols">
        <div className="mcol">
          <h4>Merchant's Wares</h4>
          <div className="mlist" data-testid="merchant-stock">
            {m.stock.map((s) => {
              const it = data.items[s.item], q = qty[s.item] || 1, afford = me.gold >= s.price * q, out = s.qty === 0;
              return (
                <div key={s.item} className="mrow" data-testid={`merchant-item-${s.item}`}>
                  <Hover tip={<ItemTip id={s.item} item={it} me={me} />}><ItemIcon id={s.item} item={it} size={38} locked={cantUse(it, me)} /></Hover>
                  <div className="mrow-info"><b style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</b>
                    <small>{it.dmg ? `${it.dmg[0]}–${it.dmg[1]} dmg` : it.armor ? `${it.armor} armor` : it.full ? `full ${it.full}` : it.heal ? `+${it.heal} hp` : it.mana ? `+${it.mana} mp` : it.type}{it.lvl > 1 ? ` · lv ${it.lvl}` : ""} · {s.qty === -1 ? "plenty" : `${s.qty} left`}</small></div>
                  {it.stack > 1 && <input type="number" min={1} max={20} value={q} data-testid={`merchant-qty-${s.item}`} onChange={(e) => setQty({ ...qty, [s.item]: Math.max(1, Math.min(20, +e.target.value || 1)) })} />}
                  <span className="price">{s.price * q}g</span>
                  <button type="button" className="btn" disabled={!afford || out} data-testid={`merchant-buy-${s.item}`} onClick={() => net.send({ t: "buy", npc: m.npc, item: s.item, qty: q })}>{out ? "Sold out" : "Buy"}</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mcol">
          <h4>Your Pack <small>{me.inventory.length}/{data.inv_slots}</small></h4>
          <div className="mlist" data-testid="merchant-player-inventory">
            {!me.inventory.length && <p className="hint">Your pack is empty.</p>}
            {me.inventory.map((s) => {
              const it = data.items[s.item], price = it.price > 0 && it.type !== "quest" ? Math.max(1, Math.floor(it.price * data.sell_ratio)) : 0;
              return (
                <div key={s.uid} className="mrow" data-testid={`sell-row-${s.item}`}>
                  <Hover tip={<ItemTip id={s.item} item={inst(it, s)} me={me} />}><ItemIcon id={s.item} item={it} qty={s.qty} size={38} locked={cantUse(it, me)} /></Hover>
                  <div className="mrow-info"><b style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</b><small>{it.desc || it.type}</small></div>
                  <span className="price">{price ? `${price}g` : "—"}</span>
                  <button type="button" className="btn ghost" disabled={!price} data-testid={`sell-btn-${s.uid}`} onClick={() => net.send({ t: "sell", npc: m.npc, uid: s.uid, qty: 1 })}>Sell</button>
                  {s.qty > 1 && price > 0 && <button type="button" className="btn ghost" data-testid={`sell-all-btn-${s.uid}`} onClick={() => net.send({ t: "sell", npc: m.npc, uid: s.uid, qty: s.qty })}>All</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

const ACTION_LABEL = { attack_nearest: "Attack nearest enemy", stop: "Stop Action (ends Contra Visus)", loot_all: "Pick up all nearby loot", inventory: "Inventory", character: "Character stats", skills: "Skills & spells", map: "World map", quests: "Quest journal", chat: "Open chat", menu: "Menu / close windows" };
export function defaultBinds(data, cls) {
  const b = { attack_nearest: "Space", stop: "KeyS", loot_all: "KeyF", inventory: "KeyI", character: "KeyC", skills: "KeyK", map: "KeyM", quests: "KeyL", chat: "Enter", menu: "Escape" };
  const abil = Object.keys(data.abilities).filter((k) => data.abilities[k].cls.includes(cls));
  abil.forEach((a, i) => { b[`ability:${a}`] = i < 10 ? `Digit${(i + 1) % 10}` : ""; });
  return b;
}

export const applyUiScale = (v) => { localStorage.setItem("sx_ui_scale", v); document.documentElement.style.setProperty("--pz", v); };
applyUiScale(Number(localStorage.getItem("sx_ui_scale") || 1.25));

export function SettingsPanel({ data, net, engine }) {
  const me = useStore((s) => s.me), capture = useStore((s) => s.capture);
  const [tab, setTab] = useState("keys");
  const [binds, setBinds] = useState(me?.binds || {});
  const [msg, setMsg] = useState("");
  const [aud, setAud] = useState(audioCfg());
  const [q, setQ] = useState(localStorage.getItem("sx_quality") || "high");
  const [pz, setPz] = useState(Number(localStorage.getItem("sx_ui_scale") || 1.25));
  const bref = useRef(binds); bref.current = binds;
  useEffect(() => { if (me) setBinds(me.binds); }, [me?.binds]); // eslint-disable-line
  useEffect(() => {
    if (!capture) return;
    const h = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === "Escape" && capture !== "menu") { setState({ capture: null }); return; }
      const nb = { ...bref.current };
      const clash = Object.keys(nb).find((k) => k !== capture && nb[k] === e.code);
      if (clash) { nb[clash] = ""; setMsg(`${keyLabel(e.code)} was bound to "${label(clash)}" — that binding is now cleared.`); } else setMsg("");
      nb[capture] = e.code;
      setBinds(nb); setState({ capture: null });
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [capture]); // eslint-disable-line
  if (!me) return null;
  const label = (k) => ACTION_LABEL[k] || (k.startsWith("item:") ? data.items[k.slice(5)]?.name : data.abilities[k.slice(8)]?.name);
  const actions = data.actions.filter((a) => !a.startsWith("ability:") || data.abilities[a.slice(8)].cls.includes(me.cls));
  const dirty = JSON.stringify(binds) !== JSON.stringify(me.binds);
  return (
    <Panel title="Settings" testid="settings-panel" className="settings" onClose={() => { setState({ capture: null }); togglePanel("settings", false); }}>
      <div className="tabs">{[["keys", "Key Bindings"], ["audio", "Audio"], ["gfx", "Graphics"]].map(([k, l]) => <button type="button" key={k} data-testid={`settings-tab-${k}`} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "keys" && <div>
        <h4 className="bind-head">Spells & Skills <small>— click a key box, then press the hotkey you want</small></h4>
        <div className="binds spells" data-testid="spell-bind-list">
          {actions.filter((a) => a.startsWith("ability:")).map((a) => {
            const id = a.slice(8), ab = data.abilities[id], locked = !me.abilities.includes(id);
            return (
              <div key={a} className={`bind-row spell ${locked ? "locked" : ""}`} data-testid={`spell-row-${id}`}>
                <AbIcon id={id} size={18} />
                <span><b>{ab.name}</b>{locked ? <small className="down"> locked · Lv {ab.level}</small> : <small> {ab.cost} mana</small>}<em>{ab.desc}</em></span>
                <button type="button" className={`keycap ${capture === a ? "capturing" : ""}`} data-testid={`bind-${a.replace(":", "-")}`} onClick={() => setState({ capture: a })}>{capture === a ? "Press a key…" : keyLabel(binds[a]) || "—"}</button>
                {binds[a] && <button type="button" className="keycap clear" data-testid={`unbind-${id}`} title="Clear hotkey" onClick={() => setBinds({ ...binds, [a]: "" })}>×</button>}
              </div>
            );
          })}
        </div>
        <h4 className="bind-head">Items <small>— uses the first one in your bag</small></h4>
        <div className="binds spells" data-testid="item-bind-list">
          {actions.filter((a) => a.startsWith("item:")).map((a) => {
            const id = a.slice(5), it = data.items[id], have = me.inventory.filter((x) => x.item === id).reduce((t, x) => t + x.qty, 0);
            return (
              <div key={a} className="bind-row spell" data-testid={`item-row-${id}`}>
                <ItemIcon id={id} item={it} size={30} />
                <span><b>{it.name}</b><small> {have} in bag</small><em>{it.desc}</em></span>
                <button type="button" className={`keycap ${capture === a ? "capturing" : ""}`} data-testid={`bind-item-${id}`} onClick={() => setState({ capture: a })}>{capture === a ? "Press a key…" : keyLabel(binds[a]) || "—"}</button>
                {binds[a] && <button type="button" className="keycap clear" data-testid={`unbind-item-${id}`} title="Clear hotkey" onClick={() => setBinds({ ...binds, [a]: "" })}>×</button>}
              </div>
            );
          })}
        </div>
        <h4 className="bind-head">Controls</h4>
        <div className="binds" data-testid="keybind-list">
          {actions.filter((a) => !a.startsWith("ability:") && !a.startsWith("item:")).map((a) => (
            <div key={a} className="bind-row">
              <span>{label(a)}</span>
              <button type="button" className={`keycap ${capture === a ? "capturing" : ""}`} data-testid={`bind-${a.replace(":", "-")}`} onClick={() => setState({ capture: a })}>{capture === a ? "Press a key…" : keyLabel(binds[a])}</button>
            </div>
          ))}
        </div>
        {msg && <div className="bind-msg" data-testid="bind-conflict-msg">{msg}</div>}
        <div className="row">
          <button type="button" className="btn" data-testid="binds-save-btn" disabled={!dirty} onClick={() => { net.send({ t: "binds", binds }); setMsg(""); }}>Save bindings</button>
          <button type="button" className="btn ghost" data-testid="binds-default-btn" onClick={() => { setBinds(defaultBinds(data, me.cls)); setMsg("Defaults restored — click Save to apply."); }}>Restore defaults</button>
        </div>
      </div>}
      {tab === "audio" && <div className="audio-set">
        <label className="row"><input type="checkbox" data-testid="audio-mute-toggle" checked={aud.muted} onChange={(e) => { setAudio({ muted: e.target.checked }); setAud(audioCfg()); }} /> Mute all sound</label>
        <label>Master volume {Math.round(aud.vol * 100)}%<input type="range" min={0} max={1} step={0.05} value={aud.vol} data-testid="audio-volume-slider" onChange={(e) => { setAudio({ vol: +e.target.value }); setAud(audioCfg()); }} onMouseUp={() => sfx("click")} /></label>
      </div>}
      {tab === "gfx" && <div className="audio-set">
        {["high", "medium", "low"].map((k) => <label key={k} className="row"><input type="radio" name="q" data-testid={`gfx-${k}`} checked={q === k} onChange={() => { setQ(k); localStorage.setItem("sx_quality", k); engine?.setQuality(k); }} /> {k[0].toUpperCase() + k.slice(1)} quality</label>)}
        <label className="row ui-scale">Window size <input type="range" min="0.8" max="1.8" step="0.05" value={pz} data-testid="settings-ui-scale" onChange={(e) => { const v = Number(e.target.value); setPz(v); applyUiScale(v); }} /> <b data-testid="settings-ui-scale-value">{Math.round(pz * 100)}%</b></label>
        <p className="hint">Middle-mouse drag rotates the camera · mouse wheel zooms.</p>
      </div>}
    </Panel>
  );
}
