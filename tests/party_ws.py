import asyncio, json, requests, websockets
API = "http://localhost:8001/api"; WS = "ws://localhost:8001/api/ws"
def login(e, pw, name):
    tok = requests.post(f"{API}/auth/login", json={"email": e, "password": pw}).json()["token"]
    cs = requests.get(f"{API}/characters", headers={"Authorization": "Bearer " + tok}).json()
    c = next(c for c in (cs if isinstance(cs, list) else cs["characters"]) if c["name"] == name)
    return tok, c["id"]
async def drain(ws, n=30, want=()):
    out = []
    for _ in range(n):
        try: m = json.loads(await asyncio.wait_for(ws.recv(), 2))
        except Exception: break
        if m["t"] in want: out.append(m)
    return out
async def main():
    t1, c1 = login("hero@suminex.io", "hero1234", "Aldric"); t2, c2 = login("rival@suminex.io", "rival1234", "Lyssa")
    async with websockets.connect(f"{WS}?token={t1}&char={c1}") as a, websockets.connect(f"{WS}?token={t2}&char={c2}") as b:
        await drain(a, 5); await drain(b, 5)
        await a.send(json.dumps({"t": "party_invite", "id": c2}))
        print("invite", [m["from"] for m in await drain(b, 30, ("party_invite",))])
        await b.send(json.dumps({"t": "party_accept"}))
        r = await drain(a, 30, ("party", "sys"))
        print("party", [(m["t"], m.get("msg") or [x["name"] for x in m["members"]]) for m in r][:4])
        await b.send(json.dumps({"t": "chat", "msg": "/p hello party"}))
        print("pchat", [m["m"]["text"] for m in await drain(a, 30, ("chat",)) if m["m"]["kind"] == "party"])
        await b.send(json.dumps({"t": "party_leave"}))
        print("leave", [m.get("msg") for m in await drain(a, 30, ("sys",))])
        await a.send(json.dumps({"t": "npc", "id": "ws_titus", "action": "talk"}))
        await asyncio.sleep(1.5)
        d = await drain(a, 30, ("dialog", "err"))
        print("dialog", [[o["label"] for o in m.get("opts", [])] or m.get("msg") for m in d])
        await a.send(json.dumps({"t": "npc", "id": "ws_titus", "action": "travel:elderglen"}))
        print("travel", [m.get("msg") for m in await drain(a, 30, ("trade", "err"))])
asyncio.run(main())
