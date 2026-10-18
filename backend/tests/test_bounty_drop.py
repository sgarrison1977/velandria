# Bounty board, boss data, item drop (Velandria iter4) - uses throwaway accounts only
import time, pytest, requests
from test_admin_live import API, PW, rand_letters, Client

CREATED = []
NEW_BOSSES = ["grubnak", "greymaw", "ixra", "malzeth", "revenant", "pyrrhax"]
ALL_BOUNTIES = ["barrow_king", "grubnak", "greymaw", "ixra", "captain_blackbrine", "malzeth", "revenant", "pyrrhax", "hollow_king"]


@pytest.fixture(scope="module", autouse=True)
def admin():
    r = requests.post(f"{API}/admin/login", json={"username": "griblin", "password": "Casey123!"})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    yield s
    for uid in CREATED:
        for _ in range(20):
            d = s.delete(f"{API}/admin/accounts/{uid}")
            if d.status_code in (200, 404):
                break
            time.sleep(2)


def make_account(cls="warrior"):
    email = f"bountytest_{rand_letters()}@test.io"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    tok, uid = r.json()["token"], r.json()["user"]["id"]
    CREATED.append(uid)
    c = requests.post(f"{API}/characters", json={"name": "Bty" + rand_letters(8), "cls": cls}, headers={"Authorization": f"Bearer {tok}"})
    assert c.status_code == 200, c.text
    return dict(email=email, token=tok, uid=uid, cid=c.json()["id"], char=c.json())


@pytest.fixture(scope="module")
def data():
    r = requests.get(f"{API}/game/data")
    assert r.status_code == 200
    return r.json()


# --- static game data
class TestData:
    def test_bounties(self, data):
        b = data["bounties"]
        assert sorted(b) == sorted(ALL_BOUNTIES)
        for k, v in b.items():
            for f in ("name", "level", "where", "track", "gold", "xp", "tokens"):
                assert f in v, (k, f)
            assert len(v["track"]) == 2

    def test_bounty_shop(self, data):
        shop = data["bounty_shop"]
        assert len(shop) == 11
        for item, cost in shop:
            assert item in data["items"], item
            assert cost > 0
        assert "bounty_token" in data["items"]

    def test_board_npcs(self, data):
        for n in ("board_semel", "board_elderglen", "board_ironhold", "board_sunhollow", "board_harbor"):
            assert data["npcs"][n]["kind"] == "board"

    def test_new_bosses(self, data):
        lv = []
        for m in NEW_BOSSES:
            md = data["monsters"][m]
            assert md.get("boss") and md.get("bounty"), m
            assert isinstance(md.get("slam"), dict), m
            lv.append(md["level"])
        assert min(lv) >= 15 and max(lv) <= 70, lv

    def test_status_monsters(self):
        r = requests.get(f"{API}/game/status")
        assert r.status_code == 200
        print(r.json())


# --- WS in-world flows
@pytest.fixture(scope="module")
def acc():
    return make_account()


def connect_ready(acc):
    c = Client(acc)
    me = c.wait_for(lambda m: m.get("t") == "me" or m.get("t") == "init" or "me" in m, timeout=10)
    assert me is not None, c.msgs[:3]
    return c


def latest_me(c):
    for m in reversed(c.msgs):
        if isinstance(m.get("me"), dict) and "inventory" in m["me"]:
            return m["me"]
    return None


class TestBountyWS:
    def test_flow(self, acc, data):
        c = connect_ready(acc)
        try:
            c.ws.send('{"t":"npc","id":"board_semel"}')
            bv = c.wait_for(lambda m: m.get("t") in ("bounty", "err"), timeout=15)
            assert bv and bv["t"] == "bounty", bv
            assert bv["npc"] == "board_semel" and bv["tokens"] == 0
            assert len(bv["list"]) == 9 and all(x["state"] == "available" for x in bv["list"])
            assert len(bv["shop"]) == 11
            import json
            send = lambda d: c.ws.send(json.dumps(d))
            send({"t": "bounty", "npc": "board_semel", "action": "accept", "id": "grubnak"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "bounty", r
            assert next(x for x in r["list"] if x["id"] == "grubnak")["state"] == "active"
            # accept again -> err
            send({"t": "bounty", "npc": "board_semel", "action": "accept", "id": "grubnak"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err", r
            # turnin non-done
            send({"t": "bounty", "npc": "board_semel", "action": "turnin", "id": "grubnak"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err" and "not complete" in r["msg"], r
            # buy with 0 tokens
            send({"t": "bounty", "npc": "board_semel", "action": "buy", "id": "hunters_signet"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err" and r["msg"] == "You need 3 Bounty Tokens.", r
            # buy non-shop item
            send({"t": "bounty", "npc": "board_semel", "action": "buy", "id": "bounty_token"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err", r
            # unknown bounty / action
            send({"t": "bounty", "npc": "board_semel", "action": "accept", "id": "nope"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err" and r["msg"] == "Unknown bounty.", r
            # far board
            send({"t": "bounty", "npc": "board_sunhollow", "action": "accept", "id": "greymaw"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err" and r["msg"] == "You are too far from a Bounty Board.", r
            # non-board npc
            send({"t": "bounty", "npc": "nonexistent", "action": "accept", "id": "greymaw"})
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err", r
        finally:
            c.close()
        time.sleep(2)
        # persistence: reconnect and check state still active
        c = connect_ready(acc)
        try:
            import json
            c.ws.send(json.dumps({"t": "npc", "id": "board_semel"}))
            bv = c.wait_for(lambda m: m.get("t") in ("bounty", "err"), timeout=15)
            assert bv["t"] == "bounty", bv
            assert next(x for x in bv["list"] if x["id"] == "grubnak")["state"] == "active", "bounty not persisted"
            c.ws.send(json.dumps({"t": "bounty", "npc": "board_semel", "action": "abandon", "id": "grubnak"}))
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "bounty"
            assert next(x for x in r["list"] if x["id"] == "grubnak")["state"] == "available"
            c.ws.send(json.dumps({"t": "bounty", "npc": "board_semel", "action": "abandon", "id": "grubnak"}))
            r = c.wait_for(lambda m: m.get("t") in ("bounty", "err"))
            assert r["t"] == "err", r
        finally:
            c.close()


class TestDropWS:
    def test_drop_and_pickup_other_player(self):
        import json
        a, b = make_account(), make_account("ranger")
        ca = connect_ready(a)
        cb = connect_ready(b)
        try:
            ca.wait_for(lambda m: False, timeout=2)
            me = latest_me(ca)
            assert me and me["inventory"], f"no inventory: {[m.get('t') for m in ca.msgs]}"
            slot = me["inventory"][0]
            n_before = len(me["inventory"])
            print("dropping", slot)
            ca.ws.send(json.dumps({"t": "drop", "uid": "doesnotexist"}))
            e = ca.wait_for(lambda m: m.get("t") == "err")
            assert e and e["msg"], e
            ca.ws.send(json.dumps({"t": "drop", "uid": slot["uid"]}))
            sysm = ca.wait_for(lambda m: m.get("t") == "sys" and "You drop" in m.get("msg", ""))
            assert sysm, [m for m in ca.msgs[-10:] if m.get("t") != "s"]
            me2 = ca.wait_for(lambda m: isinstance(m.get("me"), dict) and "inventory" in m["me"])
            assert me2 and all(s["uid"] != slot["uid"] for s in me2["me"]["inventory"])
            assert len(me2["me"]["inventory"]) == n_before - 1
            bme = latest_me(cb) or {"inventory": []}
            cnt = lambda inv: sum(x["qty"] for x in inv if x["item"] == slot["item"])
            before_b = cnt(bme["inventory"])
            snap = cb.wait_for(lambda m: m.get("t") == "s" and any(l[1] == slot["item"] and l[5] == 1 for l in m.get("l") or []), timeout=8)
            assert snap, "loot not visible/claimable to other player"
            loot = next(l for l in snap["l"] if l[1] == slot["item"])
            print("loot", loot)
            cb.ws.send(json.dumps({"t": "pickup", "id": loot[0]}))
            got = cb.wait_for(lambda m: isinstance(m.get("me"), dict) and "inventory" in m["me"] and cnt(m["me"]["inventory"]) > before_b, timeout=15)
            assert got, [m for m in cb.msgs[-15:] if m.get("t") != "s"]
        finally:
            ca.close(); cb.close()
