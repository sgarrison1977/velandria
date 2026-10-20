import React, { useState, useEffect, useCallback } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const BotsControl = ({ onMsg }) => {
  const [d, setD] = useState(null);
  const load = useCallback(() => adminHttp.get("/admin/bots").then((r) => setD(r.data)).catch((e) => onMsg(errMsg(e), false)), [onMsg]);
  useEffect(() => { load(); }, [load]);
  const toggle = async () => {
    try { const r = await adminHttp.put("/admin/bots", { enabled: !d.enabled }); onMsg(r.data.enabled ? "Bots enabled — they'll log in within a few seconds" : "Bots disabled and removed from the world"); setTimeout(load, 2500); setD({ ...d, enabled: r.data.enabled }); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  if (!d) return null;
  return (
    <div className="admin-bots" data-testid="admin-bots-panel">
      <b>Bot Players</b>
      <span className={`admin-tag ${d.enabled ? "" : "ban"}`} data-testid="admin-bots-status">{d.enabled ? "enabled" : "disabled"}</span>
      <span className="admin-sub">{d.bots.map((b) => `${b.name} (${b.cls} Lv ${b.level}${b.online ? ", online" : ""})`).join(" · ") || "not created yet"}</span>
      <button className={`btn ${d.enabled ? "danger" : ""}`} onClick={toggle} data-testid="admin-bots-toggle-btn">{d.enabled ? "Disable Bots" : "Enable Bots"}</button>
    </div>
  );
};
