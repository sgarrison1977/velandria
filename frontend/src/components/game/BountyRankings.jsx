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
