# Admin panel API tests: admin login, accounts listing, password reset, char edit/delete, account delete.
# Only throwaway accounts (admintest_*@test.io) are modified.
import os
import uuid
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_USER = "griblin"
ADMIN_PW = "Casey123!"


def rname(n=8):
    return "Tst" + "".join(random.choice(string.ascii_lowercase) for _ in range(n))


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    t = r.json()["token"]
    assert isinstance(t, str) and t
    return t


@pytest.fixture(scope="module")
def ah(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def player(ah):
    email = f"admintest_{uuid.uuid4().hex[:8]}@test.io"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "orig1234"})
    assert r.status_code == 200, r.text
    d = r.json()
    tok = d["token"]
    ph = {"Authorization": f"Bearer {tok}"}
    chars = []
    for cls in ("warrior", "wizard"):
        cr = requests.post(f"{BASE_URL}/api/characters", json={"name": rname(), "cls": cls}, headers=ph)
        assert cr.status_code == 200, cr.text
        chars.append(cr.json())
    info = {"email": email, "id": d["user"]["id"], "token": tok, "chars": chars}
    yield info
    requests.delete(f"{BASE_URL}/api/admin/accounts/{info['id']}", headers=ah)


def find_acc(ah, uid):
    r = requests.get(f"{BASE_URL}/api/admin/accounts", headers=ah)
    assert r.status_code == 200
    return next((a for a in r.json() if a["id"] == uid), None)


class TestAdminAuth:
    def test_bad_creds_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": ADMIN_USER, "password": "wrong"})
        assert r.status_code == 401
        # reset counter via valid login
        assert requests.post(f"{BASE_URL}/api/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PW}).status_code == 200

    def test_accounts_no_token_401(self):
        assert requests.get(f"{BASE_URL}/api/admin/accounts").status_code == 401

    def test_accounts_player_token_401(self, player):
        r = requests.get(f"{BASE_URL}/api/admin/accounts", headers={"Authorization": f"Bearer {player['token']}"})
        assert r.status_code == 401

    def test_mutations_player_token_401(self, player):
        ph = {"Authorization": f"Bearer {player['token']}"}
        assert requests.put(f"{BASE_URL}/api/admin/accounts/{player['id']}/password", json={"password": "xxxxxx"}, headers=ph).status_code == 401
        assert requests.delete(f"{BASE_URL}/api/admin/characters/{player['chars'][0]['id']}", headers=ph).status_code == 401
        assert requests.put(f"{BASE_URL}/api/admin/characters/{player['chars'][0]['id']}", json={"level": 5}, headers=ph).status_code == 401


class TestAdminAccounts:
    def test_list_structure(self, ah, player):
        r = requests.get(f"{BASE_URL}/api/admin/accounts", headers=ah)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 1
        for a in data:
            assert "password_hash" not in a and "_id" not in a
        acc = next(a for a in data if a["id"] == player["id"])
        assert acc["email"] == player["email"]
        assert acc["created_at"]
        assert len(acc["characters"]) == 2
        c = acc["characters"][0]
        for k in ("id", "name", "cls", "level", "gold", "score", "online"):
            assert k in c

    def test_reset_password(self, ah, player):
        r = requests.put(f"{BASE_URL}/api/admin/accounts/{player['id']}/password", json={"password": "newpw999"}, headers=ah)
        assert r.status_code == 200
        assert requests.post(f"{BASE_URL}/api/auth/login", json={"email": player["email"], "password": "newpw999"}).status_code == 200
        assert requests.post(f"{BASE_URL}/api/auth/login", json={"email": player["email"], "password": "orig1234"}).status_code == 401
        # clear failure counter
        requests.post(f"{BASE_URL}/api/auth/login", json={"email": player["email"], "password": "newpw999"})

    def test_reset_password_short_422(self, ah, player):
        r = requests.put(f"{BASE_URL}/api/admin/accounts/{player['id']}/password", json={"password": "abc"}, headers=ah)
        assert r.status_code == 422

    def test_reset_password_unknown_404(self, ah):
        r = requests.put(f"{BASE_URL}/api/admin/accounts/nope{uuid.uuid4().hex}/password", json={"password": "abcdef"}, headers=ah)
        assert r.status_code == 404


class TestAdminChars:
    def test_edit_level_gold_persist(self, ah, player):
        cid = player["chars"][0]["id"]
        r = requests.put(f"{BASE_URL}/api/admin/characters/{cid}", json={"level": 42, "gold": 12345}, headers=ah)
        assert r.status_code == 200, r.text
        assert r.json()["level"] == 42 and r.json()["gold"] == 12345
        acc = find_acc(ah, player["id"])
        c = next(c for c in acc["characters"] if c["id"] == cid)
        assert c["level"] == 42 and c["gold"] == 12345
        # player view also persisted
        pc = requests.get(f"{BASE_URL}/api/characters", headers={"Authorization": f"Bearer {player['token']}"}).json()
        pcc = next(x for x in pc if x["id"] == cid)
        assert pcc["level"] == 42 and pcc["gold"] == 12345 and pcc["xp"] > 0

    @pytest.mark.parametrize("lvl", [0, 101, -5])
    def test_edit_level_out_of_range_422(self, ah, player, lvl):
        r = requests.put(f"{BASE_URL}/api/admin/characters/{player['chars'][0]['id']}", json={"level": lvl}, headers=ah)
        assert r.status_code == 422

    def test_edit_level_bounds_ok(self, ah, player):
        cid = player["chars"][0]["id"]
        for lvl in (1, 100):
            r = requests.put(f"{BASE_URL}/api/admin/characters/{cid}", json={"level": lvl}, headers=ah)
            assert r.status_code == 200 and r.json()["level"] == lvl

    def test_edit_negative_gold_422(self, ah, player):
        r = requests.put(f"{BASE_URL}/api/admin/characters/{player['chars'][0]['id']}", json={"gold": -1}, headers=ah)
        assert r.status_code == 422

    def test_edit_empty_400(self, ah, player):
        r = requests.put(f"{BASE_URL}/api/admin/characters/{player['chars'][0]['id']}", json={}, headers=ah)
        assert r.status_code == 400

    def test_edit_unknown_404(self, ah):
        assert requests.put(f"{BASE_URL}/api/admin/characters/nope", json={"level": 2}, headers=ah).status_code == 404

    def test_delete_char(self, ah, player):
        cid = player["chars"][1]["id"]
        assert requests.delete(f"{BASE_URL}/api/admin/characters/{cid}", headers=ah).status_code == 200
        acc = find_acc(ah, player["id"])
        assert all(c["id"] != cid for c in acc["characters"])
        assert requests.delete(f"{BASE_URL}/api/admin/characters/{cid}", headers=ah).status_code == 404


class TestAdminDeleteAccount:
    def test_delete_account_removes_chars(self, ah):
        email = f"admintest_{uuid.uuid4().hex[:8]}@test.io"
        d = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "orig1234"}).json()
        ph = {"Authorization": f"Bearer {d['token']}"}
        name = rname()
        c = requests.post(f"{BASE_URL}/api/characters", json={"name": name, "cls": "ranger"}, headers=ph).json()
        r = requests.delete(f"{BASE_URL}/api/admin/accounts/{d['user']['id']}", headers=ah)
        assert r.status_code == 200
        assert find_acc(ah, d["user"]["id"]) is None
        all_chars = [x["id"] for a in requests.get(f"{BASE_URL}/api/admin/accounts", headers=ah).json() for x in a["characters"]]
        assert c["id"] not in all_chars
        assert requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "orig1234"}).status_code == 401
        assert requests.delete(f"{BASE_URL}/api/admin/accounts/{d['user']['id']}", headers=ah).status_code == 404
