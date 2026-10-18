import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sword, Wand2, Crosshair, Trash2, Play, LogOut, Skull, Palette } from "lucide-react";
import { http, errMsg } from "@/lib/api";
import { CharPreview, LookPicker, eqString, defaultEquip, firstLook } from "@/components/game/Appearance";

function RestyleModal({ c, data, onClose, onSaved }) {
  const [look, setLook] = useState(c.look || firstLook(data.look_opts));
  const [err, setErr] = useState("");
  const save = async () => { try { await http.put(`/characters/${c.id}/look`, { look }); onSaved(); } catch (x) { setErr(errMsg(x)); } };
  return (
    <div className="look-modal" data-testid="restyle-modal">
      <div className="look-modal-box">
        <h2 className="sect">Appearance — {c.name}</h2>
        <div className="look-editor">
          <CharPreview cls={c.cls} eq={eqString(c.equipment, look)} items={data.items} />
          <LookPicker opts={data.look_opts} look={look} onChange={setLook} />
        </div>
        {err && <div className="form-err" data-testid="restyle-error">{err}</div>}
        <div className="row end">
          <button type="button" className="btn ghost" data-testid="restyle-cancel-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" data-testid="restyle-save-btn" onClick={save}>Save appearance</button>
        </div>
      </div>
    </div>
  );
}

const CLS = [["warrior", Sword], ["ranger", Crosshair], ["wizard", Wand2], ["warlock", Skull]];

export default function CharacterSelect() {
  const nav = useNavigate();
  const [chars, setChars] = useState(null);
  const [data, setData] = useState(null);
  const classes = data?.classes || {};
  const [look, setLook] = useState(null);
  const [restyle, setRestyle] = useState(null);
  const [name, setName] = useState("");
  const [cls, setCls] = useState("warrior");
  const [err, setErr] = useState("");
  const load = () => http.get("/characters").then((r) => setChars(r.data)).catch((e) => { if (e.response?.status === 401) { localStorage.removeItem("sx_token"); nav("/"); } });
  useEffect(() => { load(); http.get("/game/data").then((r) => { setData(r.data); setLook(firstLook(r.data.look_opts)); }); }, []); // eslint-disable-line
  const create = async (e) => {
    e.preventDefault(); setErr("");
    try { await http.post("/characters", { name, cls, look }); setName(""); load(); } catch (x) { setErr(errMsg(x)); }
  };
  const del = async (c) => {
    if (!window.confirm(`Delete ${c.name} forever?`)) return;
    try { await http.delete(`/characters/${c.id}`); load(); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <div className="title-screen chars" data-testid="character-select-page">
      <div className="title-bg" style={{ backgroundImage: `linear-gradient(90deg, #0a0806f2 0%, #0a0806cc 60%, #0a0806aa 100%), url(${process.env.PUBLIC_URL}/title-bg.jpg)` }} />
      <div className="char-wrap">
        <div className="char-top">
          <h1 className="logo small">Velandria</h1>
          <button type="button" className="btn ghost" data-testid="account-logout-btn" onClick={() => { localStorage.removeItem("sx_token"); nav("/"); }}><LogOut size={14} /> Log out</button>
        </div>
        <h2 className="sect">Your Characters</h2>
        <div className="char-list" data-testid="character-list">
          {chars && !chars.length && <p className="hint">No characters yet — forge one below.</p>}
          {chars?.map((c) => (
            <div key={c.id} className="char-card" data-testid={`character-card-${c.name}`}>
              <div className={`char-sigil cls-bg-${c.cls}`}>{React.createElement(CLS.find(([k]) => k === c.cls)[1], { size: 26 })}</div>
              <div className="char-info"><b>{c.name}</b><span>Level {c.level} {classes[c.cls]?.name} · {c.gold} gold</span></div>
              <button type="button" className="btn" data-testid={`play-${c.name}`} onClick={() => nav(`/play/${c.id}`)}><Play size={14} /> Play</button>
              <button type="button" className="btn ghost icon" title="Change appearance" data-testid={`restyle-${c.name}`} onClick={() => setRestyle(c)} disabled={!data}><Palette size={14} /></button>
              <button type="button" className="btn ghost icon" data-testid={`delete-${c.name}`} onClick={() => del(c)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <h2 className="sect">Forge a New Hero</h2>
        <form className="create" onSubmit={create} data-testid="create-character-form">
          <div className="class-pick">
            {CLS.map(([k, I]) => (
              <button type="button" key={k} data-testid={`class-${k}`} className={`class-card ${cls === k ? "on" : ""}`} onClick={() => setCls(k)}>
                <I size={30} /><b>{classes[k]?.name || k}</b><small>{classes[k]?.desc}</small>
                {classes[k] && <em>STR {classes[k].attrs.str} · STA {classes[k].attrs.sta} · WIS {classes[k].attrs.wis} · INT {classes[k].attrs.int} · DEX {classes[k].attrs.dex}</em>}
              </button>
            ))}
          </div>
          {data && look && (
            <div className="look-editor" data-testid="create-appearance">
              <CharPreview cls={cls} eq={eqString(defaultEquip(classes[cls]), look)} items={data.items} />
              <LookPicker opts={data.look_opts} look={look} onChange={setLook} />
            </div>
          )}
          <div className="row">
            <input data-testid="character-name-input" placeholder="Character name (3–16 letters)" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} required />
            <button className="btn big" data-testid="create-character-btn">Create</button>
          </div>
          {err && <div className="form-err" data-testid="character-error">{err}</div>}
        </form>
      </div>
      {restyle && data && <RestyleModal c={restyle} data={data} onClose={() => setRestyle(null)} onSaved={() => { setRestyle(null); load(); }} />}
    </div>
  );
}
