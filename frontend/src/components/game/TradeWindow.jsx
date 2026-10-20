import React, { useState, useEffect } from "react";
import { Lock, Check, Coins, X } from "lucide-react";
import { useStore, setState } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, inst } from "./ui";
import { sfx } from "../../game/audio";

const Status = ({ side, testid }) => (
  <span className={`trade-status ${side.conf ? "conf" : side.lock ? "lock" : ""}`} data-testid={testid}>
    {side.conf ? <><Check size={12} /> Confirmed</> : side.lock ? <><Lock size={12} /> Locked</> : "Modifying…"}
  </span>
);

function OfferGrid({ items, data, me, testid, onRemove, onDropUid }) {
  const cells = Array.from({ length: 12 }, (_, i) => items[i]);
  return (
    <div className={`trade-grid ${onDropUid ? "droppable" : ""}`} data-testid={testid}
      onDragOver={(e) => { if (onDropUid && e.dataTransfer.types.includes("text/sx-uid")) e.preventDefault(); }}
      onDrop={(e) => { const u = e.dataTransfer.getData("text/sx-uid"); if (u && onDropUid) { e.preventDefault(); e.stopPropagation(); onDropUid(u); } }}>
      {cells.map((s, i) => s
        ? <Hover key={s.uid} tip={<ItemTip id={s.item} item={inst(data.items[s.item], s)} me={me} />}>
            <ItemIcon id={s.item} item={inst(data.items[s.item], s)} qty={s.qty} size={50} testid={`${testid}-item-${i}`} onClick={onRemove ? () => onRemove(s.uid) : undefined} />
          </Hover>
        : <div key={`e${i}`} className="trade-cell" />)}
    </div>
  );
}

function GoldBox({ tr, send }) {
  const [v, setV] = useState(String(tr.me.gold));
  useEffect(() => setV(String(tr.me.gold)), [tr.me.gold]);
  const commit = () => { const g = Math.max(0, Math.floor(Number(v) || 0)); if (g !== tr.me.gold) send({ t: "trade_gold", gold: g }); };
  return (
    <label className="trade-gold"><Coins size={14} />
      <input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} data-testid="trade-your-gold-input" />
    </label>
  );
}

export function TradeWindow({ net, data }) {
  const tr = useStore((s) => s.trade), me = useStore((s) => s.me);
  if (!tr || !me) return null;
  const send = (m) => { sfx("click"); net.send(m); };
  const offered = new Set(tr.me.items.map((s) => s.uid));
  const bothLocked = tr.me.lock && tr.them.lock;
  return (
    <Panel title={`Trade with ${tr.them.name}`} testid="trade-window" className="trade-panel" onClose={() => send({ t: "trade_cancel" })}>
      <div className="trade-offers">
        <section className={`trade-side ${tr.me.lock ? "locked" : ""}`}>
          <header><b>Your Offer</b><Status side={tr.me} testid="trade-status-your-side" /></header>
          <OfferGrid items={tr.me.items} data={data} me={me} testid="trade-your-offer-grid" onRemove={(uid) => send({ t: "trade_offer", uid, remove: true })} onDropUid={(uid) => send({ t: "trade_offer", uid })} />
          <GoldBox tr={tr} send={send} />
        </section>
        <section className={`trade-side ${tr.them.lock ? "locked" : ""}`}>
          <header><b>{tr.them.name}'s Offer</b><Status side={tr.them} testid="trade-status-their-side" /></header>
          <OfferGrid items={tr.them.items} data={data} me={me} testid="trade-their-offer-grid" />
          <div className="trade-gold readonly" data-testid="trade-their-gold-display"><Coins size={14} /> {tr.them.gold.toLocaleString()}</div>
        </section>
      </div>
      <div className="trade-inv-head"><span>Your inventory — click or drag items into your offer</span><span className="purse-mini"><Coins size={13} /> {me.gold.toLocaleString()}</span></div>
      <div className="trade-inv" data-testid="trade-inventory">
        {me.inventory.map((s) => (
          <Hover key={s.uid} tip={<ItemTip id={s.item} item={inst(data.items[s.item], s)} me={me} />}>
            <ItemIcon id={s.item} item={inst(data.items[s.item], s)} qty={s.qty} size={42} dim={offered.has(s.uid)} dragUid={s.uid} testid={`trade-inv-${s.uid}`} onClick={() => !offered.has(s.uid) && send({ t: "trade_offer", uid: s.uid })} />
          </Hover>
        ))}
      </div>
      <div className="trade-actions">
        <button type="button" className="btn ghost" onClick={() => send({ t: "trade_cancel" })} data-testid="trade-close-btn"><X size={14} /> Cancel</button>
        <button type="button" className={`btn ${tr.me.lock ? "ghost" : ""}`} onClick={() => send({ t: "trade_lock", on: !tr.me.lock })} data-testid="trade-lock-offer-btn">{tr.me.lock ? <><Lock size={13} /> Unlock</> : "Lock Offer"}</button>
        <button type="button" className="btn claim" disabled={!bothLocked || tr.me.conf} onClick={() => send({ t: "trade_confirm" })} data-testid="trade-confirm-btn">{tr.me.conf ? <><Check size={13} /> Waiting…</> : "Confirm Trade"}</button>
      </div>
    </Panel>
  );
}

export function TradeRequest({ net }) {
  const r = useStore((s) => s.tradeReq);
  if (!r) return null;
  const reply = (t) => { net.send({ t }); setState({ tradeReq: null }); };
  return (
    <div className="party-invite trade-request-modal" data-testid="trade-request-popup" onMouseDown={(e) => e.stopPropagation()}>
      <p><b>{r.from}</b> (Lv {r.lvl}) wants to trade with you.</p>
      <div><button type="button" className="btn" data-testid="trade-accept-btn" onClick={() => reply("trade_accept")}>Accept</button>
        <button type="button" className="btn ghost" data-testid="trade-decline-btn" onClick={() => reply("trade_decline")}>Decline</button></div>
    </div>
  );
}
