import React, { useState, useEffect } from "react";
import { http, errMsg } from "@/lib/api";

const Row = ({ r, me }) => (
  <div className={`bounty-rank-row ${me ? "me" : ""}`} data-testid={`bounty-rank-row-${r.rank}`}>
    <span className="rk">{r.rank}</span><b>{r.name}</b><span className="cl">{r.cls}</span><span className="ct">{r.count}</span>
  </div>
);

export function BountyRankings({ meId }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => { http.get("/leaderboard/bounties").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  if (err) return <p className="form-err" data-testid="bounty-rankings-error">{err}</p>;
  if (!d) return <p className="bounty-note">Loading…</p>;
  const mine = d.mine.find((r) => r.id === meId);
  return (
    <div className="bounty-list" data-testid="bounty-rankings">
      <p className="bounty-note">Most bounties claimed this week · resets {new Date(d.resets_at).toLocaleString()}</p>
      {d.top.map((r) => <Row key={r.id} r={r} me={r.id === meId} />)}
      {!d.top.length && <p className="bounty-note" data-testid="bounty-rankings-empty">No bounties claimed yet this week. Be the first!</p>}
      {mine && !d.top.some((r) => r.id === meId) && <><p className="bounty-note">Your rank</p><Row r={mine} me /></>}
      {!mine && <p className="bounty-note" data-testid="bounty-rankings-mine">You haven't claimed a bounty this week.</p>}
    </div>
  );
}

const fmt = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
const RunRow = ({ r, me }) => (
  <div className={`bounty-rank-row castle-row ${me ? "me" : ""}`} data-testid={`castle-rank-row-${r.rank}`}>
    <span className="rk">{r.rank}</span><b>{r.members.map((m) => m.name).join(", ")}</b><span className="cl">{r.members.length > 1 ? `party of ${r.members.length}` : "solo"}</span><span className="ct">{fmt(r.secs)}</span>
  </div>
);

export function CastleRankings({ meId }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => { http.get("/leaderboard/castle").then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  if (err) return <p className="form-err" data-testid="castle-rankings-error">{err}</p>;
  if (!d) return <p className="bounty-note">Loading…</p>;
  const isMe = (r) => r.members.some((m) => m.id === meId);
  return (
    <div className="bounty-list" data-testid="castle-rankings">
      <p className="bounty-note">Fastest full clears of Castle Vexmoor this week — all 16 halls plus Lord Vexmoor. The clock starts at the gate; 2 minutes outside cancels the run. Resets {new Date(d.resets_at).toLocaleString()}.</p>
      {d.top.map((r) => <RunRow key={r.rank} r={r} me={isMe(r)} />)}
      {!d.top.length && <p className="bounty-note" data-testid="castle-rankings-empty">No one has conquered the castle this week.</p>}
      {d.mine && d.mine.rank > 10 && <><p className="bounty-note">Your best</p><RunRow r={d.mine} me /></>}
      {!d.mine && <p className="bounty-note" data-testid="castle-rankings-mine">You haven't completed a castle run this week.</p>}
    </div>
  );
}
