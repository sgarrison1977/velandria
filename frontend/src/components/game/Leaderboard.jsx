import React, { useEffect, useState } from "react";
import { Trophy, RefreshCw } from "lucide-react";
import { useStore, togglePanel } from "../../game/store";
import { Panel } from "./ui";
import { http } from "@/lib/api";

function Row({ r, me }) {
  return (
    <div className={`lb-row ${r.id === me.id ? "me" : ""} ${r.rank <= 3 ? `top${r.rank}` : ""}`} data-testid={`leaderboard-row-${r.rank}`}>
      <span className="lb-rank">{r.rank <= 3 ? <Trophy size={15} /> : null}{r.rank}</span>
      <span className="lb-name">{r.name}{r.online && <i className="lb-on" title="Online" />}</span>
      <span className="lb-cls">Lv {r.level} {r.cls}</span>
      <b className="lb-score" data-testid={`leaderboard-score-${r.rank}`}>{r.score.toLocaleString()}</b>
    </div>
  );
}

export function LeaderboardPanel() {
  const me = useStore((s) => s.me);
  const [lb, setLb] = useState(null), [err, setErr] = useState("");
  const load = () => http.get("/leaderboard/gear").then((r) => { setLb(r.data); setErr(""); }).catch(() => setErr("Could not load rankings."));
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  const mine = lb?.mine.find((r) => r.id === me.id);
  return (
    <Panel title="Gear Score Rankings" className="lb-panel" testid="leaderboard-panel" onClose={() => togglePanel("leaderboard", false)}>
      <div className="lb-head"><span>Top 10 of {lb?.total ?? "…"} heroes</span><button type="button" className="btn ghost icon" data-testid="leaderboard-refresh-btn" onClick={load}><RefreshCw size={14} /></button></div>
      {err && <div className="form-err">{err}</div>}
      <div className="lb-list">{lb?.top.map((r) => <Row key={r.id} r={r} me={me} />)}</div>
      {mine && mine.rank > 10 && <div className="lb-you"><Row r={mine} me={me} /></div>}
    </Panel>
  );
}
