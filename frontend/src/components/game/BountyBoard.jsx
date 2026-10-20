import React, { useState, useEffect } from "react";
import { BountyRankings, CastleRankings } from "./BountyRankings";
import { Crosshair, Coins, Skull } from "lucide-react";
import { useStore, setState, toast } from "../../game/store";
import { Panel, ItemIcon, ItemTip, Hover, inst } from "./ui";
import { sfx } from "../../game/audio";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function BossStatus({ b, at }) {
  const [, tick] = useState(0);
  const left = Math.max(0, Math.round(b.respawn_in - (Date.now() - at) / 1000));
  useEffect(() => { if (!left) return undefined; const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, [left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return left ? <span className="boss-status dead" data-testid={`bounty-respawn-${b.id}`}>Returns in {fmt(left)}</span> : <span className="boss-status alive" data-testid={`bounty-alive-${b.id}`}>Alive</span>;
}

function BountyRow({ b, send, engine, at }) {
  const track = () => { engine?.setWaypoint({ x: b.track[0], z: b.track[1] }); sfx("click"); toast(`Waypoint set: ${b.where}`, "good"); };
  return (
    <div className={`bounty-row st-${b.state}`} data-testid={`bounty-row-${b.id}`}>
      <div className="bounty-lv"><Skull size={16} /><b>{b.level}</b></div>
      <div className="bounty-info">
        <b>{b.name} <BossStatus b={b} at={at} /></b>
        <span>{b.where}</span>
        <em>{b.gold.toLocaleString()} gold · {b.xp.toLocaleString()} xp · {b.tokens} token{b.tokens > 1 ? "s" : ""}</em>
      </div>
      <div className="bounty-acts">
        <button type="button" className="btn ghost icon" title="Set waypoint" onClick={track} data-testid={`bounty-track-${b.id}`}><Crosshair size={14} /></button>
        {b.state === "available" && <button type="button" className="btn" onClick={() => send("accept", b.id)} data-testid={`bounty-accept-${b.id}`}>Accept</button>}
        {b.state === "active" && <button type="button" className="btn ghost" onClick={() => send("abandon", b.id)} data-testid={`bounty-abandon-${b.id}`}>Abandon</button>}
        {b.state === "done" && <button type="button" className="btn claim" onClick={() => send("turnin", b.id)} data-testid={`bounty-claim-${b.id}`}>Claim</button>}
        {b.state === "claimed" && <span className="bounty-done" data-testid={`bounty-claimed-${b.id}`}>Done today</span>}
      </div>
    </div>
  );
}

function TokenShop({ shop, tokens, data, me, send }) {
  return (
    <div className="bounty-shop" data-testid="bounty-shop">
      {shop.map(({ item, cost }) => (
        <div key={item} className="bounty-shop-item" data-testid={`bounty-shop-item-${item}`}>
          <Hover tip={<ItemTip id={item} item={inst(data.items[item], {})} me={me} />}><ItemIcon id={item} item={data.items[item]} size={48} /></Hover>
          <div className="bounty-info"><b style={{ color: `var(--r-${data.items[item].rarity})` }}>{data.items[item].name}</b><span>Level {data.items[item].lvl || 1}</span></div>
          <button type="button" className="btn" disabled={tokens < cost} onClick={() => send("buy", item)} data-testid={`bounty-buy-${item}`}>{cost} <Coins size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function BountyBoard({ net, data, engine }) {
  const b = useStore((s) => s.bounty), me = useStore((s) => s.me);
  const [tab, setTab] = useState("bounties");
  if (!b || !me) return null;
  const send = (action, id) => { sfx("click"); net.send({ t: "bounty", npc: b.npc, action, id }); };
  return (
    <Panel title="Bounty Board" testid="bounty-board" className="bounty-panel" onClose={() => setState({ bounty: null })}>
      <div className="tabs bounty-tabs">
        <button type="button" className={tab === "bounties" ? "on" : ""} onClick={() => setTab("bounties")} data-testid="bounty-tab-bounties">Bounties</button>
        <button type="button" className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")} data-testid="bounty-tab-shop">Token Shop</button>
        <button type="button" className={tab === "rank" ? "on" : ""} onClick={() => setTab("rank")} data-testid="bounty-tab-rankings">Rankings</button>
        <button type="button" className={tab === "castle" ? "on" : ""} onClick={() => setTab("castle")} data-testid="bounty-tab-castle">Castle</button>
        <span className="bounty-tokens" data-testid="bounty-token-count"><Coins size={14} /> {b.tokens}</span>
      </div>
      {tab === "castle" ? <CastleRankings meId={me.id} /> : tab === "rank" ? <BountyRankings meId={me.id} /> : tab === "bounties"
        ? <div className="bounty-list">{b.list.map((x) => <BountyRow key={x.id} b={x} send={send} engine={engine} at={b.at} />)}<p className="bounty-note">Party kills count. Bounties reset daily at midnight UTC.</p></div>
        : <TokenShop shop={b.shop} tokens={b.tokens} data={data} me={me} send={send} />}
    </Panel>
  );
}
