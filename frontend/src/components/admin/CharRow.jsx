import React, { useState, useEffect } from "react";
import { adminHttp, fmtDur } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const CharRow = ({ c, onChange, onMsg }) => {
  const [level, setLevel] = useState(c.level);
  const [gold, setGold] = useState(c.gold);
  useEffect(() => { setLevel(c.level); setGold(c.gold); }, [c.level, c.gold]);
  const dirty = Number(level) !== c.level || Number(gold) !== c.gold;
  const tid = c.name.toLowerCase();
  const save = async () => {
    try { await adminHttp.put(`/admin/characters/${c.id}`, { level: Number(level), gold: Number(gold) }); onMsg(`Saved ${c.name}`); onChange(); }
    catch (e) { onMsg(errMsg(e)); }
  };
  const kick = async () => {
    const reason = window.prompt(`Kick ${c.name} from the world? Optional reason:`, "");
    if (reason === null) return;
    try { await adminHttp.post(`/admin/characters/${c.id}/kick`, reason.trim() ? { text: reason.trim() } : undefined); onMsg(`Kicked ${c.name}`); onChange(); }
    catch (e) { onMsg(errMsg(e)); }
  };
  const del = async () => {
    if (!window.confirm(`Delete character ${c.name}? This cannot be undone.`)) return;
    try { await adminHttp.delete(`/admin/characters/${c.id}`); onMsg(`Deleted ${c.name}`); onChange(); }
    catch (e) { onMsg(errMsg(e)); }
  };
  return (
    <tr data-testid={`admin-char-row-${tid}`}>
      <td className="gold-t">{c.name}</td>
      <td style={{ textTransform: "capitalize" }}>{c.cls}</td>
      <td><input type="number" min={1} max={100} value={level} onChange={(e) => setLevel(e.target.value)} data-testid={`admin-char-level-input-${tid}`} /></td>
      <td><input type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} data-testid={`admin-char-gold-input-${tid}`} /></td>
      <td data-testid={`admin-char-score-${tid}`}>{c.score}</td>
      <td data-testid={`admin-char-playtime-${tid}`}>{fmtDur(c.play_seconds)}</td>
      <td className={c.online ? "admin-online" : "admin-sub"}>{c.online ? "In world" : "Offline"}</td>
      <td><div className="admin-row-btns">
        <button className="btn" disabled={!dirty} onClick={save} data-testid={`admin-char-save-btn-${tid}`}>Save</button>
        {c.online && <button className="btn" onClick={kick} data-testid={`admin-char-kick-btn-${tid}`}>Kick</button>}
        <button className="btn danger" disabled={c.online} onClick={del} data-testid={`admin-char-delete-btn-${tid}`}>Delete</button>
      </div></td>
    </tr>
  );
};
