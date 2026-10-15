"""Suminex gameplay regression (iteration 1): game data (minor_heal cd 0, Titus rename), character uniqueness,
WS validation (buy range, locked ability, no target, no mana, duplicate binds, level req), hover-cast (cast with id, no prior target),
combat/XP/loot pickup, quest accept via Elder Toman, minor heal spam (no cd), two-session chat + visibility."""
import asyncio, json, math, os, random, string, time
import pytest, requests, websockets
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
WS = API.replace("https://", "wss://").replace("http://", "ws://") + "/ws"
DB = MongoClient("mongodb://localhost:27017")["test_database"]
CREATED = []


def rnd(n=7):
    return "".join(random.choices(string.ascii_lowercase, k=n))


def new_char(cls="warrior", **fields):
    email = f"test_{rnd()}@x.io"
    tok = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    c = requests.post(f"{API}/characters", json={"name": "T" + rnd(), "cls": cls}, headers=h).json()
    if fields:
        DB.characters.update_one({"id": c["id"]}, {"$set": fields})
    CREATED.append((c["id"], h))
    return tok, c, h


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    time.sleep(1)
    for cid, h in CREATED:
        requests.delete(f"{API}/characters/{cid}", headers=h)


async def recv_for(ws, secs):
    end, out = time.time() + secs, []
    while time.time() < end:
        try:
            out.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=max(0.05, end - time.time()))))
        except asyncio.TimeoutError:
            break
    return out


def errs(msgs):
    return [m["msg"] for m in msgs if m["t"] == "err"]


def last_snap(msgs):
    s = [m for m in msgs if m["t"] == "s"]
    return s[-1] if s else None


def connect(tok, cid):
    return websockets.connect(f"{WS}?token={tok}&char={cid}", max_size=None)


# --- Game data
class TestGameData:
    def test_minor_heal_cd_zero(self):
        a = requests.get(f"{API}/game/data").json()["abilities"]["minor_heal"]
        assert a["cd"] == 0 and a["level"] == 2

    def test_titus_region(self):
        w = requests.get(f"{API}/game/world").json()
        assert w["regions"][0]["name"] == "Titus"
        assert "semel" not in json.dumps(w["regions"]).lower()

    def test_no_semel_in_display_text(self):
        d = requests.get(f"{API}/game/data").json()
        for grp in ("items", "npcs", "quests", "monsters", "merchants", "abilities"):
            for k, v in d[grp].items():
                for f in ("name", "desc", "text", "role"):
                    assert "semel" not in str(v.get(f, "")).lower(), (grp, k, f)

    def test_xp_table(self):
        d = requests.get(f"{API}/game/data").json()
        assert d["xp_table"][2] == 200 and d["xp_table"][3] == 1000


# --- Characters
class TestCharacters:
    def test_duplicate_name_rejected(self):
        tok, c, h = new_char()
        _, _, h2 = new_char()
        r = requests.post(f"{API}/characters", json={"name": c["name"].upper(), "cls": "mage"}, headers=h2)
        assert r.status_code in (400, 409), r.text

    def test_delete_char(self):
        _, c, h = new_char()
        assert requests.delete(f"{API}/characters/{c['id']}", headers=h).status_code == 200
        assert not any(x["id"] == c["id"] for x in requests.get(f"{API}/characters", headers=h).json())

    def test_me(self):
        tok = requests.post(f"{API}/auth/login", json={"email": "hero@suminex.io", "password": "hero1234"}).json()["token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200 and r.json()["email"] == "hero@suminex.io"


# --- WS validation
class TestWsValidation:
    def test_validation_errors(self):
        tok, c, _ = new_char("warrior")

        async def run():
            async with connect(tok, c["id"]) as ws:
                await recv_for(ws, 1.0)
                res = {}
                for key, msg in [("buy", {"t": "buy", "npc": "mira", "item": "minor_hp", "qty": 1}),
                                 ("locked", {"t": "cast", "ab": "cleave"}),
                                 ("notarget", {"t": "cast", "ab": "power_strike"}),
                                 ("lvl", {"t": "unlock", "ab": "minor_heal"}),
                                 ("binds", {"t": "binds", "binds": {"ability:power_strike": "Digit1", "inventory": "Digit1"}})]:
                    await ws.send(json.dumps(msg))
                    res[key] = errs(await recv_for(ws, 0.8))
                return res
        r = asyncio.run(run())
        print(r)
        assert "You must stand near the merchant." in r["buy"]
        assert any("locked" in e for e in r["locked"])
        assert "You need a target." in r["notarget"]
        assert "Requires level 2." in r["lvl"]
        assert "Duplicate key bindings are not allowed." in r["binds"]

    def test_no_mana(self):
        tok, c, _ = new_char("mage", x=92.0, z=110.0, mp=0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                msgs = await recv_for(ws, 1.0)
                s = last_snap(msgs)
                mons = [m for m in s["m"] if m[5] != 2]
                await ws.send(json.dumps({"t": "cast", "ab": "arcane_bolt", "id": mons[0][0] if mons else None}))
                return errs(await recv_for(ws, 0.8)), s["me"]
        e, me = asyncio.run(run())
        print(e, me)
        assert "Not enough mana." in e


# --- Hover-cast & combat
class TestCombat:
    def test_hover_cast_ranger_by_id(self):
        """Cast aimed_shot with id of a monster that was never targeted -> fx cast/dmg on that monster."""
        tok, c, _ = new_char("ranger", x=92.0, z=106.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                msgs = await recv_for(ws, 1.2)
                s = last_snap(msgs)
                me = s["me"]
                assert me[4] is None
                live = sorted([m for m in s["m"] if m[5] != 2], key=lambda m: math.hypot(m[2] - me[0], m[3] - me[1]))
                assert live, "no monsters near"
                mid = live[0][0]
                await ws.send(json.dumps({"t": "cast", "ab": "aimed_shot", "id": mid}))
                out = await recv_for(ws, 6.0)
                return mid, out, math.hypot(live[0][2] - me[0], live[0][3] - me[1])
        mid, out, d = asyncio.run(run())
        casts = [m for m in out if m["t"] == "fx" and m["k"] == "cast" and m.get("tgt") == mid]
        dmgs = [m for m in out if m["t"] == "fx" and m["k"] == "dmg" and m.get("tgt") == mid]
        print("dist", d, errs(out), len(casts), len(dmgs))
        assert casts, f"no cast fx at hovered monster; errs={errs(out)}"
        assert dmgs

    def test_kill_spider_xp_loot(self):
        tok, c, _ = new_char("warrior", x=96.0, z=98.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                s = last_snap(await recv_for(ws, 1.2))
                me = s["me"]
                live = sorted([m for m in s["m"] if m[5] != 2 and m[1] == "giant_spider" and m[6] == m[7]], key=lambda m: math.hypot(m[2] - me[0], m[3] - me[1]))
                assert live, "no spiders"
                mid = live[0][0]
                await ws.send(json.dumps({"t": "target", "id": mid}))
                out = await recv_for(ws, 25.0) if False else []
                end = time.time() + 30
                died = False
                while time.time() < end and not died:
                    chunk = await recv_for(ws, 1.0)
                    out += chunk
                    died = any(m["t"] == "fx" and m["k"] == "death" and m.get("tgt") == mid for m in chunk)
                out += await recv_for(ws, 1.0)
                s = last_snap(out)
                mine = [l for l in s["l"] if l[5] == 1]
                picked = []
                for l in mine[:2]:
                    await ws.send(json.dumps({"t": "pickup", "id": l[0]}))
                    picked += await recv_for(ws, 2.5)
                return died, out, mine, picked
        died, out, loot, picked = asyncio.run(run())
        xp = [m["msg"] for m in out if m["t"] == "sys" and "experience" in m["msg"]]
        print(died, xp, loot, [m for m in picked if m["t"] in ("pickup", "err")], errs(out)[:5])
        assert died, f"spider did not die; errs={errs(out)[:5]}"
        assert xp and "+10 experience" in xp[0]
        assert loot, "no loot owned by killer"
        assert any(m["t"] == "pickup" for m in picked)


# --- Quests & heal
class TestQuestHeal:
    def test_accept_spider_quest(self):
        tok, c, _ = new_char("warrior", x=85.0, z=205.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                await recv_for(ws, 1.0)
                await ws.send(json.dumps({"t": "npc", "id": "toman"}))
                a = await recv_for(ws, 3.0)
                await ws.send(json.dumps({"t": "npc", "id": "toman", "action": "accept:q_spiders"}))
                b = await recv_for(ws, 1.5)
                return a, b
        a, b = asyncio.run(run())
        dlg = [m for m in a if m["t"] == "dialog"]
        assert dlg and any(o["id"] == "accept:q_spiders" for o in dlg[0]["opts"]), errs(a)
        assert "Titus" in dlg[0]["text"]
        assert any(m["t"] == "sys" and "Quest accepted" in m["msg"] for m in b), errs(b)
        me = [m for m in b if m["t"] == "me"][-1]["me"]
        assert me["quests"]["q_spiders"]["s"] == "active"

    def test_minor_heal_no_cooldown(self):
        tok, c, _ = new_char("warrior", level=2, xp=200, skill_points=1, hp=20, x=92.0, z=150.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                await recv_for(ws, 1.0)
                await ws.send(json.dumps({"t": "unlock", "ab": "minor_heal"}))
                u = await recv_for(ws, 1.0)
                res = []
                for _ in range(3):
                    await ws.send(json.dumps({"t": "cast", "ab": "minor_heal"}))
                    res += await recv_for(ws, 0.35)
                return u, res
        u, res = asyncio.run(run())
        heals = [m for m in res if m["t"] == "fx" and m["k"] == "heal"]
        print(errs(u), errs(res), len(heals))
        assert any(m["t"] == "sys" and "learned" in m["msg"] for m in u), errs(u)
        assert not any("not ready" in e.lower() for e in errs(res)), errs(res)
        assert len(heals) == 3


# --- Two sessions
class TestMultiplayer:
    def test_chat_and_visibility(self):
        ta, ca, _ = new_char("warrior", x=90.0, z=195.0)
        tb, cb, _ = new_char("mage", x=92.0, z=195.0)
        text = f"TEST_hello_{rnd(4)}"

        async def run():
            async with connect(ta, ca["id"]) as wa, connect(tb, cb["id"]) as wb:
                await recv_for(wa, 1.0)
                sb = await recv_for(wb, 1.0)
                await wa.send(json.dumps({"t": "chat", "msg": text}))
                got = await recv_for(wb, 1.5)
                return sb + got
        msgs = asyncio.run(run())
        assert any(m["t"] == "chat" and m["m"].get("text") == text and m["m"].get("name") == ca["name"] for m in msgs)
        s = last_snap(msgs)
        assert any(p[0] == ca["id"] for p in s["p"])
