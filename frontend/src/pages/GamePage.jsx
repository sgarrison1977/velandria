import React, { useEffect, useRef, useState } from "react";
import { PartyFrame, PartyInvite } from "../components/game/Party";
import { BuffBar, MarkPicker } from "../components/game/Spells";
import { StorageWindow } from "../components/game/Storage";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/api";
import { Engine } from "@/game/engine";
import { Net } from "@/game/net";
import { getState, setState, useStore, togglePanel, toast, resetState } from "@/game/store";
import { sfx } from "@/game/audio";
import { PlayerFrame, XpBar, TargetFrame, MenuBar, ExitButton, Toasts, Banners, ContextMenu, DialogWindow, InspectWindow } from "@/components/game/HUD";
import { InventoryPanel, CharacterPanel, SkillsPanel, QuestPanel } from "@/components/game/Panels";
import { MerchantWindow, SettingsPanel } from "@/components/game/Merchant";
import { Minimap, WorldMap, Chat } from "@/components/game/Maps";
import { LeaderboardPanel } from "@/components/game/Leaderboard";
import { AdminGivePanel } from "@/components/game/AdminGive";
import { getLootFilter } from "@/components/game/LootFilter";
import { BountyBoard } from "@/components/game/BountyBoard";

export default function GamePage() {
  const { charId } = useParams();
  const nav = useNavigate();
  const canvas = useRef(), overlay = useRef();
  const [data, setData] = useState(null);
  const [step, setStep] = useState("Summoning the world…");
  const [ready, setReady] = useState(false);
  const eng = useRef(null), net = useRef(null);
  const panels = useStore((s) => s.panels);

  useEffect(() => {
    let dead = false;
    resetState();
    (async () => {
      const [d, w] = await Promise.all([http.get("/game/data"), http.get("/game/world")]);
      if (dead) return;
      window.__SX_ITEMS = d.data.items;
      setData(d.data); setStep("Sculpting terrain and growing the forests…");
      await new Promise((r) => setTimeout(r, 60));
      const queue = [];
      const onMsg = (m) => {
        if (!eng.current) { queue.push(m); return; }
        handle(m);
      };
      const handle = (m) => {
        const e = eng.current;
        switch (m.t) {
          case "s": e.onSnapshot(m); break;
          case "fx": e.onFx(m); break;
          case "init": setState({ me: m.me, meAt: performance.now(), chat: m.chat, hp: m.me.hp, mp: m.me.mp }); { const lf = getLootFilter(); net.current?.send({ t: "autoloot", filter: lf.auto ? lf : null }); } break;
          case "me": setState({ me: m.me, meAt: performance.now() }); break;
          case "chat": setState((s) => ({ chat: [...s.chat.slice(-150), m.m] })); break;
          case "pong": setState((st) => { const v = Math.round(performance.now() - m.c); return { ping: st.ping ? Math.round(st.ping * 0.6 + v * 0.4) : v }; }); break;
          case "sys": toast(m.msg, m.kind || "info"); if (m.kind === "quest") sfx("loot"); break;
          case "err": toast(m.msg, "error"); sfx("error"); break;
          case "dialog": setState({ dialog: m, merchant: null }); sfx("open"); break;
          case "merchant": setState({ merchant: m, dialog: null }); break;
          case "storage": if (!m.sync || getState().storage) setState({ storage: m, dialog: null }); break;
          case "trade": toast(m.msg, "good"); sfx("coin"); break;
          case "pickup": toast(`Picked up ${m.qty > 1 ? m.qty + "× " : ""}${m.name || d.data.items[m.item]?.name}`, "good"); sfx(m.item === "gold" ? "coin" : "loot"); break;
          case "equip": sfx("open"); break;
          case "levelup": setState({ levelup: m.lv }); setTimeout(() => setState({ levelup: null }), 3500); break;
          case "announce": { const id = Date.now(); setState({ announce: { id, text: m.text } }); sfx("levelup"); setTimeout(() => getState().announce?.id === id && setState({ announce: null }), 8000); break; }
          case "bounty": setState({ bounty: m, dialog: null }); break;
          case "inspect": setState({ inspect: m.d }); break;
          case "party": e.party = m.id ? m : null; setState({ party: m.id ? m : null }); break;
          case "party_invite": setState({ partyInvite: m }); sfx("open"); break;
          default:
        }
      };
      net.current = new Net(localStorage.getItem("sx_token"), charId, onMsg);
      try {
        eng.current = new Engine({ canvas: canvas.current, overlay: overlay.current, data: d.data, world: w.data, net: net.current, meId: charId, quality: localStorage.getItem("sx_quality") || "high" });
        eng.current.setLootFilter(getLootFilter());
      } catch (err) { console.error(err); setStep("WebGL failed to start. Please use a modern desktop browser with hardware acceleration."); return; }
      queue.forEach(handle);
      if (!dead) setReady(true);
    })().catch(() => setStep("Could not reach the world server."));
    const onLf = (ev) => { eng.current?.setLootFilter(ev.detail); net.current?.send({ t: "autoloot", filter: ev.detail.auto ? ev.detail : null }); };
    window.addEventListener("sx-lootfilter", onLf);
    const pinger = setInterval(() => net.current?.send({ t: "ping", c: performance.now() }), 2000);
    return () => { dead = true; clearInterval(pinger); window.removeEventListener("sx-lootfilter", onLf); net.current?.close(); eng.current?.dispose(); eng.current = null; };
  }, [charId]);

  useEffect(() => {
    const down = (e) => {
      const st = getState();
      if (st.capture || !st.me) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const action = Object.keys(st.me.binds).find((k) => st.me.binds[k] === e.code);
      if (!action) return;
      e.preventDefault();
      const n = net.current;
      if (action.startsWith("ability:")) { if (e.repeat) return; const ab = action.slice(8); if (!st.me.abilities.includes(ab)) { toast(`${data.abilities[ab].name} is locked.`, "error"); return; } const ad = data.abilities[ab], hov = eng.current?.hover;
        const id = ad.kind === "melee" ? eng.current?.targetId : hov?.kind === "monster" && !hov.anim.dead ? hov.id : null;
        if (ad.kind === "portal") { setState({ markPick: true }); return; }
        const gp = ad.kind !== "melee" ? eng.current?.pointerGround() : null;
        n.send({ t: "cast", ab, id, pt: gp ? [gp.x, gp.z] : undefined }); }
      else if (action === "attack_nearest") { const hov = eng.current?.hover; if (hov?.kind === "monster" && !hov.anim.dead) n.send({ t: "target", id: hov.id }); else n.send({ t: "attack_nearest" }); }
      else if (action === "stop") n.send({ t: "stop", action: true });
      else if (action === "loot_all") n.send({ t: "loot_all", filter: getLootFilter() });
      else if (action.startsWith("item:")) { const it = action.slice(5), s = st.me.inventory.find((x) => x.item === it); if (s) n.send({ t: "use", uid: s.uid }); else toast(`You have no ${data.items[it].name} left.`, "error"); }
      else if (action === "chat") setState((s) => ({ chatFocus: (s.chatFocus || 0) + 1 }));
      else if (action === "menu") {
        const anyOpen = Object.values(st.panels).some(Boolean) || st.dialog || st.merchant || st.inspect || st.ctx || st.exitMenu || st.markPick || st.placing || st.storage || st.bounty;
        if (eng.current) eng.current.placing = null;
        if (anyOpen) setState({ panels: {}, dialog: null, merchant: null, inspect: null, ctx: null, exitMenu: false, markPick: false, placing: null, storage: null, bounty: null }); else togglePanel("settings", true);
      } else { sfx("open"); togglePanel(action); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [data]);

  const logout = (toMain) => { net.current?.send({ t: "logout" }); setTimeout(() => { if (toMain === true) localStorage.removeItem("sx_token"); nav(toMain === true ? "/" : "/characters"); }, 250); };
  const e = eng.current, n = net.current;
  return (
    <div className="game" data-testid="game-root" onDragOver={(ev) => { if (ev.dataTransfer.types.includes("text/sx-uid") && (ev.target === canvas.current || overlay.current?.contains(ev.target))) ev.preventDefault(); }}
      onDrop={(ev) => { const u = ev.dataTransfer.getData("text/sx-uid"); if (u && (ev.target === canvas.current || overlay.current?.contains(ev.target))) { ev.preventDefault(); sfx("loot"); net.current?.send({ t: "drop", uid: u }); } }}>
      <canvas ref={canvas} className="game-canvas" data-testid="game-canvas" />
      <div ref={overlay} className="overlay" />
      {!ready && <div className="loading" data-testid="loading-screen"><h1 className="logo">Velandria</h1><div className="spinner" /><p>{step}</p></div>}
      {ready && data && <div className="hud">
        <PlayerFrame data={data} />
        <TargetFrame data={data} />
        <Minimap engine={e} />
        <Chat net={n} />
        <div className="bottom"><XpBar data={data} /></div>
        <MenuBar onLogout={logout} />
        <ExitButton netRef={net} onLogout={logout} />
        <BuffBar data={data} />
        <MarkPicker net={n} engine={e} />
        <Toasts /><Banners />
        <ContextMenu net={n} />
        <PartyFrame net={n} data={data} />
        <PartyInvite net={n} />
        <DialogWindow net={n} data={data} />
        <InspectWindow data={data} />
        <MerchantWindow net={n} data={data} />
        <StorageWindow net={n} data={data} />
        <BountyBoard net={n} data={data} engine={e} />
        {panels.inventory && <InventoryPanel data={data} net={n} />}
        {panels.character && <CharacterPanel data={data} net={n} />}
        {panels.skills && <SkillsPanel data={data} net={n} />}
        {panels.quests && <QuestPanel data={data} />}
        {panels.map && <WorldMap engine={e} />}
        {panels.leaderboard && <LeaderboardPanel />}
        {panels.give && <AdminGivePanel data={data} net={n} />}
        {panels.settings && <SettingsPanel data={data} net={n} engine={e} />}
      </div>}
    </div>
  );
}
