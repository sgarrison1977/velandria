import React, { useEffect, useState } from "react";
import { useStore, setState } from "../../game/store";
import { AbIcon, Hover } from "./ui";

const BUFF_AB = { armor: "teuri", speed: "velocitas", str: "robur", invis: "contra_visus" };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function BuffBar({ data }) {
  const me = useStore((s) => s.me), at = useStore((s) => s.meAt);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  if (!me) return null;
  const el = (performance.now() - (at || 0)) / 1000;
  const list = Object.entries(me.buffs || {}).map(([k, v]) => [k, v - el]).filter(([k, r]) => BUFF_AB[k] && r > 0);
  return (
    <>
      {list.some(([k]) => k === "invis") && <div className="invis-veil" data-testid="invis-veil" />}
      {list.length > 0 && <div className="buffbar" data-testid="buff-bar">
        {list.map(([k, r]) => { const ab = data.abilities[BUFF_AB[k]]; return (
          <Hover key={k} tip={<div className="tip"><div className="tip-name">{ab.name}</div><div>{ab.desc}</div><div className="tip-meta">{fmt(r)} remaining</div></div>}>
            <div className={`buff-ic ${r < 30 ? "low" : ""}`} data-testid={`buff-${BUFF_AB[k]}`}><AbIcon id={BUFF_AB[k]} size={24} /><small>{fmt(r)}</small></div>
          </Hover>); })}
      </div>}
    </>
  );
}

export function MarkPicker({ net, engine }) {
  const open = useStore((s) => s.markPick), placing = useStore((s) => s.placing), me = useStore((s) => s.me);
  if (placing) return <div className="place-hint" data-testid="portal-place-hint">Click the ground to open a portal to Mark {placing} · Esc to cancel</div>;
  if (!open || !me) return null;
  const pick = (k) => {
    setState({ markPick: false, placing: k });
    engine.placing = (gp) => { setState({ placing: null }); net.send({ t: "cast", ab: "creare_porta", mark: k, pt: [gp.x, gp.z] }); };
  };
  return (
    <div className="mark-picker" data-testid="mark-picker" onMouseDown={(e) => e.stopPropagation()}>
      <h3>Creare Porta</h3>
      <p>Choose a mark, then click the ground nearby. Type <b>mark0</b> – <b>mark9</b> in chat to set marks where you stand.</p>
      <div className="mark-grid">
        {"0123456789".split("").map((k) => (
          <button key={k} type="button" disabled={!me.marks?.[k]} data-testid={`mark-${k}`} title={me.marks?.[k] ? `(${Math.round(me.marks[k][0])}, ${Math.round(me.marks[k][1])})` : "Not set"} onClick={() => pick(k)}>Mark {k}</button>
        ))}
      </div>
      <button type="button" className="btn ghost" style={{ marginTop: 10, width: "100%" }} data-testid="mark-cancel-btn" onClick={() => setState({ markPick: false })}>Cancel</button>
    </div>
  );
}
