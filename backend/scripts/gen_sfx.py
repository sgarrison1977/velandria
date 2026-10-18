import os, sys, time, requests, concurrent.futures as cf

K = os.environ["EMERGENT_LLM_KEY"]
B = os.environ.get("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com").rstrip("/") + "/api/v1/fal"
EP = "fal-ai/elevenlabs/sound-effects/v2"
OUT = "/app/frontend/public/sfx"
H = {"Authorization": f"Bearer {K}", "Content-Type": "application/json"}

S = {
    "step1": ("single footstep, leather boot on packed dirt path, close up, dry, no music", 0.5),
    "step2": ("single footstep, leather boot stepping on gravel and dirt, close, dry", 0.5),
    "step3": ("single soft footstep on grass and earth, leather boot, close, dry", 0.5),
    "swing1": ("fast steel sword swing whoosh through the air, no impact", 0.6),
    "swing2": ("quick blade slash swish through air, medieval sword, no impact", 0.6),
    "hit1": ("sword blade striking a creature, meaty flesh impact with leather armor thud", 0.6),
    "hit2": ("weapon hit on body, punchy slash impact, medieval combat", 0.6),
    "crit": ("brutal critical sword strike, metal clang into armor with crunching impact", 0.9),
    "heavy": ("heavy two-handed warhammer smash, deep impact thud and debris", 1.0),
    "bow": ("bowstring release twang followed by arrow whoosh flying away", 0.8),
    "hurt": ("short male warrior grunt of pain when hit, medieval", 0.6),
    "mdeath": ("monster creature death growl fading, body collapsing to the ground", 1.3),
    "death": ("warrior death cry then armored body falling on the ground", 1.8),
    "heal": ("magical healing spell, soft shimmering chimes with warm airy whoosh", 1.3),
    "arcane": ("arcane magic bolt cast, crackling mystical energy launch", 1.0),
    "fire": ("fireball spell cast, roaring flame whoosh launch", 1.1),
    "frost": ("ice spell cast, crystalline frost crackle and shimmering shards", 1.1),
    "poison": ("toxic poison cloud spell, bubbling acid hiss", 1.3),
    "portal": ("magic portal opening, deep swirling whoosh and resonant hum", 1.8),
    "zap": ("magic lightning bolt zap, sharp electric crack", 0.7),
    "buff": ("magical power-up aura, rising shimmering energy swell", 1.2),
    "loot": ("picking up an item, leather pouch rustle with small soft clink", 0.6),
    "coin": ("a few gold coins clinking into a leather pouch", 0.8),
    "levelup": ("triumphant fantasy level up fanfare, short bright brass and choir shimmer", 2.2),
    "click": ("soft short wooden button click, medieval interface", 0.5),
    "error": ("dull low wooden knock, negative feedback", 0.5),
    "open": ("leather satchel flap opening, cloth and leather rustle", 0.6),
    "growl_beast": ("wolf snarling aggressive growl, close", 1.2),
    "growl_undead": ("undead skeleton bones rattling with raspy ghostly hiss", 1.2),
    "roar": ("huge monster roar, deep menacing beast bellow", 1.7),
    "moonbeam": ("ethereal moonbeam spell, shimmering celestial hum with soft crystalline chimes and a gentle airy whoosh of pale light, magical, no electric crackle", 1.4),
    "legendary": ("rare legendary treasure drop, radiant magical chime with shimmering bells and a soft heavenly choir swell", 2.2),
    "dash": ("fast heavy armored footsteps sprinting charge with cloth whoosh", 0.8),
    "surf": ("gentle ocean waves rolling onto a sandy beach and washing back, steady seamless loop, calm surf ambience, no seagulls, no wind, no music", 20.0),
}


def gen(name, prompt, dur):
    path = f"{OUT}/{name}.mp3"
    if os.path.exists(path):
        return name, "exists"
    r = requests.post(f"{B}/proxy", headers={**H, "X-Fal-Target-Url": f"https://queue.fal.run/{EP}"},
                      json={"text": prompt, "duration_seconds": dur, "prompt_influence": 0.6, "output_format": "mp3_44100_128"}, timeout=60)
    if r.status_code == 402:
        return name, "INSUFFICIENT CREDITS"
    r.raise_for_status()
    sub = r.json()
    deadline = time.time() + 300
    while time.time() < deadline:
        st = requests.get(sub["status_url"], headers=H, timeout=30).json()
        s = (st.get("status") or "").upper()
        if s in ("COMPLETED", "OK"):
            res = requests.get(sub["response_url"], headers=H, timeout=60).json()
            audio = requests.get(res["audio"]["url"], timeout=60).content
            open(path, "wb").write(audio)
            return name, f"ok {len(audio)}"
        if s in ("FAILED", "ERROR", "CANCELLED"):
            return name, f"failed {st}"
        time.sleep(2)
    return name, "timeout"


os.makedirs(OUT, exist_ok=True)
with cf.ThreadPoolExecutor(2) as ex:
    for f in cf.as_completed([ex.submit(gen, n, p, d) for n, (p, d) in S.items()]):
        try:
            print(*f.result(), flush=True)
        except Exception as e:
            print("ERR", e, flush=True)
