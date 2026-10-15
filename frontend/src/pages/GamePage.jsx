import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/api";
import { Engine } from "@/game/engine";
import { Net } from "@/game/net";
import { getState, setState, useStore, togglePanel, toast, resetState } from "@/game/store";
import { sfx } from "@/game/audio";
import { PlayerFrame, XpBar, TargetFrame, Hotbar, MenuBar, Toasts, Banners, ContextMenu, DialogWindow, InspectWindow } from "@/components/game/HUD";
import { InventoryPanel, CharacterPanel, SkillsPanel, QuestPanel } from "@/components/game/Panels";
import { MerchantWindow, SettingsPanel } from "@/components/game/Merchant";
import { Minimap, WorldMap, Chat } from "@/components/game/Maps";

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
          case "init": setState({ me: m.me, meAt: performance.now(), chat: m.chat, hp: m.me.hp, mp: m.me.mp }); break;
          case "me": setState({ me: m.me, meAt: performance.now() }); break;
          case "chat": setState((s) => ({ chat: [...s.chat.slice(-150), m.m] })); break;
          case "sys": toast(m.msg, m.kind || "info"); if (m.kind === "quest") sfx("loot"); break;
          case "err": toast(m.msg, "error"); sfx("error"); break;
          case "dialog": setState({ dialog: m, merchant: null }); sfx("open"); break;
          case "merchant": setState({ merchant: m, dialog: null }); break;
          case "trade": toast(m.msg, "good"); sfx("coin"); break;
          case "pickup": toast(`Picked up ${m.qty > 1 ? m.qty + "× " : ""}${d.data.items[m.item].name}`, "good"); sfx(m.item === "gold" ? "coin" : "loot"); break;
          case "equip": sfx("open"); break;
          case "levelup": setState({ levelup: m.lv }); setTimeout(() => setState({ levelup: null }), 3500); break;
          case "inspect": setState({ inspect: m.d }); break;
          default:
        }
      };
      net.current = new Net(localStorage.getItem("sx_token"), charId, onMsg);
      try {
        eng.current = new Engine({ canvas: canvas.current, overlay: overlay.current, data: d.data, world: w.data, net: net.current, meId: charId, quality: localStorage.getItem("sx_quality") || "high" });
      } catch (err) { console.error(err); setStep("WebGL failed to start. Please use a modern desktop browser with hardware acceleration."); return; }
      queue.forEach(handle);
      if (!dead) setReady(true);
    })().catch(() => setStep("Could not reach the world server."));
    return () => { dead = true; net.current?.close(); eng.current?.dispose(); eng.current = null; };
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
      if (action.startsWith("ability:")) { const ab = action.slice(8); if (!st.me.abilities.includes(ab)) { toast(`${data.abilities[ab].name} is locked.`, "error"); return; } n.send({ t: "cast", ab, id: eng.current?.targetId }); }
      else if (action === "attack_nearest") n.send({ t: "attack_nearest" });
      else if (action === "stop") n.send({ t: "stop" });
      else if (action === "chat") setState((s) => ({ chatFocus: (s.chatFocus || 0) + 1 }));
      else if (action === "menu") {
        const anyOpen = Object.values(st.panels).some(Boolean) || st.dialog || st.merchant || st.inspect || st.ctx;
        if (anyOpen) setState({ panels: {}, dialog: null, merchant: null, inspect: null, ctx: null }); else togglePanel("settings", true);
      } else { sfx("open"); togglePanel(action); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [data]);

  const logout = () => { net.current?.send({ t: "logout" }); setTimeout(() => nav("/characters"), 250); };
  const e = eng.current, n = net.current;
  return (
    <div className="game" data-testid="game-root">
      <canvas ref={canvas} className="game-canvas" data-testid="game-canvas" />
      <div ref={overlay} className="overlay" />
      {!ready && <div className="loading" data-testid="loading-screen"><h1 className="logo">Suminex</h1><div className="spinner" /><p>{step}</p></div>}
      {ready && data && <div className="hud">
        <PlayerFrame data={data} />
        <TargetFrame data={data} />
        <Minimap engine={e} />
        <Chat net={n} />
        <div className="bottom"><Hotbar data={data} net={n} engine={e} /><XpBar data={data} /></div>
        <MenuBar onLogout={logout} />
        <Toasts /><Banners />
        <ContextMenu net={n} />
        <DialogWindow net={n} data={data} />
        <InspectWindow data={data} />
        <MerchantWindow net={n} data={data} />
        {panels.inventory && <InventoryPanel data={data} net={n} />}
        {panels.character && <CharacterPanel data={data} net={n} />}
        {panels.skills && <SkillsPanel data={data} net={n} />}
        {panels.quests && <QuestPanel data={data} />}
        {panels.map && <WorldMap engine={e} />}
        {panels.settings && <SettingsPanel data={data} net={n} engine={e} />}
      </div>}
    </div>
  );
}
