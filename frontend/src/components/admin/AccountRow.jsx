import React, { useState } from "react";
import { adminHttp, fmtDur } from "@/lib/adminApi";
import { BanControls } from "@/components/admin/BanControls";
import { errMsg } from "@/lib/api";
import { CharRow } from "@/components/admin/CharRow";

export const AccountRow = ({ acc, onChange, onMsg }) => {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const tid = acc.email.replace(/[^a-z0-9]/g, "-");
  const resetPw = async () => {
    try { await adminHttp.put(`/admin/accounts/${acc.id}/password`, { password: pw }); setPw(""); onMsg(`Password reset for ${acc.email}`); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  const del = async () => {
    if (!window.confirm(`Delete account ${acc.email} and all ${acc.characters.length} characters? This cannot be undone.`)) return;
    try { await adminHttp.delete(`/admin/accounts/${acc.id}`); onMsg(`Deleted ${acc.email}`); onChange(); }
    catch (e) { onMsg(errMsg(e), false); }
  };
  return (
    <div className={`admin-acc${acc.ban ? " banned" : ""}`} data-testid={`admin-account-${tid}`}>
      <button className="admin-acc-head" onClick={() => setOpen(!open)} data-testid={`admin-account-toggle-${tid}`}>
        <b>{acc.email} {acc.admin && <span className="admin-tag">admin</span>} {acc.ban && <span className="admin-tag ban">banned</span>}</b>
        <span className="admin-sub" title="Created">{acc.created_at ? new Date(acc.created_at).toLocaleDateString() : "—"}</span>
        <span className="admin-sub" data-testid={`admin-account-last-login-${tid}`}>Last: {acc.last_login ? new Date(acc.last_login).toLocaleString() : "never"}</span>
        <span className="admin-sub" data-testid={`admin-account-playtime-${tid}`}>Played {fmtDur(acc.play_seconds)}</span>
        <span className="admin-sub" data-testid={`admin-account-char-count-${tid}`}>{acc.characters.length} character{acc.characters.length === 1 ? "" : "s"}</span>
        <span className="admin-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="admin-acc-body">
          <div className="admin-pw">
            <span className="admin-sub">Password: <i>protected (bcrypt)</i></span>
            <input type="text" placeholder="New password (6+ chars)" value={pw} onChange={(e) => setPw(e.target.value)} data-testid={`admin-new-password-input-${tid}`} />
            <button className="btn" disabled={pw.length < 6} onClick={resetPw} data-testid={`admin-reset-password-btn-${tid}`}>Reset Password</button>
            <button className="btn danger" onClick={del} data-testid={`admin-delete-account-btn-${tid}`}>Delete Account</button>
          </div>
          <BanControls acc={acc} tid={tid} onChange={onChange} onMsg={onMsg} />
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Class</th><th>Level</th><th>Gold</th><th>Gear Score</th><th>Played</th><th>Status</th><th /></tr></thead>
            <tbody>
              {acc.characters.map((c) => <CharRow key={c.id} c={c} onChange={onChange} onMsg={onMsg} />)}
              {!acc.characters.length && <tr><td colSpan={8} className="admin-sub">No characters</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
