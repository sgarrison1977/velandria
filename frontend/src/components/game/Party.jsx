import React from "react";
import { useStore, setState } from "../../game/store";
import { Crown, X, LogOut } from "lucide-react";

export function PartyFrame({ net, data }) {
  const party = useStore((s) => s.party), me = useStore((s) => s.me);
  if (!party || !me) return null;
  const lead = party.leader === me.id;
  return (
    <div className="party-frame" data-testid="party-frame" onMouseDown={(e) => e.stopPropagation()}>
      <div className="party-head"><span>Party ({party.members.length})</span>
        <button type="button" className="party-leave" data-testid="party-leave-btn" title="Leave party" onClick={() => net.send({ t: "party_leave" })}><LogOut size={13} /></button></div>
      {party.members.map((m) => (
        <div key={m.id} className={`party-mem ${m.dead ? "dead" : ""}`} data-testid={`party-member-${m.name}`}>
          <div className="party-name">{party.leader === m.id && <Crown size={11} color="#ffd36b" />}<b>{m.name}</b><small>Lv {m.level} {data.classes[m.cls].name}</small>
            {lead && m.id !== me.id && <button type="button" className="party-kick" data-testid={`party-kick-${m.name}`} title="Remove" onClick={() => net.send({ t: "party_kick", id: m.id })}><X size={11} /></button>}</div>
          <div className="party-hp"><i style={{ width: `${Math.max(0, Math.min(100, (m.hp / m.max_hp) * 100))}%` }} /></div>
        </div>
      ))}
      <div className="party-tip">/p message for party chat</div>
    </div>
  );
}

export function PartyInvite({ net }) {
  const inv = useStore((s) => s.partyInvite);
  if (!inv) return null;
  const reply = (t) => { net.send({ t }); setState({ partyInvite: null }); };
  return (
    <div className="party-invite" data-testid="party-invite" onMouseDown={(e) => e.stopPropagation()}>
      <p><b>{inv.from}</b> (Lv {inv.lvl}) invites you to join their party.</p>
      <div><button type="button" className="btn" data-testid="party-accept-btn" onClick={() => reply("party_accept")}>Accept</button>
        <button type="button" className="btn ghost" data-testid="party-decline-btn" onClick={() => reply("party_decline")}>Decline</button></div>
    </div>
  );
}
