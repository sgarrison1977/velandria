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
  const toggle = () => put({ enabled: !d.enabled }, d.enabled ? "Bots disabled and removed from the world" : "Bots enabled — they'll log in within a few seconds");
  if (!d) return null;
  return (
    <div className="admin-bots" data-testid="admin-bots-panel">
      <b>Bot Players</b>
      <span className={`admin-tag ${d.enabled ? "" : "ban"}`} data-testid="admin-bots-status">{d.enabled ? "enabled" : "disabled"}</span>
      <span className="admin-sub">{d.bots.map((b) => `${b.name} (${b.cls} Lv ${b.level}${b.online ? ", online" : ""})`).join(" · ") || "not created yet"}</span>
      <label className="admin-sub">Count
        <select value={d.count} onChange={(e) => put({ count: Number(e.target.value) }, `Bot count set to ${e.target.value}`)} data-testid="admin-bots-count-select">
          {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <label className="admin-sub"><input type="checkbox" checked={d.chat} onChange={(e) => put({ chat: e.target.checked }, e.target.checked ? "Bots will chat occasionally" : "Bot chat off")} data-testid="admin-bots-chat-toggle" /> Bot chat</label>
      <button className={`btn ${d.enabled ? "danger" : ""}`} onClick={toggle} data-testid="admin-bots-toggle-btn">{d.enabled ? "Disable Bots" : "Enable Bots"}</button>
    </div>
  );
};
