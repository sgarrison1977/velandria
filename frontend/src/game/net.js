import { setState } from "./store";

export class Net {
  constructor(token, charId, onMsg) {
    this.token = token; this.charId = charId; this.onMsg = onMsg; this.retry = 0; this.closed = false;
    this.connect();
  }
  connect() {
    const base = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws");
    this.ws = new WebSocket(`${base}/api/ws?token=${encodeURIComponent(this.token)}&char=${encodeURIComponent(this.charId)}`);
    setState({ conn: this.retry ? "reconnecting" : "connecting" });
    this.ws.onopen = () => { this.retry = 0; setState({ conn: "online" }); };
    this.ws.onmessage = (ev) => { try { this.onMsg(JSON.parse(ev.data)); } catch (e) { console.error(e); } };
    this.ws.onclose = (ev) => {
      if (this.closed) return;
      if (ev.code === 4002) { setState({ conn: "kicked", connMsg: ev.reason || "You were removed from the world." }); return; }
      if (ev.code === 4001) { setState({ conn: "replaced" }); return; }
      if (ev.code === 4401 || ev.code === 4403) { setState({ conn: "denied" }); return; }
      this.retry++;
      setState({ conn: "reconnecting" });
      setTimeout(() => !this.closed && this.connect(), Math.min(8000, 500 * 2 ** this.retry));
    };
  }
  send(obj) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; }
    return false;
  }
  close() { this.closed = true; try { this.ws.close(); } catch (e) { /* noop */ } }
}
