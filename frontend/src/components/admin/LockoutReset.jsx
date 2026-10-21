import React, { useState, useEffect, useCallback } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const LockoutReset = ({ onMsg }) => {
  const [d, setD] = useState(null);
  const load = useCallback(() => adminHttp.get("/admin/lockouts").then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const clear = async () => {
    try { const r = await adminHttp.delete("/admin/lockouts"); onMsg(`Admin login lockouts cleared (${r.data.cleared} record${r.data.cleared === 1 ? "" : "s"})`); load(); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  if (!d) return null;
  return (
    <div className="admin-lockouts" data-testid="admin-lockouts-panel">
      <b>Admin Login Lockouts</b>
      <span className="admin-sub" data-testid="admin-lockouts-count">{d.locked} locked out · {d.failed} with failed attempts</span>
      <button className="btn" onClick={clear} disabled={!d.failed} data-testid="admin-lockouts-clear-btn">Clear Lockouts</button>
    </div>
  );
};
