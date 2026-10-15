"""Second session (Lyssa) for cross-session chat test: listens for chats, sends one after delay."""
import asyncio, json, sys, time, requests, websockets
API = sys.argv[1]
WS = API.replace("https://", "wss://") + "/ws"
tok = requests.post(f"{API}/auth/login", json={"email": "rival@suminex.io", "password": "rival1234"}).json()["token"]
cid = next(c["id"] for c in requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {tok}"}).json() if c["name"] == "Lyssa")

async def main():
    async with websockets.connect(f"{WS}?token={tok}&char={cid}", max_size=None) as ws:
        t0, sent = time.time(), False
        while time.time() - t0 < float(sys.argv[2]):
            if not sent and time.time() - t0 > float(sys.argv[3]):
                await ws.send(json.dumps({"t": "chat", "msg": "LYSSA_PING from Elderglen"})); sent = True; print("SENT", flush=True)
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), 1))
            except asyncio.TimeoutError:
                continue
            if m["t"] in ("chat", "err"):
                print("RECV", m, flush=True)
asyncio.run(main())
