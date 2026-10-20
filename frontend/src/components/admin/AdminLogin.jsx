import React, { useState } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const AdminLogin = ({ onDone, onBack }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data } = await adminHttp.post("/admin/login", { username: username.trim(), password: password.trim() });
      sessionStorage.setItem("sx_admin", data.token);
      onDone();
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="admin-page admin-login-wrap" data-testid="admin-login-page">
      <form className="auth-card" onSubmit={submit} data-testid="admin-login-form">
        <h2 className="admin-title">Admin Login</h2>
        <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-testid="admin-username-input" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" data-testid="admin-password-input" /></label>
        {err && <div className="form-err" data-testid="admin-login-error">{err}</div>}
        <button className="btn big" disabled={busy} data-testid="admin-login-submit-btn">{busy ? "…" : "Enter"}</button>
        <button type="button" className="btn ghost" onClick={onBack} data-testid="admin-login-back-btn">Back to Title</button>
      </form>
    </div>
  );
};
