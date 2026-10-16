import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { http, errMsg } from "@/lib/api";

export default function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(null);
  useEffect(() => {
    if (localStorage.getItem("sx_token")) http.get("/auth/me").then(() => nav("/characters")).catch(() => localStorage.removeItem("sx_token"));
    http.get("/game/status").then((r) => setOnline(r.data.online)).catch(() => {});
  }, [nav]);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data } = await http.post(`/auth/${mode}`, { email, password });
      localStorage.setItem("sx_token", data.token);
      nav("/characters");
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="title-screen" data-testid="auth-page">
      <div className="title-bg" style={{ backgroundImage: `linear-gradient(90deg, #0a0806ee 0%, #0a080677 55%, #0a0806dd 100%), url(${process.env.PUBLIC_URL}/title-bg.jpg)` }} />
      <div className="title-left">
        <h1 className="logo" data-testid="game-title">Titus Realms</h1>
        <p className="tagline">A persistent world of shadowed forests, ancient ruins and the long road between Titus and Elderglen.</p>
        <ul className="lore">
          <li>Real-time combat, the Hollow Deep dungeon and its boss</li>
          <li>Warrior, Mage or Ranger — up to level 100</li>
          <li>Four towns, parties, waystones, merchants and legendary loot</li>
        </ul>
        {online !== null && <div className="online" data-testid="online-count"><i /> {online} adventurer{online === 1 ? "" : "s"} in the world</div>}
      </div>
      <form className="auth-card" onSubmit={submit} data-testid="auth-form">
        <div className="tabs">
          <button type="button" data-testid="auth-tab-login" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Enter the World</button>
          <button type="button" data-testid="auth-tab-register" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Create Account</button>
        </div>
        <label>Email<input data-testid="auth-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input data-testid="auth-password-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {err && <div className="form-err" data-testid="auth-error">{err}</div>}
        <button className="btn big" data-testid="auth-submit-btn" disabled={busy}>{busy ? "…" : mode === "login" ? "Log In" : "Register"}</button>
        <p className="hint">Passwords are hashed with bcrypt. Accounts and characters persist on the server.</p>
      </form>
    </div>
  );
}
