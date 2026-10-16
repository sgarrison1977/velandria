import React, { useEffect, useState } from "react";
import { Backpack, User, Sparkles, Map as MapIcon, ScrollText, Settings as Cog, Coins, LogOut } from "lucide-react";
import { useStore, setState, togglePanel } from "../../game/store";
import { Bar, Panel, Hover, AbIcon } from "./ui";
import { sfx } from "../../game/audio";

export const keyLabel = (code) => !code ? "—" : code.replace(/^Key/, "").replace(/^Digit/, "").replace("Escape", "Esc").replace("Enter", "Enter").replace("Space", "Spc").replace(/^Arrow/, "");

export function useTick(ms = 100) {
  const [, set] = useState(0);
  useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

export function PlayerFrame({ data }) {
  const me = useStore((s) => s.me), hp = useStore((s) => s.hp), mp = useStore((s) => s.mp);
  if (!me) return null;
  const xt = data.xp_table, lo = xt[me.level], hi = xt[Math.min(me.level + 1, data.max_level)];
  return (
    <div className="pframe" data-testid="player-frame">
      <div className="pframe-crest"><span data-testid="player-level">{me.level}</span></div>
      <div className="pframe-main">
        <div className="pframe-name"><b data-testid="player-name">{me.name}</b><em>{data.classes[me.cls].name}</em></div>
        <Bar value={hp} max={me.max_hp} kind="hp" testid="player-hp-bar" />
        <Bar value={mp} max={me.max_mp} kind="mp" testid="player-mp-bar" />
        <div className="pframe-buffs">{Object.entries(me.buffs || {}).map(([k]) => <span key={k} className="buff">{k === "armor" ? "Iron Guard" : "Quickstep"}</span>)}</div>
      </div>
    </div>
  );
}

export function XpBar({ data }) {
  const me = useStore((s) => s.me);
  if (!me) return null;
  const xt = data.xp_table, lo = xt[me.level], hi = xt[Math.min(me.level + 1, data.max_level)];
  const max = me.level >= data.max_level;
  return (
    <div className="xpbar" data-testid="xp-bar">
      <i style={{ width: `${max ? 100 : ((me.xp - lo) / (hi - lo)) * 100}%` }} />
      <span data-testid="xp-text">{max ? "Max level" : `XP ${me.xp.toLocaleString()} / ${hi.toLocaleString()} (lifetime) · ${(((me.xp - lo) / (hi - lo)) * 100).toFixed(1)}%`}</span>
    </div>
  );
}

export function TargetFrame({ data }) {
  const t = useStore((s) => s.target);
  if (!t) return null;
  const md = data.monsters[t.type];
  return (
    <div className="tframe" data-testid="target-frame">
      <div className="tframe-name"><b data-testid="target-name">{t.name}</b><em>Level {t.level}</em></div>
      <Bar value={t.hp} max={t.max} kind="enemy" testid="target-hp-bar" />
      {md && <div className="tframe-sub">{md.ranged ? "Ranged caster" : md.poison ? "Venomous" : md.regen ? "Regenerates" : "Melee"} · {md.xp} xp</div>}
    </div>
  );
}

export function Hotbar({ data, net, engine }) {
  const me = useStore((s) => s.me), mp = useStore((s) => s.mp), meAt = useStore((s) => s.meAt);
  useTick(100);
  if (!me) return null;
  const list = Object.entries(data.abilities).filter(([, a]) => a.cls.includes(me.cls));
  const el = (performance.now() - (meAt || 0)) / 1000;
  return (
    <div className="hotbar" data-testid="hotbar">
      {list.map(([id, a]) => {
        const unlocked = me.abilities.includes(id);
        const cd = Math.max(0, (me.cds?.[id] || 0) - el);
        const noMana = mp < a.cost;
        return (
          <Hover key={id} tip={<div className="tip"><div className="tip-name">{a.name}</div><div className="tip-meta">{a.cost} mana · {a.cd}s cooldown{a.range ? ` · ${a.range}m` : ""}</div><div className="tip-desc">{a.desc}</div>{!unlocked && <div className="down">Locked — requires level {a.level} and a skill point (open Skills)</div>}</div>}>
            <button type="button" data-testid={`hotbar-${id}`} className={`slot ${unlocked ? "" : "locked"} ${noMana && unlocked ? "nomana" : ""}`}
              onClick={() => { if (unlocked) net.send({ t: "cast", ab: id, id: engine?.targetId }); else togglePanel("skills", true); }}>
              <AbIcon id={id} />
              <span className="slot-key">{keyLabel(me.binds[`ability:${id}`])}</span>
              {cd > 0 && <span className="slot-cd" style={{ height: `${(cd / a.cd) * 100}%` }}><b>{cd.toFixed(cd < 3 ? 1 : 0)}</b></span>}
              {!unlocked && <span className="slot-lock">Lv {a.level}</span>}
            </button>
          </Hover>
        );
      })}
    </div>
  );
}

const MENU = [["inventory", Backpack, "Inventory"], ["character", User, "Character"], ["skills", Sparkles, "Skills"], ["quests", ScrollText, "Quests"], ["map", MapIcon, "World Map"], ["settings", Cog, "Settings"]];
export function MenuBar({ onLogout }) {
  const me = useStore((s) => s.me), panels = useStore((s) => s.panels);
  if (!me) return null;
  const ab = { inventory: "inventory", character: "character", skills: "skills", quests: "quests", map: "map", settings: "menu" };
  return (
    <div className="menubar">
      <div className="gold" data-testid="currency-display"><Coins size={15} /> {me.gold.toLocaleString()}</div>
      {MENU.map(([k, I, label]) => (
        <button key={k} type="button" data-testid={`menu-${k}-btn`} className={`mbtn ${panels[k] ? "on" : ""}`} title={`${label} (${keyLabel(me.binds[ab[k]])})`} onClick={() => { sfx("open"); togglePanel(k); }}>
          <I size={18} />{(k === "character" && me.attr_points > 0) || (k === "skills" && me.skill_points > 0) ? <span className="pip" /> : null}
        </button>
      ))}
      <button type="button" className="mbtn" data-testid="logout-btn" title="Exit game" onClick={() => setState({ exitMenu: true })}><LogOut size={18} /></button>
    </div>
  );
}

export function ExitButton({ onLogout }) {
  const open = useStore((s) => s.exitMenu);
  return (
    <>
      <button type="button" className="exit-btn" data-testid="exit-game-btn" onMouseDown={(e) => e.stopPropagation()} onClick={() => setState({ exitMenu: true })}><LogOut size={14} /> Exit</button>
      {open && <div className="exit-modal" data-testid="exit-menu" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Leave Eryndovar?</h3>
        <p>Your character, items and progress are saved automatically.</p>
        <button type="button" className="btn" data-testid="exit-to-characters-btn" onClick={() => onLogout(false)}>Character Select</button>
        <button type="button" className="btn" data-testid="exit-to-main-btn" onClick={() => onLogout(true)}>Main Screen (log out)</button>
        <button type="button" className="btn ghost" data-testid="exit-cancel-btn" onClick={() => setState({ exitMenu: false })}>Return to game</button>
      </div>}
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return <div className="toasts" data-testid="toasts">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.msg}</div>)}</div>;
}

export function Banners() {
  const region = useStore((s) => s.region), conn = useStore((s) => s.conn), lv = useStore((s) => s.levelup), fps = useStore((s) => s.fps);
  const [show, setShow] = useState(region);
  useEffect(() => { setShow(region); const t = setTimeout(() => setShow(""), 3500); return () => clearTimeout(t); }, [region]);
  return (
    <>
      {show && <div className="region-banner" data-testid="region-banner" key={show}>{show}</div>}
      {conn !== "online" && <div className="conn-banner" data-testid="connection-status">{{ connecting: "Connecting to the world…", reconnecting: "Connection lost — reconnecting…", replaced: "This character was opened in another session.", denied: "Session expired. Please log in again." }[conn]}</div>}
      {lv && <div className="levelup" data-testid="levelup-banner"><small>Level Up</small><b>{lv}</b><em>+1 attribute point · +3 skill points</em></div>}
      <div className="hud-meta"><span data-testid="region-name">{region}</span> · {fps} fps</div>
    </>
  );
}

export function ContextMenu({ net }) {
  const c = useStore((s) => s.ctx);
  if (!c) return null;
  const close = () => setState({ ctx: null });
  return (
    <div className="ctxmenu" style={{ left: c.x, top: c.y }} data-testid="context-menu" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ctx-title">{c.name}{c.level ? ` · Lv ${c.level}` : ""}</div>
      {c.kind === "player" && <>
        <button type="button" data-testid="ctx-inspect" onClick={() => { net.send({ t: "inspect", id: c.id }); close(); }}>Inspect character</button>
        <button type="button" data-testid="ctx-equipment" onClick={() => { net.send({ t: "inspect", id: c.id }); close(); }}>View equipment</button>
        <button type="button" data-testid="ctx-party-invite" onClick={() => { net.send({ t: "party_invite", id: c.id }); close(); }}>Invite to party</button>
        <button type="button" data-testid="ctx-whisper" onClick={() => { setState((s) => ({ ctx: null, chatPrefill: `/w ${c.name} `, chatFocus: (s.chatFocus || 0) + 1 })); }}>Send private message</button>
      </>}
      {c.kind === "monster" && <>
        <button type="button" data-testid="ctx-attack" onClick={() => { net.send({ t: "target", id: c.id }); close(); }}>Attack</button>
        <div className="ctx-note">A {c.name.toLowerCase()} of level {c.level}.</div>
      </>}
      {c.kind === "npcinfo" && <div className="ctx-note">{c.role} of the town. They have nothing to trade.</div>}
      <button type="button" onClick={close}>Close</button>
    </div>
  );
}

export function DialogWindow({ net, data }) {
  const d = useStore((s) => s.dialog);
  if (!d) return null;
  const npc = data.npcs[d.npc];
  return (
    <Panel title={npc.name} testid="npc-dialog" className="dialog" onClose={() => setState({ dialog: null })}>
      <div className="dialog-role">{npc.role}</div>
      <p className="dialog-text">"{d.text}"</p>
      {d.opts.map((o) => (
        <div key={o.id} className="dialog-opt">
          {o.text && <p className="dialog-quest">{o.text}</p>}
          <button type="button" className="btn" data-testid={`dialog-opt-${o.id.replace(":", "-")}`} onClick={() => { sfx("click"); net.send({ t: "npc", id: d.npc, action: o.id }); if (o.id !== "trade") setState({ dialog: null }); }}>{o.label}</button>
        </div>
      ))}
      <button type="button" className="btn ghost" data-testid="dialog-goodbye" onClick={() => setState({ dialog: null })}>Farewell</button>
    </Panel>
  );
}

export function InspectWindow({ data }) {
  const d = useStore((s) => s.inspect);
  if (!d) return null;
  return (
    <Panel title={`${d.name}`} testid="inspect-window" className="inspect" onClose={() => setState({ inspect: null })}>
      <div className="dialog-role">Level {d.level} {data.classes[d.cls].name} · {d.max_hp} HP · {d.armor} armor</div>
      <div className="inspect-stats">{Object.entries(d.tot).map(([k, v]) => <span key={k}>{k.toUpperCase()} <b>{v}</b></span>)}</div>
      <div className="inspect-eq">{Object.entries(d.equipment).map(([slot, id]) => <div key={slot}><em>{slot}</em> <span style={{ color: `var(--r-${data.items[id].rarity})` }}>{data.items[id].name}</span></div>)}</div>
    </Panel>
  );
}
