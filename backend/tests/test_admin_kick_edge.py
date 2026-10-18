# Edge: kick with long non-ASCII reason (WS close reason must be <=123 bytes UTF-8)
import time

from test_admin_live import (  # noqa
    API,
    CREATED,
    Client,
    admin,
    get_char,
    make_account,
)


def test_kick_long_unicode_reason(admin):  # noqa: F811
    acc = make_account()
    c = Client(acc)
    try:
        assert c.wait_for(lambda m: m.get("t") == "init", 10)
        r = admin.post(f"{API}/admin/characters/{acc['cid']}/kick", json={"text": "é" * 100})
        print("kick status", r.status_code, r.text[:200])
        rc = c.wait_close(6)
        print("close frame", rc)
        time.sleep(1)
        print("online after", get_char(admin, acc["uid"], acc["cid"])["online"])
        assert rc and rc.code == 4002
    finally:
        c.close()
        admin.post(f"{API}/admin/characters/{acc['cid']}/kick")
