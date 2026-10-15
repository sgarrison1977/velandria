import { useSyncExternalStore } from "react";

let state = { me: null, hp: 0, mp: 0, target: null, chat: [], panels: {}, dialog: null, merchant: null, inspect: null, ctx: null, toasts: [], conn: "connecting", region: "", fps: 0, levelup: null, capture: null };
const subs = new Set();
export const getState = () => state;
export const setState = (p) => { state = { ...state, ...(typeof p === "function" ? p(state) : p) }; subs.forEach((f) => f()); };
export const useStore = (sel) => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sel(state));
export const togglePanel = (k, v) => setState((s) => ({ panels: { ...s.panels, [k]: v ?? !s.panels[k] } }));
let tid = 0;
export const toast = (msg, kind = "info") => {
  const id = ++tid;
  setState((s) => ({ toasts: [...s.toasts.slice(-4), { id, msg, kind }] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
};
export const resetState = () => setState({ me: null, target: null, chat: [], panels: {}, dialog: null, merchant: null, inspect: null, ctx: null, toasts: [], conn: "connecting", levelup: null });
