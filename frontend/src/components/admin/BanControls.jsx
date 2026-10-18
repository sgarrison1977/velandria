import React, { useState } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const BanControls = ({ acc, tid, onChange, onMsg }) => {
  const [days, setDays] = useState("perm");
  const [reason, setReason] = useState("");
  const ban = async () => {
    if (!window.confirm(`Ban ${acc.email}? Any online characters will be kicked.`)) return;
    try { const r = await adminHttp.put(`/admin/accounts/${acc.id}/ban`, { days: days === "perm" ? null : Number(days), reason }); onMsg(r.data.message); setReason(""); onChange(); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  const unban = async () => {
    try { await adminHttp.delete(`/admin/accounts/${acc.id}/ban`); onMsg(`Unbanned ${acc.email}`); onChange(); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  if (acc.ban) return (
    <div className="admin-ban" data-testid={`admin-ban-status-${tid}`}>
      <span className="admin-tag ban">banned</span>
      <span className="admin-sub">{acc.ban.until ? `until ${new Date(acc.ban.until).toLocaleString()}` : "permanently"}{acc.ban.reason ? ` — ${acc.ban.reason}` : ""}</span>
      <button className="btn" onClick={unban} data-testid={`admin-unban-btn-${tid}`}>Unban</button>
    </div>
  );
  return (
    <div className="admin-ban">
      <select value={days} onChange={(e) => setDays(e.target.value)} data-testid={`admin-ban-duration-${tid}`}>
        <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="perm">Permanent</option>
      </select>
      <input placeholder="Reason (optional, shown to player)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} data-testid={`admin-ban-reason-${tid}`} />
      <button className="btn danger" onClick={ban} data-testid={`admin-ban-btn-${tid}`}>Ban Account</button>
    </div>
  );
};
