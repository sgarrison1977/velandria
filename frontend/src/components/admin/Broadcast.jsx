import React, { useState } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const Broadcast = ({ onMsg }) => {
  const [text, setText] = useState("");
  const send = async (e) => {
    e.preventDefault();
    try { const r = await adminHttp.post("/admin/broadcast", { text }); onMsg(`Broadcast sent to ${r.data.online} online player${r.data.online === 1 ? "" : "s"}`); setText(""); }
    catch (x) { onMsg(errMsg(x), false); }
  };
  return (
    <form className="admin-broadcast" onSubmit={send} data-testid="admin-broadcast-form">
      <input placeholder="Server broadcast — shown as a banner to every online player…" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} data-testid="admin-broadcast-input" />
      <button className="btn" disabled={!text.trim()} data-testid="admin-broadcast-btn">Broadcast</button>
    </form>
  );
};
