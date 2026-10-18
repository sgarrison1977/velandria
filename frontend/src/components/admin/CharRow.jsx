import React, { useState } from "react";
import { adminHttp } from "@/lib/adminApi";
import { errMsg } from "@/lib/api";

export const CharRow = ({ c, onChange, onMsg }) => {
  const [level, setLevel] = useState(c.level);
  const [gold, setGold] = useState(c.gold);
  const dirty = Number(level) !== c.level || Number(gold) !== c.gold;
  const tid = c.name.toLowerCase();
  const save = async () => {
    try { await adminHttp.put(`/admin/characters/${c.id}`, { level: Number(level), gold: Number(gold) }); onMsg(`Saved ${c.name}`); onChange(); }
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
      <td><input type="number" min={1} max={100} value={level} disabled={c.online} onChange={(e) => setLevel(e.target.value)} data-testid={`admin-char-level-input-${tid}`} /></td>
      <td><input type="number" min={0} value={gold} disabled={c.online} onChange={(e) => setGold(e.target.value)} data-testid={`admin-char-gold-input-${tid}`} /></td>
      <td data-testid={`admin-char-score-${tid}`}>{c.score}</td>
      <td className={c.online ? "admin-online" : "admin-sub"}>{c.online ? "In world" : "Offline"}</td>
      <td><div className="admin-row-btns">
        <button className="btn" disabled={!dirty || c.online} onClick={save} data-testid={`admin-char-save-btn-${tid}`}>Save</button>
        <button className="btn danger" disabled={c.online} onClick={del} data-testid={`admin-char-delete-btn-${tid}`}>Delete</button>
      </div></td>
    </tr>
  );
};
