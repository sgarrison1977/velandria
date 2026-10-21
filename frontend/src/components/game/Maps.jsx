import React, { useEffect, useRef, useState } from "react";
import { useStore, setState, togglePanel } from "../../game/store";
import { Panel } from "./ui";

export function Minimap({ engine }) {
  const ref = useRef();
  const region = useStore((s) => s.region);
  useEffect(() => {
    if (!engine) return;
    const i = setInterval(() => { const c = ref.current; if (c) engine.drawMap(c.getContext("2d"), c.width, c.height, { radius: 60 }); }, 200);
    return () => clearInterval(i);
  }, [engine]);
  return (
    <div className="minimap" data-testid="minimap">
      <canvas ref={ref} width={190} height={190} onClick={() => togglePanel("map")} />
      <div className="minimap-label">{region}</div>
    </div>
  );
}

export function WorldMap({ engine }) {
  const ref = useRef();
  const [inset, setInset] = useState(false);
  const draw = () => { const c = ref.current; if (c && engine) engine.drawMap(c.getContext("2d"), c.width, c.height, { inset }); };
  useEffect(() => {
    if (!engine) return;
    draw(); const i = setInterval(draw, 700);
    return () => clearInterval(i);
  }, [engine, inset]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel title="Map of Velandria" testid="world-map" className="worldmap" onClose={() => togglePanel("map", false)}>
      <canvas ref={ref} width={engine?.world.w || 1100} height={engine?.world.oh || 400} data-testid="world-map-canvas" style={{ cursor: "crosshair" }}
        onClick={(e) => { const c = ref.current, r = c.getBoundingClientRect(); const p = engine?.mapToWorld((e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height); if (p) { engine.setWaypoint({ x: Math.round(p.x), z: Math.round(p.z) }); draw(); } }}
        onContextMenu={(e) => { e.preventDefault(); engine?.setWaypoint(null); draw(); }} />
      <div className="map-legend"><span><i style={{ background: "#ffd23a" }} />Merchant</span><span><i style={{ background: "#7aff9a" }} />Healer</span><span><i style={{ background: "#e0e0ff" }} />Townsfolk</span><span><i style={{ background: "#5ab0ff" }} />Players</span><span><i className="sq" />Safe square</span><span><i style={{ background: "#ffd36b" }} />Waypoint — click map to set, right-click to clear</span><button className="btn" data-testid="clear-waypoint-btn" onClick={() => { engine?.setWaypoint(null); draw(); }}>Clear waypoint</button><button className="btn" data-testid="toggle-dungeon-inset-btn" onClick={() => setInset(!inset)}>{inset ? "Hide" : "Show"} dungeons</button></div>
    </Panel>
  );
}

const fmt = (ts) => { try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
function ChatLine({ m }) {
  return (
    <div className={`cm cm-${m.kind}`}>
      <time>{fmt(m.ts)}</time>
      {m.kind === "world" && <><b className={`cls-${m.cls}`}>{m.name}</b><small>[{m.lvl}]</small>: </>}
      {m.kind === "whisper" && <b className="wh">{m.name} → {m.to}: </b>}
      {m.kind === "party" && <b className="pt">[Party] {m.name}: </b>}
      <span>{m.text}</span>
    </div>
  );
}

const FADE_MS = 30000;
export function Chat({ net }) {
  const chat = useStore((s) => s.chat), focus = useStore((s) => s.chatFocus), prefill = useStore((s) => s.chatPrefill), conn = useStore((s) => s.conn);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const inp = useRef();
  useEffect(() => { const iv = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (focus) { setOpen(true); if (prefill) { setText(prefill); setState({ chatPrefill: null }); } setTimeout(() => inp.current?.focus(), 0); } }, [focus]); // eslint-disable-line
  const send = () => {
    const t = text.trim();
    if (t) { if (!net.send({ t: "chat", msg: t })) setState((s) => ({ chat: [...s.chat, { kind: "error", text: "Not connected — message not sent.", ts: new Date().toISOString(), _at: Date.now() }] })); }
    setText(""); setOpen(false); inp.current?.blur();
  };
  const nowMs = Date.now();
  const shown = chat.slice(-5).filter((m) => open || (m._at && nowMs - m._at < FADE_MS));
  return (
    <div className={`chat ${open ? "open" : ""}`} data-testid="chat-window" onMouseDown={(e) => e.stopPropagation()}>
      <div className="chat-list" data-testid="chat-messages">
        {shown.map((m, i) => <div key={`${chat.length}-${i}`} className={!open && nowMs - m._at > FADE_MS - 3000 ? "cm-fade" : ""}><ChatLine m={m} /></div>)}
      </div>
      <input ref={inp} data-testid="chat-input" maxLength={200} value={text} placeholder={conn === "online" ? "Enter to chat · /w Name whisper · /p party · /who · H history · Esc cancel" : "Disconnected"}
        onFocus={() => setOpen(true)} onBlur={() => !text && setOpen(false)} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") send(); if (e.key === "Escape") { setText(""); setOpen(false); inp.current.blur(); } }} />
    </div>
  );
}

export function ChatHistory() {
  const chat = useStore((s) => s.chat);
  const list = useRef();
  const log = chat.filter((m) => m._at);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [log.length]);
  return (
    <Panel title="Chat History" testid="chat-history-panel" className="chat-history" onClose={() => togglePanel("chat_history", false)}>
      <div className="chat-history-list" ref={list} data-testid="chat-history-list">
        {log.length ? log.map((m, i) => <ChatLine key={i} m={m} />) : <p className="hint">No messages since you logged in.</p>}
      </div>
    </Panel>
  );
}
