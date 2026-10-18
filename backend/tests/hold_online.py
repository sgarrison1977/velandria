# Helper: register throwaway account+char, keep it online over WS for N secs; writes ids to /tmp/hold.json
import json, sys, time, uuid, requests
from websockets.sync.client import connect
BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL=")][0].rstrip("/")
r = lambda n: "".join(chr(97 + b % 26) for b in uuid.uuid4().bytes[:n])
email = f"admintest_{r(8)}@test.io"
reg = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "testpass123"}).json()
tok = reg["token"]
c = requests.post(f"{BASE}/api/characters", json={"name": "Tst" + r(8), "cls": "wizard"}, headers={"Authorization": f"Bearer {tok}"}).json()
json.dump({"email": email, "uid": reg["user"]["id"], "cid": c["id"], "name": c["name"]}, open("/tmp/hold.json", "w"))
ws = connect(f"{BASE.replace('https', 'wss')}/api/ws?token={tok}&char={c['id']}", max_size=None)
log = open("/tmp/hold_msgs.log", "w")
end = time.time() + int(sys.argv[1] if len(sys.argv) > 1 else 120)
try:
    while time.time() < end:
        try:
            m = json.loads(ws.recv(timeout=1))
            if m.get("t") not in ("s", "snap", "party"):
                log.write(json.dumps(m)[:300] + "\n"); log.flush()
        except TimeoutError:
            pass
except Exception as e:
    log.write(f"CLOSED {getattr(e, 'rcvd', None)}\n")
log.close()
