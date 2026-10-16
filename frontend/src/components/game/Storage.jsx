import React from "react";
import { useStore, setState } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, inst, cantUse } from "./ui";
import { InventoryGrid } from "./Panels";
import { sfx } from "../../game/audio";

export function StorageWindow({ net, data }) {
  const st = useStore((s) => s.storage), me = useStore((s) => s.me);
  if (!st || !me) return null;
  const move = (t, s, e) => { sfx("loot"); net.send({ t, npc: st.npc, uid: s.uid, qty: e?.shiftKey && s.qty > 1 ? 1 : s.qty }); };
  const cells = Array.from({ length: st.cap }, (_, i) => st.items[i]);
  return (
    <Panel title={st.name} testid="storage-window" className="storage-panel" onClose={() => setState({ storage: null })}>
      <div className="storage-cols">
        <div>
          <div className="inv-head"><span>Account storage <b data-testid="storage-count">{st.items.length}/{st.cap}</b></span><span>Click to take · Shift-click takes 1</span></div>
          <div className="storage-grid" data-testid="storage-grid">
            {cells.map((s, i) => s ? (
              <Hover key={s.uid} tip={<ItemTip id={s.item} item={inst(data.items[s.item], s)} me={me} extra={<div className="tip-meta">Click to move to your bag</div>} />}>
                <ItemIcon id={s.item} item={data.items[s.item]} qty={s.qty} size={42} testid={`storage-slot-${i}`} locked={cantUse(data.items[s.item], me)} onClick={(e) => move("storage_take", s, e)} />
              </Hover>
            ) : <div key={`e${i}`} className="item-icon empty" style={{ width: 42, height: 42 }} />)}
          </div>
        </div>
        <div>
          <div className="inv-head"><span>Your bag</span><span>Click to store</span></div>
          <InventoryGrid data={data} me={me} onSlot={(s) => move("storage_put", s)} onRight={(s) => move("storage_put", s)} />
        </div>
      </div>
    </Panel>
  );
}
