# Admin live features: live edit, kick, ban/unban, broadcast, activity stats (Velandria admin panel iter3)
import os, json, time, uuid, pytest, requests
from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed


def _base():
    u = os.environ.get("REACT_APP_BACKEND_URL")
    if not u:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                u = line.split("=", 1)[1].strip()
    return u.rstrip("/")


BASE = _base()
API = f"{BASE}/api"
WS = BASE.replace("https", "wss", 1).replace("http", "ws", 1) + "/api/ws"
PW = "testpass123"
CREATED = []  # (uid)


def rand_letters(n=8):
    return "".join(chr(97 + (b % 26)) for b in uuid.uuid4().bytes[:n])


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/admin/login", json={"username": "griblin", "password": "Casey123!"})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    yield s
    for uid in CREATED:
        s.delete(f"{API}/admin/accounts/{uid}/ban")
        for _ in range(10):
            d = s.delete(f"{API}/admin/accounts/{uid}")
            if d.status_code in (200, 404):
                break
            time.sleep(1)


def make_account(cls="warrior"):
    email = f"admintest_{rand_letters()}@test.io"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    tok, uid = r.json()["token"], r.json()["user"]["id"]
    CREATED.append(uid)
    name = "Tst" + rand_letters(8)
    c = requests.post(f"{API}/characters", json={"name": name, "cls": cls}, headers={"Authorization": f"Bearer {tok}"})
    assert c.status_code == 200, c.text
    return dict(email=email, token=tok, uid=uid, cid=c.json()["id"], name=c.json()["name"], char=c.json())


class Client:
    def __init__(self, acc):
        self.ws = connect(f"{WS}?token={acc['token']}&char={acc['cid']}", open_timeout=15, max_size=None)
        self.msgs = []

    def wait_for(self, pred, timeout=8):
        end = time.time() + timeout
        while time.time() < end:
            try:
                raw = self.ws.recv(timeout=max(0.05, end - time.time()))
            except TimeoutError:
                break
            m = json.loads(raw)
            self.msgs.append(m)
            if pred(m):
                return m
        return None

    def wait_close(self, timeout=8):
        end = time.time() + timeout
        try:
            while time.time() < end:
                self.ws.recv(timeout=max(0.05, end - time.time()))
        except ConnectionClosed as e:
            return e.rcvd
        except TimeoutError:
            return None
        return None

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def get_acc(admin, uid):
    return next(a for a in admin.get(f"{API}/admin/accounts").json() if a["id"] == uid)


def get_char(admin, uid, cid):
    return next(c for c in get_acc(admin, uid)["characters"] if c["id"] == cid)


# --- Auth guard on new endpoints
class TestGuards:
    def test_new_endpoints_require_admin(self):
        acc = make_account()
        ph = {"Authorization": f"Bearer {acc['token']}"}
        calls = [("put", f"/admin/accounts/{acc['uid']}/ban", {"days": 1}), ("delete", f"/admin/accounts/{acc['uid']}/ban", None),
                 ("post", f"/admin/characters/{acc['cid']}/kick", None), ("post", "/admin/broadcast", {"text": "x"}),
                 ("get", "/admin/accounts", None), ("put", f"/admin/characters/{acc['cid']}", {"gold": 5})]
        for m, path, body in calls:
            for h in ({}, ph):
                r = getattr(requests, m)(f"{API}{path}", json=body, headers=h)
                assert r.status_code == 401, f"{m} {path} {h and 'player'} -> {r.status_code}"


# --- Activity stats + ban/unban + login
class TestBanAndStats:
    def test_last_login_and_fields(self, admin):
        acc = make_account()
        a = get_acc(admin, acc["uid"])
        assert a["last_login"] is None and a["play_seconds"] == 0 and a["ban"] is None
        assert a["characters"][0]["play_seconds"] == 0
        r = requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": PW})
        assert r.status_code == 200
        a = get_acc(admin, acc["uid"])
        assert isinstance(a["last_login"], str) and a["last_login"].startswith("20")

    def test_ban_unban_flow(self, admin):
        acc = make_account()
        r = admin.put(f"{API}/admin/accounts/{acc['uid']}/ban", json={"days": 7, "reason": "TEST cheating"})
        assert r.status_code == 200 and "Reason: TEST cheating" in r.json()["message"] and "until" in r.json()["message"]
        a = get_acc(admin, acc["uid"])
        assert a["ban"]["reason"] == "TEST cheating" and a["ban"]["until"]
        lr = requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": PW})
        assert lr.status_code == 403 and lr.json()["detail"].startswith("This account is banned") and "Reason: TEST cheating" in lr.json()["detail"]
        # wrong pw on banned account still 401 (no info leak)
        assert requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": "wrongpw1"}).status_code == 401
        # existing token rejected
        assert requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {acc['token']}"}).status_code == 401
        # WS rejected 4401
        c = Client(acc)
        assert c.wait_close(6).code == 4401
        # unban
        assert admin.delete(f"{API}/admin/accounts/{acc['uid']}/ban").status_code == 200
        assert get_acc(admin, acc["uid"])["ban"] is None
        assert requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": PW}).status_code == 200
        assert requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {acc['token']}"}).status_code == 200

    def test_permanent_ban_message(self, admin):
        acc = make_account()
        r = admin.put(f"{API}/admin/accounts/{acc['uid']}/ban", json={"days": None, "reason": ""})
        assert r.status_code == 200 and r.json()["message"] == "This account is banned permanently."
        assert get_acc(admin, acc["uid"])["ban"]["until"] is None
        assert requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": PW}).status_code == 403

    def test_expired_ban_no_longer_blocks(self, admin):
        from pymongo import MongoClient
        env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
        db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]
        acc = make_account()
        db.users.update_one({"id": acc["uid"]}, {"$set": {"ban": {"until": "2020-01-01T00:00:00+00:00", "reason": "old"}}})
        assert requests.post(f"{API}/auth/login", json={"email": acc["email"], "password": PW}).status_code == 200
        assert get_acc(admin, acc["uid"])["ban"] is None

    def test_ban_validation_and_404(self, admin):
        acc = make_account()
        for d in (0, -1, 5000):
            assert admin.put(f"{API}/admin/accounts/{acc['uid']}/ban", json={"days": d}).status_code == 422
        assert admin.put(f"{API}/admin/accounts/nope/ban", json={"days": 1}).status_code == 404
        assert admin.delete(f"{API}/admin/accounts/nope/ban").status_code == 404


# --- In-world features over WS
class TestLive:
    def test_kick_offline_400(self, admin):
        acc = make_account()
        assert admin.post(f"{API}/admin/characters/{acc['cid']}/kick").status_code == 400

    def test_live_edit_kick_and_playtime(self, admin):
        acc = make_account()
        c = Client(acc)
        try:
            init = c.wait_for(lambda m: m.get("t") == "init", 10)
            assert init, "no init"
            me0 = init["me"]
            assert get_char(admin, acc["uid"], acc["cid"])["online"] is True
            r = admin.put(f"{API}/admin/characters/{acc['cid']}", json={"level": 5, "gold": 777})
            assert r.status_code == 200 and r.json()["level"] == 5 and r.json()["gold"] == 777 and r.json()["online"]
            me = c.wait_for(lambda m: m.get("t") == "me" and m["me"].get("level") == 5, 3)
            assert me, "no live 'me' update"
            v = me["me"]
            print("me keys:", sorted(v.keys()))
            assert v["gold"] == 777 and v["hp"] == v["max_hp"] and v["mp"] == v["max_mp"]
            ap0, sp0 = me0.get("attr_points", 0), me0.get("skill_points", 0)
            assert v.get("attr_points") == ap0 + 12 and v.get("skill_points") == sp0 + 12, (ap0, sp0, v.get("attr_points"), v.get("skill_points"))
            assert any(m.get("t") == "sys" and m.get("msg") == "An admin has adjusted your character." for m in c.msgs) or \
                c.wait_for(lambda m: m.get("t") == "sys" and m.get("msg") == "An admin has adjusted your character.", 2)
            ch = get_char(admin, acc["uid"], acc["cid"])
            assert ch["level"] == 5 and ch["gold"] == 777
            # gold-only edit: no level change
            r = admin.put(f"{API}/admin/characters/{acc['cid']}", json={"gold": 5})
            assert r.status_code == 200 and r.json()["gold"] == 5 and r.json()["level"] == 5
            time.sleep(3)
            r = admin.post(f"{API}/admin/characters/{acc['cid']}/kick", json={"text": "TEST afk"})
            assert r.status_code == 200
            rc = c.wait_close(6)
            assert rc and rc.code == 4002 and rc.reason == "You were kicked by an admin. Reason: TEST afk", rc
            time.sleep(1)
            ch = get_char(admin, acc["uid"], acc["cid"])
            assert ch["online"] is False and ch["level"] == 5 and ch["gold"] == 5
            assert ch["play_seconds"] >= 3, ch
            assert get_acc(admin, acc["uid"])["play_seconds"] >= 3
            lst = requests.get(f"{API}/characters", headers={"Authorization": f"Bearer {acc['token']}"}).json()
            assert lst[0]["level"] == 5
        finally:
            c.close()

    def test_kick_no_reason(self, admin):
        acc = make_account()
        c = Client(acc)
        try:
            assert c.wait_for(lambda m: m.get("t") == "init", 10)
            assert admin.post(f"{API}/admin/characters/{acc['cid']}/kick").status_code == 200
            rc = c.wait_close(6)
            assert rc and rc.code == 4002 and rc.reason == "You were kicked by an admin."
        finally:
            c.close()

    def test_ban_kicks_online(self, admin):
        acc = make_account()
        c = Client(acc)
        try:
            assert c.wait_for(lambda m: m.get("t") == "init", 10)
            r = admin.put(f"{API}/admin/accounts/{acc['uid']}/ban", json={"days": 1, "reason": "TEST grief"})
            rc = c.wait_close(6)
            assert rc and rc.code == 4002 and rc.reason == r.json()["message"][:110], rc
            time.sleep(1)
            assert get_char(admin, acc["uid"], acc["cid"])["online"] is False
        finally:
            c.close()

    def test_periodic_playtime_save(self, admin):
        acc = make_account()
        c = Client(acc)
        try:
            assert c.wait_for(lambda m: m.get("t") == "init", 10)
            end = time.time() + 26
            while time.time() < end:
                c.wait_for(lambda m: False, 1)
            ch = get_char(admin, acc["uid"], acc["cid"])
            assert ch["online"] and ch["play_seconds"] >= 15, ch
            assert get_acc(admin, acc["uid"])["play_seconds"] >= 15
        finally:
            c.close()
            admin.post(f"{API}/admin/characters/{acc['cid']}/kick")

    def test_broadcast(self, admin):
        acc = make_account()
        c = Client(acc)
        try:
            assert c.wait_for(lambda m: m.get("t") == "init", 10)
            st = requests.get(f"{API}/game/status").json()
            if st["online"] != 1:
                pytest.skip(f"other players online ({st['online']}); skipping broadcast")
            r = admin.post(f"{API}/admin/broadcast", json={"text": "test"})
            assert r.status_code == 200 and r.json()["online"] == 1
            assert c.wait_for(lambda m: m.get("t") == "announce" and m.get("text") == "test", 3)
            assert any(m.get("t") == "chat" and m["m"].get("kind") == "system" and m["m"].get("text") == "[Announcement] test" for m in c.msgs) or \
                c.wait_for(lambda m: m.get("t") == "chat" and m["m"].get("text") == "[Announcement] test", 3)
            assert admin.post(f"{API}/admin/broadcast", json={"text": ""}).status_code == 422
        finally:
            c.close()
            admin.post(f"{API}/admin/characters/{acc['cid']}/kick")


# --- Offline edit still works
class TestOfflineEdit:
    def test_offline_edit(self, admin):
        acc = make_account()
        r = admin.put(f"{API}/admin/characters/{acc['cid']}", json={"level": 3, "gold": 42})
        assert r.status_code == 200 and r.json()["level"] == 3 and r.json()["gold"] == 42 and not r.json()["online"]
        c = Client(acc)
        try:
            init = c.wait_for(lambda m: m.get("t") == "init", 10)
            me = init["me"]
            assert me["level"] == 3 and me["gold"] == 42
            print("offline-edit attr/skill:", me.get("attr_points"), me.get("skill_points"))
        finally:
            c.close()
            admin.post(f"{API}/admin/characters/{acc['cid']}/kick")
