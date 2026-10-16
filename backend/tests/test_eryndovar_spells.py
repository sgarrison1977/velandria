# Eryndovar iteration: 4 classes, class spell lists, unlocks, charge buffs, stop action, marks/portal, blink, combat no-cd, random loot props
import asyncio, json, os, random, string, sys, time
import pytest, requests, websockets
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')
sys.path.insert(0, '/app/backend')
import game_data as g  # noqa

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = BASE_URL + "/api"
WS = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]


def rname(p="T"):
    return p + "".join(random.choices(string.ascii_lowercase, k=7))


@pytest.fixture(scope="module")
def acct():
    e = "test_" + "".join(random.choices(string.ascii_lowercase, k=8)) + "@x.io"
    r = requests.post(f"{API}/auth/register", json={"email": e, "password": "secret123"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    return tok, {"Authorization": "Bearer " + tok}


def mk(acct, cls, **setf):
    tok, h = acct
    r = requests.post(f"{API}/characters", json={"name": rname(), "cls": cls}, headers=h)
    assert r.status_code == 200, r.text
    c = r.json()
    if setf:
        db.characters.update_one({"id": c["id"]}, {"$set": setf})
    return c


async def drain(ws, n=60, to=1.2):
    out = []
    for _ in range(n):
        try:
            out.append(json.loads(await asyncio.wait_for(ws.recv(), to)))
        except Exception:
            break
    return out


def last_me(ms):
    me = [m["me"] for m in ms if m["t"] in ("me", "init")]
    return me[-1] if me else None


def msgs(ms):
    return [m.get("msg") for m in ms if m["t"] in ("err", "sys")]


def run(c):
    return asyncio.run(c)


# --- Character creation / class spell lists
class TestClasses:
    def test_game_data_classes(self):
        d = requests.get(f"{API}/game/data").json()
        assert set(d["classes"].keys()) == {"warrior", "ranger", "wizard", "warlock"}
        for c in d["classes"].values():
            assert set(c["attrs"].keys()) == {"str", "sta", "wis", "int", "dex"}

    def test_mage_rejected(self, acct):
        r = requests.post(f"{API}/characters", json={"name": rname(), "cls": "mage"}, headers=acct[1])
        assert r.status_code == 400

    @pytest.mark.parametrize("cls", ["warrior", "ranger", "wizard", "warlock"])
    def test_create_and_start_abilities(self, acct, cls):
        c = mk(acct, cls)
        assert c["cls"] == cls
        doc = db.characters.find_one({"id": c["id"]}, {"_id": 0})
        exp = ["agredi"] if cls in ("wizard", "warlock") else []
        assert doc["abilities"] == exp
        ab_binds = [k[8:] for k in doc["binds"] if k.startswith("ability:")]
        assert set(ab_binds) == {k for k, a in g.ABILITIES.items() if cls in a["cls"]}
        db.characters.delete_one({"id": c["id"]})


# --- Unlock rules
class TestUnlock:
    def test_unlock_rules(self, acct):
        c = mk(acct, "warlock", level=3, skill_points=1)

        async def go():
            async with websockets.connect(f"{WS}?token={acct[0]}&char={c['id']}") as ws:
                await drain(ws, 5)
                res = {}
                for ab in ("double_stab", "venenum", "ignis", "minor_mederi"):
                    await ws.send(json.dumps({"t": "unlock", "ab": ab}))
                    r = await drain(ws, 30, 0.8)
                    res[ab] = (msgs(r), last_me(r))
                return res
        res = run(go())
        assert any("class cannot" in (m or "") for m in res["double_stab"][0]), res["double_stab"][0]
        assert any("level 4" in (m or "") for m in res["venenum"][0]), res["venenum"][0]
        assert any("learned Ignis" in (m or "") for m in res["ignis"][0]), res["ignis"][0]
        assert any("skill point" in (m or "") for m in res["minor_mederi"][0]), res["minor_mederi"][0]
        me = res["ignis"][1]
        assert me and "ignis" in me["abilities"] and me["skill_points"] == 0


# --- Buffs, stop, marks, blink, portal
class TestSpells:
    def test_buffs_stop_mark_blink_portal(self, acct):
        abil = [k for k, a in g.ABILITIES.items() if "wizard" in a["cls"]]
        c = mk(acct, "wizard", x=90.0, z=192.0, level=12, abilities=abil)

        async def go():
            R = {}
            async with websockets.connect(f"{WS}?token={acct[0]}&char={c['id']}") as ws:
                init = await drain(ws, 5)
                R["armor0"] = last_me(init)["armor"]
                await ws.send(json.dumps({"t": "chat", "msg": "mark1"}))
                R["mark"] = await drain(ws, 30, 0.8)
                for ab in ("teuri", "velocitas", "robur", "contra_visus"):
                    await ws.send(json.dumps({"t": "cast", "ab": ab}))
                    R[ab] = await drain(ws, 20, 0.6)
                await ws.send(json.dumps({"t": "stop"}))
                R["stop"] = await drain(ws, 20, 0.8)
                await ws.send(json.dumps({"t": "cast", "ab": "pergere_trans", "pt": [100, 192]}))
                R["blink"] = await drain(ws, 20, 0.8)
                await ws.send(json.dumps({"t": "cast", "ab": "creare_porta", "mark": "7", "pt": [96, 194]}))
                R["unset"] = await drain(ws, 15, 0.6)
                await ws.send(json.dumps({"t": "cast", "ab": "creare_porta", "mark": "1", "pt": [96, 196]}))
                R["portal"] = await drain(ws, 15, 0.8)
                await asyncio.sleep(1.5)
                await ws.send(json.dumps({"t": "move", "x": 96, "z": 196}))
                R["walk"] = await drain(ws, 60, 1.0)
            return R
        R = run(go())
        assert any("Mark 1 set" in (m or "") for m in msgs(R["mark"])), msgs(R["mark"])
        me = last_me(R["contra_visus"]) or last_me(R["robur"])
        assert me, "no me update after buffs"
        assert {"armor", "speed", "str", "invis"} <= set(me["buffs"].keys()), me["buffs"]
        for k in ("armor", "speed", "str", "invis"):
            assert 290 <= me["buffs"][k] <= 300.5
        assert me["armor"] > R["armor0"]
        me_s = last_me(R["stop"])
        assert me_s and "invis" not in me_s["buffs"] and "armor" in me_s["buffs"], me_s and me_s["buffs"]
        assert any("Contra Visus ends" in (m or "") for m in msgs(R["stop"]))
        pos = [m["me"][:2] for m in R["blink"] if m["t"] == "s"][-1]
        assert pos[0] > 95, f"blink did not move: {pos}"
        assert any("not set" in (m or "") for m in msgs(R["unset"]))
        gs = [m["g"] for m in R["portal"] if m["t"] == "s"]
        assert gs and len(gs[-1]) == 1, f"portal not in snapshot {msgs(R['portal'])}"
        assert any("portal" in (m or "").lower() and "step" in (m or "").lower() for m in msgs(R["walk"])), msgs(R["walk"])


# --- Combat: spells damage monsters back-to-back (no cooldown); contra visus prevents aggro
class TestCombat:
    def _fight(self, acct, cls, spells, x, z):
        abil = [k for k, a in g.ABILITIES.items() if cls in a["cls"]]
        c = mk(acct, cls, x=x, z=z, level=12, abilities=abil, hp=9999, mp=9999, attrs=dict(str=3, sta=60, wis=60, int=3, dex=3))

        async def go():
            out = {}
            async with websockets.connect(f"{WS}?token={acct[0]}&char={c['id']}") as ws:
                init = await drain(ws, 10)
                snaps = [m for m in init if m["t"] == "s"]
                ms = [m for m in snaps[-1]["m"] if m[5] != 2] if snaps else []
                assert ms, "no monsters visible"
                ms.sort(key=lambda m: (m[2] - x) ** 2 + (m[3] - z) ** 2)
                for ab in spells:
                    tgt = ms[0][0]
                    await ws.send(json.dumps({"t": "cast", "ab": ab, "id": tgt}))
                    await ws.send(json.dumps({"t": "cast", "ab": ab, "id": tgt}))
                    r = await drain(ws, 80, 1.0)
                    dmg = [f for f in r if f["t"] == "fx" and f.get("k") in ("dmg", "mdmg", "hit")]
                    casts = [f for f in r if f["t"] == "fx" and f.get("k") == "cast" and f.get("ab") == ab]
                    out[ab] = dict(casts=len(casts), dmg=len(dmg), errs=msgs(r), kinds={f.get("k") for f in r if f["t"] == "fx"})
                    alive = [m for m in ([s for s in r if s["t"] == "s"][-1]["m"]) if m[5] != 2]
                    if alive:
                        alive.sort(key=lambda m: (m[2] - x) ** 2 + (m[3] - z) ** 2)
                        ms = alive
            return out
        return run(go())

    def test_caster_spells(self, acct):
        out = self._fight(acct, "warlock", ["agredi", "ignis", "venenum"], 190.0, 240.0)
        print(out)
        for ab, o in out.items():
            assert o["casts"] >= 2, f"{ab}: {o}"

    def test_ranger_spells(self, acct):
        out = self._fight(acct, "ranger", ["arrow_barrage", "multi_shot"], 190.0, 240.0)
        print(out)
        for ab, o in out.items():
            assert o["casts"] >= 2, f"{ab}: {o}"

    def test_warrior_double_stab(self, acct):
        out = self._fight(acct, "warrior", ["double_stab"], 190.0, 240.0)
        print(out)
        assert out["double_stab"]["casts"] >= 1, out


# --- Random properties
class TestRandomProps:
    def test_roll_props(self):
        rnd = random.Random(1)
        p, n = g.roll_props("iron_helm", 10, rnd, force=True)
        assert p and n and n.endswith("Iron Helm") or " Iron Helm " in n
        assert g.roll_props("minor_hp", 10, rnd, force=True) == (None, None)
        assert g.random_gear(10, rnd) in g.ITEMS

    def test_equip_props_changes_stats(self, acct):
        it = dict(uid="tst" + rname(), item="leather_cap", qty=1, props={"sta": 10, "max_hp": 50, "armor": 7, "move_speed": 5}, pname="Vital Leather Cap")
        c = mk(acct, "warrior")
        db.characters.update_one({"id": c["id"]}, {"$push": {"inventory": it}})

        async def go():
            async with websockets.connect(f"{WS}?token={acct[0]}&char={c['id']}") as ws:
                i = last_me(await drain(ws, 5))
                await ws.send(json.dumps({"t": "equip", "uid": it["uid"]}))
                a = last_me(await drain(ws, 20, 0.8))
                return i, a
        b, a = run(go())
        assert a["max_hp"] == b["max_hp"] + 60 + 50, (b["max_hp"], a["max_hp"])
        assert a["armor"] == b["armor"] + 2 + 7
        assert a["equipment"]["head"].get("props") == it["props"]
        assert a["equipment"]["head"].get("pname") == "Vital Leather Cap"
