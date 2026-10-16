import asyncio, json, requests, websockets, random, string, os
from pymongo import MongoClient
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
import sys; sys.path.insert(0, '/app/backend'); import game_data as g
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
API = "http://localhost:8001/api"; WS = "ws://localhost:8001/api/ws"
e = "t" + "".join(random.choices(string.ascii_lowercase, k=8)) + "@x.io"
tok = requests.post(f"{API}/auth/register", json={"email": e, "password": "secret123"}).json()["token"]
h = {"Authorization": "Bearer " + tok}
c = requests.post(f"{API}/characters", json={"name": "W" + "".join(random.choices(string.ascii_lowercase, k=7)), "cls": "warlock"}, headers=h).json()
print("created", c.get("cls"), c.get("detail"))
abil = [k for k, a in g.ABILITIES.items() if "warlock" in a["cls"]]
db.characters.update_one({"id": c["id"]}, {"$set": {"x": 90.0, "z": 192.0, "level": 12, "abilities": abil}})
async def drain(ws, n=40):
    out = []
    for _ in range(n):
        try: out.append(json.loads(await asyncio.wait_for(ws.recv(), 1.5)))
        except Exception: break
    return out
def show(ms, tag):
    print(tag, [m.get("msg") for m in ms if m["t"] in ("err", "sys")], [list(m["me"]["buffs"].keys()) for m in ms if m["t"] == "me"][-1:], [len(m["g"]) for m in ms if m["t"] == "s"][-1:])
async def main():
    async with websockets.connect(f"{WS}?token={tok}&char={c['id']}") as ws:
        await drain(ws, 5)
        await ws.send(json.dumps({"t": "chat", "msg": "mark3"})); show(await drain(ws), "mark")
        for ab in ("teuri", "velocitas", "robur", "contra_visus"):
            await ws.send(json.dumps({"t": "cast", "ab": ab}))
            show(await drain(ws, 15), ab)
        await ws.send(json.dumps({"t": "stop"})); show(await drain(ws), "stop")
        await ws.send(json.dumps({"t": "cast", "ab": "pergere_trans", "pt": [96, 192]})); r = await drain(ws, 15); show(r, "blink"); print([m["me"][:2] for m in r if m["t"] == "s"][-1:])
        await ws.send(json.dumps({"t": "cast", "ab": "creare_porta", "mark": "5", "pt": [95, 194]})); show(await drain(ws, 15), "portal-unset")
        await ws.send(json.dumps({"t": "cast", "ab": "creare_porta", "mark": "3", "pt": [94, 196]})); show(await drain(ws, 15), "portal")
        await ws.send(json.dumps({"t": "move", "x": 94, "z": 196})); r = await drain(ws, 40); print("after walk", [m["me"][:2] for m in r if m["t"] == "s"][-1:], [m.get("msg") for m in r if m["t"] == "sys"])
asyncio.run(main())
