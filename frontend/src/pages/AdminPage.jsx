import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AccountRow } from "@/components/admin/AccountRow";
import { Broadcast } from "@/components/admin/Broadcast";

export default function AdminPage() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("sx_admin"));
  const [accounts, setAccounts] = useState(null);
  const [q, setQ] = useState("");
  const [msg, setMsgState] = useState(null);
  const setMsg = useCallback((text, ok = true) => setMsgState(text ? { text, ok } : null), []);
  const load = useCallback(() => {
    adminHttp.get("/admin/accounts").then((r) => setAccounts(r.data)).catch((e) => {
      if (e?.response?.status === 401) { sessionStorage.removeItem("sx_admin"); setAuthed(false); } else setMsg(errMsg(e), false);
    });
  }, [setMsg]);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  const logout = () => { sessionStorage.removeItem("sx_admin"); setAuthed(false); setAccounts(null); };
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} onBack={() => nav("/")} />;
  const s = q.trim().toLowerCase();
  const list = (accounts || []).filter((a) => !s || a.email.includes(s) || a.characters.some((c) => c.name.toLowerCase().includes(s)));
  const totalChars = (accounts || []).reduce((n, a) => n + a.characters.length, 0);
  return (
    <div className="admin-page" data-testid="admin-page">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Velandria — Keeper's Ledger</h1>
          <p className="admin-sub" data-testid="admin-stats">{accounts ? `${accounts.length} accounts · ${totalChars} characters` : "Loading…"}</p>
        </div>
        <div className="admin-actions">
          <input className="admin-search" placeholder="Search email or character…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-search-input" />
          <button className="btn ghost" onClick={load} data-testid="admin-refresh-btn">Refresh</button>
          <button className="btn ghost" onClick={() => nav("/")} data-testid="admin-home-btn">Title Screen</button>
          <button className="btn" onClick={logout} data-testid="admin-logout-btn">Log Out</button>
        </div>
      </header>
      <Broadcast onMsg={setMsg} />
      {msg && <div className={msg.ok ? "admin-ok" : "form-err"} data-testid="admin-message" onClick={() => setMsg(null)}>{msg.text}</div>}
      <div className="admin-list" data-testid="admin-accounts-list">
        {list.map((a) => <AccountRow key={a.id} acc={a} onChange={load} onMsg={setMsg} />)}
        {accounts && !list.length && <p className="admin-sub" data-testid="admin-empty">No accounts match.</p>}
      </div>
    </div>
  );
}
