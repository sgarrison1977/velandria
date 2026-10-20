import React, { useState, useEffect, useCallback } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const BotsControl = ({ onMsg }) => {
  const [d, setD] = useState(null);
  const load = useCallback(() => adminHttp.get("/admin/bots").then((r) => setD(r.data)).catch((e) => onMsg(errMsg(e), false)), [onMsg]);
  useEffect(() => { load(); }, [load]);
  const put = async (body, msg) => {
    try { const r = await adminHttp.put("/admin/bots", body); setD((x) => ({ ...x, ...r.data })); onMsg(msg); setTimeout(load, 3000); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  const act = async (b, kind) => {
    if (kind === "reset" && !window.confirm(`Reset ${b.name} to a fresh level 1 character? Level, XP, gear and gold will be wiped.`)) return;
    try { await adminHttp.post(`/admin/bots/${b.id}/${kind}`); onMsg(kind === "reset" ? `${b.name} reset to level 1` : `${b.name} teleported to town`); setTimeout(load, 1500); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  const toggle = () => put({ enabled: !d.enabled }, d.enabled ? "Bots disabled and removed from the world" : "Bots enabled — they'll log in within a few seconds");
  if (!d) return null;
  return (
    <div className="admin-bots" data-testid="admin-bots-panel">
      <b>Bot Players</b>
      <span className={`admin-tag ${d.enabled ? "" : "ban"}`} data-testid="admin-bots-status">{d.enabled ? "enabled" : "disabled"}</span>
      {!d.bots.length && <span className="admin-sub">not created yet</span>}
      <label className="admin-sub">Count
        <select value={d.count} onChange={(e) => put({ count: Number(e.target.value) }, `Bot count set to ${e.target.value}`)} data-testid="admin-bots-count-select">
          {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <label className="admin-sub"><input type="checkbox" checked={d.chat} onChange={(e) => put({ chat: e.target.checked }, e.target.checked ? "Bots will chat occasionally" : "Bot chat off")} data-testid="admin-bots-chat-toggle" /> Bot chat</label>
      <button className={`btn ${d.enabled ? "danger" : ""}`} onClick={toggle} data-testid="admin-bots-toggle-btn">{d.enabled ? "Disable Bots" : "Enable Bots"}</button>
      {d.bots.length > 0 && (
        <div className="admin-bot-list" data-testid="admin-bot-list">
          {d.bots.map((b) => (
            <div className="admin-bot-row" key={b.id} data-testid={`admin-bot-row-${b.id}`}>
              <span>{b.name}</span>
              <span className="admin-sub">{b.cls} · Lv {b.level}{b.online ? " · online" : ""}</span>
              <button className="btn" disabled={!b.online} onClick={() => act(b, "teleport")} data-testid={`admin-bot-teleport-${b.id}`}>Teleport to Town</button>
              <button className="btn danger" onClick={() => act(b, "reset")} data-testid={`admin-bot-reset-${b.id}`}>Reset to Lv 1</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
