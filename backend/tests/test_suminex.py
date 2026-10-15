"""Suminex regression: REST auth/characters + WebSocket movement (hold-walk), stop, merchant buy, invalid actions, chat."""
import asyncio, json, math, os, random, string, time
import pytest, requests, websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
WS = API.replace("https://", "wss://").replace("http://", "ws://") + "/ws"


def rnd(n=7):
    return "".join(random.choices(string.ascii_lowercase, k=n))


@pytest.fixture(scope="module")
def fresh():
    email = f"test_{rnd()}@x.io"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    c = requests.post(f"{API}/characters", json={"name": "T" + rnd(), "cls": "warrior"}, headers=h)
    assert c.status_code == 200, c.text
    yield {"token": tok, "h": h, "char": c.json(), "email": email}
    requests.delete(f"{API}/characters/{c.json()['id']}", headers=h)


# --- Auth
class TestAuth:
    def test_login_hero(self):
        r = requests.post(f"{API}/auth/login", json={"email": "hero@suminex.io", "password": "hero1234"})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and d["user"]["email"] == "hero@suminex.io"

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": f"nouser_{rnd()}@x.io", "password": "wrongpass1"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        assert requests.get(f"{API}/auth/me").status_code in (401, 403)

    def test_hero_has_aldric(self):
        tok = requests.post(f"{API}/auth/login", json={"email": "hero@suminex.io", "password": "hero1234"}).json()["token"]
        chars = requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {tok}"}).json()
        assert any(c["name"] == "Aldric" and c["cls"] == "warrior" for c in chars)


# --- Characters
class TestCharacters:
    def test_create_and_list(self, fresh):
        chars = requests.get(f"{API}/characters", headers=fresh["h"]).json()
        assert any(c["id"] == fresh["char"]["id"] for c in chars)
        assert "_id" not in chars[0]

    def test_invalid_class_and_name(self, fresh):
        assert requests.post(f"{API}/characters", json={"name": "Good" + rnd(3), "cls": "bard"}, headers=fresh["h"]).status_code == 400
        assert requests.post(f"{API}/characters", json={"name": "1x", "cls": "mage"}, headers=fresh["h"]).status_code == 400

    def test_game_endpoints(self):
        assert "online" in requests.get(f"{API}/game/status").json()
        d = requests.get(f"{API}/game/data").json()
        assert "npcs" in d and "monsters" in d and "items" in d
        w = requests.get(f"{API}/game/world").json()
        assert "regions" in w


# --- WebSocket helpers
async def drain_until_snap(ws, timeout=5):
    end = time.time() + timeout
    last, errs, others = None, [], []
    while time.time() < end:
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), timeout=max(0.05, end - time.time())))
        except asyncio.TimeoutError:
            break
        if m["t"] == "s":
            last = m["me"]
        elif m["t"] == "err":
            errs.append(m["msg"])
        else:
            others.append(m)
    return last, errs, others


async def collect(ws, secs):
    return await drain_until_snap(ws, secs)


async def hold_walk_scenario(tok, cid):
    async with websockets.connect(f"{WS}?token={tok}&char={cid}", max_size=None) as ws:
        init = None
        for _ in range(50):
            m = json.loads(await ws.recv())
            if m["t"] == "init":
                init = m["me"]
                break
        assert init
        me, _, _ = await collect(ws, 1.0)
        x0, z0 = me[0], me[1]
        # Hold-walk east (+x) for 3s: resend 7m-ahead target every 150ms like the client
        t_end = time.time() + 3.0
        cur = (x0, z0)
        errs = []
        while time.time() < t_end:
            await ws.send(json.dumps({"t": "move", "x": round(cur[0] + 7, 2), "z": round(cur[1], 2), "hold": 1}))
            snap, e, _ = await collect(ws, 0.15)
            errs += e
            if snap:
                cur = (snap[0], snap[1])
        moved = math.hypot(cur[0] - x0, cur[1] - z0)
        await ws.send(json.dumps({"t": "stop"}))
        s1, _, _ = await collect(ws, 0.5)
        s2, _, _ = await collect(ws, 1.0)
        after_stop = math.hypot(s2[0] - s1[0], s2[1] - s1[1])
        return dict(x0=x0, z0=z0, end=cur, moved=moved, after_stop=after_stop, errs=errs, init=init)


# --- WebSocket gameplay
class TestWebSocket:
    def test_hold_walk_and_stop(self, fresh):
        r = asyncio.run(hold_walk_scenario(fresh["token"], fresh["char"]["id"]))
        print(r)
        assert 9 <= r["moved"] <= 17, f"hold-walk distance {r['moved']:.2f}"
        assert r["after_stop"] < 0.2, f"still moving after stop: {r['after_stop']:.2f}"
        assert not r["errs"], r["errs"]

    def test_invalid_actions_and_buy(self, fresh):
        async def run():
            async with websockets.connect(f"{WS}?token={fresh['token']}&char={fresh['char']['id']}", max_size=None) as ws:
                await collect(ws, 1.0)
                await ws.send(json.dumps({"t": "move", "x": "abc", "z": 1}))
                await ws.send(json.dumps({"t": "target", "id": "nonexistent"}))
                await ws.send(json.dumps({"t": "move", "x": 1000, "z": 10}))
                _, errs, _ = await collect(ws, 1.0)
                # buy from mira (102,191) - character spawns near (90,192), so likely >6.5m first
                await ws.send(json.dumps({"t": "move", "x": 100, "z": 191}))
                await collect(ws, 4.0)
                await ws.send(json.dumps({"t": "buy", "npc": "mira", "item": "minor_hp", "qty": 1}))
                _, errs2, others = await collect(ws, 1.5)
                # sell bread (connection must survive buy)
                bread = next(s for s in init_inv if s["item"] == "bread")
                await ws.send(json.dumps({"t": "sell", "npc": "mira", "uid": bread["uid"], "qty": 1}))
                _, errs3, others3 = await collect(ws, 1.5)
                return errs, errs2 + errs3, others + others3
        init_inv = [{"item": "bread", "uid": None}]
        async def get_inv():
            async with websockets.connect(f"{WS}?token={fresh['token']}&char={fresh['char']['id']}", max_size=None) as ws:
                for _ in range(50):
                    m = json.loads(await ws.recv())
                    if m["t"] == "init":
                        return m["me"]["inventory"]
        init_inv = asyncio.run(get_inv())
        errs, errs2, others = asyncio.run(run())
        trades = [o["msg"] for o in others if o["t"] == "trade"]
        print(errs, errs2, trades)
        assert len(errs) == 3, errs
        assert not errs2, errs2
        assert any("Bought" in t for t in trades) and any("Sold" in t for t in trades), trades

    def test_unauth_ws_rejected(self):
        async def run():
            async with websockets.connect(f"{WS}?token=bad&char=x") as ws:
                try:
                    await asyncio.wait_for(ws.recv(), 3)
                except websockets.ConnectionClosed as e:
                    return e.rcvd.code if e.rcvd else None
        assert asyncio.run(run()) == 4401
