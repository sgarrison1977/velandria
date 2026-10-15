"""Suminex iteration-2 regression: mage hover-cast arcane_bolt by id, power_strike queue+chase, safe-square rejection,
merchant gold delta on buy/sell, minor heal repeat (cd 0) on a mage, hero+rival mutual visibility + world chat."""
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
    tok = requests.post(f"{API}/auth/register", json={"email": f"test_{rnd()}@x.io", "password": "secret123"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    c = requests.post(f"{API}/characters", json={"name": "T" + rnd(), "cls": cls}, headers=h).json()
    if fields:
        DB.characters.update_one({"id": c["id"]}, {"$set": fields})
    CREATED.append((c["id"], h))
    return tok, c


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


def snaps(msgs):
    return [m for m in msgs if m["t"] == "s"]


def connect(tok, cid):
    return websockets.connect(f"{WS}?token={tok}&char={cid}", max_size=None)


def login(email, pw):
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}).json()["token"]
    chars = requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {tok}"}).json()
    return tok, chars[0]


# --- Hover-cast: mage arcane_bolt with explicit id, never targeted
class TestMageHoverCast:
    def test_arcane_bolt_by_id(self):
        tok, c = new_char("mage", x=92.0, z=104.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                s = snaps(await recv_for(ws, 1.2))[-1]
                me = s["me"]
                assert me[4] is None
                live = sorted([m for m in s["m"] if m[5] != 2 and m[1] == "giant_spider"], key=lambda m: math.hypot(m[2] - me[0], m[3] - me[1]))
                assert live
                mid = live[0][0]
                await ws.send(json.dumps({"t": "cast", "ab": "arcane_bolt", "id": mid}))
                out = await recv_for(ws, 5.0)
                return mid, out
        mid, out = asyncio.run(run())
        assert any(m["t"] == "fx" and m["k"] == "cast" and m.get("ab") == "arcane_bolt" and m.get("tgt") == mid for m in out), errs(out)
        assert any(m["t"] == "fx" and m["k"] == "dmg" and m.get("tgt") == mid and m.get("dt") == "magic" for m in out)


# --- Melee: power_strike out of range -> queued, chase, strike
class TestPowerStrikeQueue:
    def test_queue_and_chase(self):
        tok, c = new_char("warrior", x=92.0, z=128.0)

        async def run():
            async with connect(tok, c["id"]) as ws:
                s = snaps(await recv_for(ws, 1.2))[-1]
                me = s["me"]
                live = sorted([m for m in s["m"] if m[5] != 2], key=lambda m: math.hypot(m[2] - me[0], m[3] - me[1]))
                far = next((m for m in live if math.hypot(m[2] - me[0], m[3] - me[1]) > 6), None)
                assert far, "no far monster"
                d0 = math.hypot(far[2] - me[0], far[3] - me[1])
                await ws.send(json.dumps({"t": "cast", "ab": "power_strike", "id": far[0]}))
                first = await recv_for(ws, 0.6)
                out = first + await recv_for(ws, 12.0)
                return far[0], d0, me, first, out
        mid, d0, me0, first, out = asyncio.run(run())
        assert not errs(first), errs(first)
        ss = snaps(first)
        assert ss and ss[-1]["me"][4] == mid, "target not set when queued"
        moved = max(math.hypot(s["me"][0] - me0[0], s["me"][1] - me0[1]) for s in snaps(out))
        assert moved > 2, f"did not chase ({moved})"
        assert any(m["t"] == "fx" and m["k"] == "cast" and m.get("ab") == "power_strike" and m.get("tgt") == mid for m in out), f"no strike fired (d0={d0:.1f}) errs={errs(out)}"


# --- Safe square: cannot fight (aoe_self) inside town
class TestSafeSquare:
    def test_cleave_in_safe_rejected(self):
        tok, c = new_char("warrior", x=90.0, z=196.0, level=5, xp=5000, abilities=["power_strike", "cleave"])

        async def run():
            async with connect(tok, c["id"]) as ws:
                await recv_for(ws, 1.0)
                await ws.send(json.dumps({"t": "cast", "ab": "cleave"}))
                return errs(await recv_for(ws, 1.0))
        e = asyncio.run(run())
        assert "You cannot fight from within a safe square." in e, e


# --- Merchant gold delta + minor heal spam on mage
class TestMerchantAndHeal:
    def test_buy_sell_gold(self):
        tok, c = new_char("warrior", x=100.0, z=191.0, gold=100)

        async def run():
            async with connect(tok, c["id"]) as ws:
                msgs = await recv_for(ws, 1.0)
                init = next(m["me"] for m in msgs if m["t"] == "init")
                await ws.send(json.dumps({"t": "npc", "id": "mira", "action": "trade"}))
                m1 = await recv_for(ws, 0.8)
                await ws.send(json.dumps({"t": "buy", "npc": "mira", "item": "minor_hp", "qty": 2}))
                m2 = await recv_for(ws, 0.8)
                bread = next(s for s in init["inventory"] if s["item"] == "bread")
                await ws.send(json.dumps({"t": "sell", "npc": "mira", "uid": bread["uid"], "qty": 1}))
                m3 = await recv_for(ws, 0.8)
                return init, m1, m2, m3
        init, m1, m2, m3 = asyncio.run(run())
        d = requests.get(f"{API}/game/data").json()
        price = d["items"]["minor_hp"]["price"]
        assert any(m["t"] == "merchant" for m in m1), errs(m1)
        g_after_buy = [m["me"]["gold"] for m in m2 if m["t"] == "me"][-1]
        assert g_after_buy == init["gold"] - 2 * price
        g_after_sell = [m["me"]["gold"] for m in m3 if m["t"] == "me"][-1]
        assert g_after_sell > g_after_buy

    def test_mage_minor_heal_repeat(self):
        tok, c = new_char("mage", x=92.0, z=140.0, level=2, xp=250, abilities=["arcane_bolt", "minor_heal"], hp=10)

        async def run():
            async with connect(tok, c["id"]) as ws:
                await recv_for(ws, 1.0)
                out = []
                for _ in range(3):
                    await ws.send(json.dumps({"t": "cast", "ab": "minor_heal"}))
                    out += await recv_for(ws, 0.4)
                return out
        out = asyncio.run(run())
        heals = [m for m in out if m["t"] == "fx" and m["k"] == "cast" and m.get("ab") == "minor_heal"]
        assert len(heals) == 3, f"heals={len(heals)} errs={errs(out)}"


# --- Multiplayer: hero + rival
class TestMultiplayer:
    def test_hero_rival_visibility_and_chat(self):
        ht, hc = login("hero@suminex.io", "hero1234")
        rt, rc = login("rival@suminex.io", "rival1234")

        async def run():
            async with connect(ht, hc["id"]) as a, connect(rt, rc["id"]) as b:
                await asyncio.gather(recv_for(a, 1.0), recv_for(b, 1.0))
                txt = "TEST_hello_" + rnd()
                await a.send(json.dumps({"t": "chat", "msg": txt}))
                ra, rb = await asyncio.gather(recv_for(a, 1.5), recv_for(b, 1.5))
                return txt, ra, rb
        txt, ra, rb = asyncio.run(run())
        assert any(m["t"] == "chat" and m["m"].get("text") == txt for m in ra)
        assert any(m["t"] == "chat" and m["m"].get("text") == txt for m in rb)
        sa, sb = snaps(ra)[-1], snaps(rb)[-1]
        ids_a, ids_b = {p[0] for p in sa["p"]}, {p[0] for p in sb["p"]}
        # only assert mutual visibility if within view range (85m)
        assert hc["id"] in ids_a
        if rc["id"] in ids_a:
            assert hc["id"] in ids_b
        print("hero sees rival:", rc["id"] in ids_a)
