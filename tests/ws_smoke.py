import asyncio, json, sys, requests, websockets, random, string
API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001/api"
WS = API.replace("http", "ws") + "/ws"
def acct():
    e = "t" + "".join(random.choices(string.ascii_lowercase, k=8)) + "@x.io"
    r = requests.post(f"{API}/auth/register", json={"email": e, "password": "secret123"}).json()
    h = {"Authorization": "Bearer " + r["token"]}
    name = "T" + "".join(random.choices(string.ascii_lowercase, k=7))
    c = requests.post(f"{API}/characters", json={"name": name, "cls": "warrior"}, headers=h).json()
    return r["token"], c
async def main():
    tok, c = acct()
    async with websockets.connect(f"{WS}?token={tok}&char={c['id']}") as ws:
        init = None; n = 0
        while n < 30:
            m = json.loads(await ws.recv()); n += 1
            if m["t"] == "init": init = m["me"]; print("init lvl", init["level"], "hp", init["max_hp"], "pos", init["x"], init["z"])
            if m["t"] == "s" and n > 3: print("snap players", len(m["p"]), "monsters", len(m["m"])); break
        await ws.send(json.dumps({"t": "move", "x": 92, "z": 120}))
        for _ in range(40):
            m = json.loads(await ws.recv())
            if m["t"] == "err": print("ERR", m)
            if m["t"] == "s": me = m["me"]
        print("after move", me)
        await ws.send(json.dumps({"t": "buy", "npc": "mira", "item": "minor_hp", "qty": 1}))
        await ws.send(json.dumps({"t": "chat", "msg": "hello world"}))
        for _ in range(20):
            m = json.loads(await ws.recv())
            if m["t"] in ("err", "chat", "trade"): print(m["t"], m.get("msg") or m.get("m"))
asyncio.run(main())
