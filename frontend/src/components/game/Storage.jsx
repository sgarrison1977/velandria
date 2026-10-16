import React, { useState } from "react";
import { useStore, setState } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, inst, cantUse } from "./ui";
import { InventoryGrid } from "./Panels";
import { sfx } from "../../game/audio";

export function StorageWindow({ net, data }) {
  const st = useStore((s) => s.storage), me = useStore((s) => s.me);
  const [q, setQ] = useState(""), [amt, setAmt] = useState("");
  if (!st || !me) return null;
  const nameOf = (s) => (s.pname || data.items[s.item].name).toLowerCase();
  const match = (s) => !q || nameOf(s).includes(q.toLowerCase()) || data.items[s.item].type.includes(q.toLowerCase()) || (data.items[s.item].slot || "").includes(q.toLowerCase());
  const gold = (sign) => { const v = Math.floor(Number(amt)); if (v > 0) { sfx("coin"); net.send({ t: "storage_gold", npc: st.npc, amount: sign * v }); setAmt(""); } };
  const move = (t, s, e) => { sfx("loot"); net.send({ t, npc: st.npc, uid: s.uid, qty: e?.shiftKey && s.qty > 1 ? 1 : s.qty }); };
  const shown = st.items.filter(match);
  const cells = q ? shown : Array.from({ length: st.cap }, (_, i) => st.items[i]);
  return (
    <Panel title={st.name} testid="storage-window" className="storage-panel" onClose={() => setState({ storage: null })}>
      <div className="storage-cols">
        <div>
          <div className="inv-head"><span>Account storage <b data-testid="storage-count">{st.items.length}/{st.cap}</b></span><span>Click to take · Shift-click takes 1</span></div>
          <div className="storage-tools">
            <input className="storage-search" data-testid="storage-search-input" placeholder="Search storage…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            {q && <button type="button" className="btn ghost" data-testid="storage-search-clear" onClick={() => setQ("")}>Clear</button>}
            <button type="button" className="btn" data-testid="storage-sort-btn" onClick={() => { sfx("click"); net.send({ t: "storage_sort", npc: st.npc }); }}>Sort</button>
          </div>
          {q && <div className="tip-meta" data-testid="storage-search-count">{shown.length} match{shown.length === 1 ? "" : "es"}</div>}
          <div className="storage-grid" data-testid="storage-grid">
            {cells.map((s, i) => s ? (
              <Hover key={s.uid} tip={<ItemTip id={s.item} item={inst(data.items[s.item], s)} me={me} extra={<div className="tip-meta">Click to move to your bag</div>} />}>
                <ItemIcon id={s.item} item={data.items[s.item]} qty={s.qty} size={42} testid={`storage-slot-${i}`} locked={cantUse(data.items[s.item], me)} onClick={(e) => move("storage_take", s, e)} />
              </Hover>
            ) : <div key={`e${i}`} className="item-icon empty" style={{ width: 42, height: 42 }} />)}
          </div>
        </div>
        <div>
          <div className="vault" data-testid="storage-vault">
            <div className="vault-row"><span>Vault</span><b className="gold-t" data-testid="vault-gold">{(st.gold || 0).toLocaleString()} gold</b></div>
            <div className="vault-row"><span>On you</span><b className="gold-t" data-testid="vault-my-gold">{me.gold.toLocaleString()} gold</b></div>
            <div className="vault-row">
              <input type="number" min="1" className="storage-search" data-testid="vault-amount-input" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") gold(1); }} />
              <button type="button" className="btn" data-testid="vault-deposit-btn" onClick={() => gold(1)}>Deposit</button>
              <button type="button" className="btn" data-testid="vault-withdraw-btn" onClick={() => gold(-1)}>Withdraw</button>
            </div>
            <div className="vault-row quick">
              <button type="button" className="btn ghost" data-testid="vault-deposit-all-btn" disabled={!me.gold} onClick={() => { sfx("coin"); net.send({ t: "storage_gold", npc: st.npc, amount: me.gold }); }}>Deposit all</button>
              <button type="button" className="btn ghost" data-testid="vault-withdraw-all-btn" disabled={!st.gold} onClick={() => { sfx("coin"); net.send({ t: "storage_gold", npc: st.npc, amount: -st.gold }); }}>Withdraw all</button>
            </div>
          </div>
          <div className="inv-head"><span>Your bag</span><span>Click to store</span></div>
          <InventoryGrid data={data} me={me} onSlot={(s) => move("storage_put", s)} onRight={(s) => move("storage_put", s)} />
        </div>
      </div>
    </Panel>
  );
}
