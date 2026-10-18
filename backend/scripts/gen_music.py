import os, time, requests, concurrent.futures as cf

K = os.environ["EMERGENT_LLM_KEY"]
B = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
EP = "fal-ai/elevenlabs/music"
OUT = "/app/frontend/public/music"
H = {"Authorization": f"Bearer {K}", "Content-Type": "application/json"}
TRACKS = {
    "town": "calm peaceful medieval fantasy town music, gentle lute, soft flute and harp, warm and cozy tavern village ambience, slow tempo, loopable, instrumental",
    "wild": "serene fantasy wilderness exploration music, soft strings, light woodwinds and distant horns, open meadows and forests, gentle adventurous mood, loopable, instrumental",
    "dungeon": "dark ominous fantasy dungeon music, low droning cellos, deep slow drums, eerie choir pads and distant echoing bells, tense and mysterious, loopable, instrumental",
}


def gen(name, prompt):
    path = f"{OUT}/{name}.mp3"
    if os.path.exists(path):
        return name, "exists"
    r = requests.post(f"{B}/proxy", headers={**H, "X-Fal-Target-Url": f"https://queue.fal.run/{EP}"},
                      json={"prompt": prompt, "music_length_ms": 90000, "force_instrumental": True, "output_format": "mp3_44100_128"}, timeout=60)
    if r.status_code == 402:
        return name, "INSUFFICIENT CREDITS"
    r.raise_for_status()
    sub = r.json()
    deadline = time.time() + 600
    while time.time() < deadline:
        try:
            st = requests.get(sub["status_url"], headers=H, timeout=30).json()
        except Exception:
            time.sleep(3)
            continue
        s = (st.get("status") or "").upper()
        if s in ("COMPLETED", "OK"):
            res = requests.get(sub["response_url"], headers=H, timeout=60).json()
            audio = requests.get(res["audio"]["url"], timeout=120).content
            open(path, "wb").write(audio)
            return name, f"ok {len(audio)}"
        if s in ("FAILED", "ERROR", "CANCELLED"):
            return name, f"failed {st}"
        time.sleep(4)
    return name, "timeout"


os.makedirs(OUT, exist_ok=True)
with cf.ThreadPoolExecutor(3) as ex:
    for f in cf.as_completed([ex.submit(gen, n, p) for n, p in TRACKS.items()]):
        try:
            print(*f.result(), flush=True)
        except Exception as e:
            print("ERR", e, flush=True)
