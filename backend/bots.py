"""Server-side bot players: always-online characters that hunt, loot, sell and level."""
import asyncio
import logging
import math
import random

from game import new_character_doc, now, dist
from game_data import ITEMS, ABILITIES, INV_SLOTS, gear_score, NPCS
from world import SAFE_ZONES, GOH, in_safe

log = logging.getLogger("bots")
BOT_ACCOUNT = "__bots__"
PRIMARY = {"warrior": "str", "ranger": "dex", "wizard": "int", "warlock": "int"}
BOTS = [(n, c, PRIMARY[c]) for n, c in [("Thorgar", "warrior"), ("Sylvara", "ranger"), ("Myrrdin", "wizard"), ("Vexa", "warlock"), ("Haldrek", "warrior"), ("Elowen", "ranger"),
                                        ("Caelum", "wizard"), ("Morwenna", "warlock"), ("Gunnar", "warrior"), ("Kestrel", "ranger"), ("Isolde", "wizard"), ("Draven", "warlock")]]
LINES = ["Anyone up for the castle later?", "These wolves never end, huh.", "Good hunting, everyone!", "Just hit a new level, feels good.", "Has anyone seen Old Greymaw lately?",
         "Selling junk, then back out there.", "Watch out near the Barrows, it's rough.", "Bounty Board has some juicy rewards today.", "Need more potions...",
         "Lovely weather for monster slaying.", "Got a nice drop just now!", "Heading north, wish me luck.", "Stay safe out there, friends.", "Who else is grinding tonight?"]
LOOKS = {"warrior": dict(skin="#d8a880", hair="#5a3a1a", hairStyle="short", beardStyle="full"), "ranger": dict(skin="#f0c8a8", hair="#c8a050", hairStyle="long"),
         "wizard": dict(skin="#e0b090", hair="#d8d8d8", hairStyle="long", beardStyle="long"), "warlock": dict(skin="#c8946e", hair="#1a1a1a", hairStyle="long")}
GOODS = {"semel": "mira", "elderglen": "fenn", "ironhold": "brikka", "sunhollow": "soren"}
OFFENSE = {"spell", "melee", "multi", "ranged", "dot", "cone", "aoe_self"}
RAID_LEVEL, RAID_SECS, RAID_CD = 60, 2400, (1800, 3600)
rnd = random.Random()


class Bot:
    def __init__(self, game, p, primary):
        self.g, self.p, self.primary = game, p, primary
        self.state, self.goal, self.ground, self.blacklist = "hunt", None, None, {}
        self.next_gear = self.stuck_t = 0
        self.next_chat = now() + rnd.uniform(120, 480)
        self.party_until = 0
        self.stuck_pos = (p.x, p.z)
        self.raid, self.raid_seen, self.raid_cd = False, False, now() + rnd.uniform(*RAID_CD)

    def end_raid(self, msg):
        for b in [self] + [b for b in getattr(self.g, "bot_list", []) if b.raid and b.p.party == self.p.party and b is not self]:
            if b.raid:
                b.raid, b.raid_seen, b.raid_cd, b.party_until = False, False, now() + rnd.uniform(*RAID_CD), 1
        log.info("bot raid by %s ended: %s", self.p.name, msg)

    def raid_target(self):
        p = self.p
        ms = [m for m in self.g.monsters.values() if not m.dead_until and m.spawn.get("room") is not None and self.g.in_castle(m.x, m.z) and self.blacklist.get(m.id, 0) < now()]
        return min(ms, key=lambda m: dist(p, m), default=None)

    async def raid_tick(self):
        p, g = self.p, self.g
        if not self.mate():
            return self.end_raid("party broke up")
        mate = self.mate()
        if g.parties[p.party]["leader"] != p.id:
            lm = g.monsters.get(mate.target) if mate.target else None
            if lm and not lm.dead_until and dist(p, lm) < 60:
                return await self.fight(lm) or True
            if dist(p, mate) > 8 and not mate.dead_until:
                if not p.path or dist(p, mate) > 20:
                    self.go(mate.x + rnd.uniform(-1.5, 1.5), mate.z + rnd.uniform(-1.5, 1.5))
                return True
            return False
        cur = g.monsters.get(p.target) if p.target else None
        if cur and not cur.dead_until:
            return await self.fight(cur) or True
        if g.in_castle(p.x, p.z):
            if g.run_key(p) in g.castle_runs:
                self.raid_seen = True
            elif self.raid_seen:
                return self.end_raid("run finished")
            m = self.raid_target()
            if m:
                return await self.fight(m) or True
            return False
        foe = next((m for m in g.monsters.values() if m.target == p.id and not m.dead_until), None)
        if foe:
            return await self.fight(foe) or True
        if 25 < dist(p, mate) < 90 and not mate.dead_until:
            p.path = []
            return True
        if not p.path:
            gx, gz = g.world.castle["gate"]
            self.go(gx, gz - 3)
        return True

    async def act(self, msg):
        try:
            await self.g.handle(self.p, msg)
        except Exception:
            log.exception("bot %s action %s failed", self.p.name, msg.get("t"))

    def inv(self, item):
        return next((s for s in self.p.inventory if s["item"] == item), None)

    def town(self):
        return min((z for z in SAFE_ZONES if z["town"] in GOODS), key=lambda z: (z["x"] - self.p.x) ** 2 + (z["z"] - self.p.z) ** 2)

    def go(self, x, z):
        p = self.p
        d = math.hypot(x - p.x, z - p.z)
        if d > 120:
            x, z = p.x + (x - p.x) / d * 120, p.z + (z - p.z) / d * 120
        return self.g.path_to(p, float(x), float(z))

    def mate(self):
        pt = self.g.parties.get(getattr(self.p, "party", None))
        return next((self.g.players[i] for i in pt["members"] if i != self.p.id and i in self.g.players), None) if pt else None

    def pick_monster(self, radius):
        p, t = self.p, now()
        lo, hi = (max(1, p.level - 1), p.level + 3) if self.mate() else (max(1, p.level - 4), p.level + 1)
        best = None
        for m in self.g.monsters.values():
            d = m.d
            if m.dead_until or d.get("boss") or d.get("champion") or m.z > GOH or not lo <= d["level"] <= hi or self.blacklist.get(m.id, 0) > t:
                continue
            dd = dist(p, m)
            if dd < radius and (best is None or dd < best[0]):
                best = (dd, m)
        return best[1] if best else None

    def upgrade_gear(self):
        p = self.p
        for s in list(p.inventory):
            it = ITEMS[s["item"]]
            if it["type"] not in ("weapon", "armor") or it.get("lvl", 1) > p.level or (it.get("cls") and p.cls not in it["cls"]):
                continue
            slot = it.get("slot", "main")
            if slot == "ring":
                rings = [v for k, v in p.equipment.items() if k.startswith("ring")]
                cur = 0 if len(rings) < 6 else min(gear_score({"r": r}) for r in rings)
            else:
                cur = gear_score({"x": p.equipment[slot]}) if p.equipment.get(slot) else 0
            if gear_score({"x": s}) > cur:
                self.g.equip(p, s["uid"])

    def junk(self, s):
        it = ITEMS[s["item"]]
        if it["type"] == "quest" or it["price"] <= 0 or s["item"] in ("hp_potion", "mp_potion"):
            return False
        return it["type"] in ("material", "weapon", "armor") or it["type"] == "consumable" and it["rarity"] == "common"

    async def town_visit(self):
        p = self.p
        npc_id = GOODS[self.town()["town"]]
        n = NPCS[npc_id]
        if math.hypot(n["pos"][0] - p.x, n["pos"][1] - p.z) > 3.5:
            if not p.path:
                self.go(n["pos"][0], n["pos"][1] + 1.5)
            return
        for s in [s for s in p.inventory if self.junk(s)]:
            await self.act({"t": "sell", "npc": npc_id, "uid": s["uid"], "qty": s["qty"]})
        for item, want in (("hp_potion", 15), ("mp_potion", 10 if p.cls in ("wizard", "warlock") else 5)):
            have = sum(s["qty"] for s in p.inventory if s["item"] == item)
            n_buy = min(want - have, int(p.gold * 0.5 // max(1, ITEMS[item]["price"])))
            if n_buy > 0:
                await self.act({"t": "buy", "npc": npc_id, "item": item, "qty": n_buy})
        self.state = "rest"

    async def fight(self, m):
        p, t = self.p, now()
        if p.target != m.id:
            await self.act({"t": "target", "id": m.id})
        if dist(p, m) > 16:
            if not p.path and not self.go(m.x, m.z):
                self.blacklist[m.id], p.target = t + 60, None
            return
        abil = [a for a in p.abilities if ABILITIES[a]["kind"] in OFFENSE and p.mp >= ABILITIES[a]["cost"] and p.cds.get(a, 0) < t]
        if abil and rnd.random() < 0.7:
            a = rnd.choice(abil)
            self.g.cast(p, a, m.id, (m.x, m.z))
        if p.hp < p.max_hp * 0.55 and "minor_mederi" in p.abilities and p.cds.get("minor_mederi", 0) < t:
            self.g.cast(p, "minor_mederi", p.id, (p.x, p.z))

    async def tick(self):
        p, t = self.p, now()
        if p.dead_until:
            self.state, self.goal = "rest", None
            if self.raid:
                self.end_raid("wiped")
            return
        if getattr(self.g, "bot_chat", False) and t > self.next_chat:
            self.next_chat = t + rnd.uniform(240, 720)
            await self.g.chat(p, rnd.choice(LINES))
        if p.attr_points > 0:
            for _ in range(p.attr_points):
                await self.act({"t": "alloc", "attr": self.primary if rnd.random() < 0.7 else "sta"})
        if t > self.next_gear:
            self.next_gear = t + 8
            self.upgrade_gear()
        hp = p.hp / max(1, p.max_hp)
        if hp < 0.45 and (s := self.inv("hp_potion")) and p.cds.get("potion", 0) < t:
            await self.act({"t": "use", "uid": s["uid"]})
        if p.mp < p.max_mp * 0.2 and (s := self.inv("mp_potion")) and p.cds.get("potion", 0) < t:
            await self.act({"t": "use", "uid": s["uid"]})
        if (s := self.inv("vexmoor_coffer")) and not p.pending:
            await self.act({"t": "use", "uid": s["uid"]})
        if self.raid and t - self.raid_start > RAID_SECS:
            self.end_raid("timed out")
        if self.state == "hunt" and (hp < 0.25 and not self.inv("hp_potion") or len(p.inventory) >= INV_SLOTS - 3):
            self.state = "town"
            p.target = None
        if self.state == "town":
            z = self.town()
            if not in_safe(p.x, p.z):
                if not p.path:
                    self.go(z["x"], z["z"])
                return
            return await self.town_visit()
        if self.state == "rest":
            if p.hp >= p.max_hp * 0.95 and p.mp >= p.max_mp * 0.6:
                self.state = "hunt"
            elif not in_safe(p.x, p.z) and not p.target:
                self.state = "town"
            return
        if self.raid and await self.raid_tick():
            return
        m = self.g.monsters.get(p.target) if p.target else None
        if m and not m.dead_until:
            return await self.fight(m)
        mate = self.mate()
        if mate and self.g.parties[p.party]["leader"] != p.id:
            lm = self.g.monsters.get(mate.target) if mate.target else None
            if lm and not lm.dead_until and dist(p, lm) < 60:
                return await self.fight(lm)
            if dist(p, mate) > 12 and not mate.dead_until:
                self.go(mate.x + rnd.uniform(-2, 2), mate.z + rnd.uniform(-2, 2))
                return
        loot = min((l for l in self.g.loot.values() if math.hypot(l["x"] - p.x, l["z"] - p.z) < 14 and (not l["owner"] or l["owner"] == p.id or l["owner_until"] < t)),
                   key=lambda l: math.hypot(l["x"] - p.x, l["z"] - p.z), default=None)
        if loot and not p.pending:
            return await self.act({"t": "pickup", "id": loot["id"]})
        m = self.pick_monster(45)
        if m:
            return await self.fight(m)
        if math.hypot(p.x - self.stuck_pos[0], p.z - self.stuck_pos[1]) > 2:
            self.stuck_pos, self.stuck_t = (p.x, p.z), t
        elif t - self.stuck_t > 25:
            self.stuck_t = t
            await self.act({"t": "unstuck"})
            return
        if not p.path:
            far = self.pick_monster(2000)
            if far:
                if not self.go(far.x, far.z):
                    self.blacklist[far.id] = t + 300
            else:
                a = rnd.uniform(0, 6.283)
                self.go(p.x + math.cos(a) * 40, p.z + math.sin(a) * 40)


async def spawn_bot(game, db, i):
    name, cls, primary = BOTS[i]
    doc = await db.characters.find_one({"account_id": BOT_ACCOUNT, "bot_slot": i}, {"_id": 0})
    if not doc and i < 4:
        doc = await db.characters.find_one({"account_id": BOT_ACCOUNT, "cls": cls, "bot_slot": {"$exists": False}}, {"_id": 0})
        if doc:
            await db.characters.update_one({"id": doc["id"]}, {"$set": {"bot_slot": i}})
    if not doc:
        nm = name
        for suffix in ("", "rin", "dor", "ys", "an"):
            nm = name + suffix
            if not await db.characters.find_one({"name_lower": nm.lower()}):
                break
        doc = new_character_doc(BOT_ACCOUNT, nm, cls)
        doc["look"], doc["bot_slot"] = LOOKS[cls], i
        await db.characters.insert_one(dict(doc))
        doc.pop("_id", None)
    p = await game.attach(doc, None)
    p.bot = True
    log.info("bot %s (%s, lv %d) is online", p.name, cls, p.level)
    return Bot(game, p, primary)


async def save_cfg(game, db, **kw):
    await db.meta.update_one({"_id": "bots"}, {"$set": kw}, upsert=True)
    for k, v in kw.items():
        setattr(game, {"enabled": "bots_enabled", "count": "bot_count", "chat": "bot_chat"}[k], v)


def maybe_pair(game, bots):
    t = now()
    for b in bots:
        if b.party_until and t > b.party_until and getattr(b.p, "party", None):
            game.party_leave(b.p)
            b.party_until = 0
    free = [b for b in bots if not getattr(b.p, "party", None) and not b.p.dead_until]
    rnd.shuffle(free)
    raiders = [b for b in free if b.p.level >= RAID_LEVEL and t > b.raid_cd]
    if len(raiders) >= 2 and rnd.random() < 0.5:
        a, o = raiders[:2]
        free.remove(a), free.remove(o)
        pid = "bp" + a.p.id[:8]
        game.parties[pid] = dict(leader=a.p.id, members={a.p.id, o.p.id})
        a.p.party = o.p.party = pid
        a.party_until = o.party_until = t + RAID_SECS + 60
        a.raid = o.raid = True
        a.raid_start = o.raid_start = t
        game.party_send(pid)
        log.info("bots %s and %s are raiding Castle Vexmoor", a.p.name, o.p.name)
    while len(free) >= 2:
        a = free.pop()
        o = next((x for x in free if abs(x.p.level - a.p.level) <= 3), None)
        if not o or rnd.random() > 0.3:
            continue
        free.remove(o)
        pid = "bp" + a.p.id[:8]
        game.parties[pid] = dict(leader=a.p.id, members={a.p.id, o.p.id})
        a.p.party = o.p.party = pid
        a.party_until = o.party_until = t + rnd.uniform(600, 1500)
        game.party_send(pid)


async def run_bots(game, db):
    cfg = await db.meta.find_one({"_id": "bots"}) or {}
    game.bots_enabled, game.bot_count, game.bot_chat = cfg.get("enabled", True), cfg.get("count", 4), cfg.get("chat", False)
    bots, next_pair = [], now() + 60
    game.bot_list = bots
    while True:
        want = game.bot_count if game.bots_enabled else 0
        while len(bots) > want:
            b = bots.pop()
            if game.players.get(b.p.id) is b.p:
                await game.remove_player(b.p)
        while len(bots) < want:
            bots.append(await spawn_bot(game, db, len(bots)))
        if not bots:
            await asyncio.sleep(2)
            continue
        if now() > next_pair:
            next_pair = now() + 60
            maybe_pair(game, bots)
        for b in bots:
            if game.players.get(b.p.id) is not b.p:
                b.p = game.players.get(b.p.id) or await game.attach(await db.characters.find_one({"id": b.p.id}, {"_id": 0}), None)
                b.p.bot = True
                b.state, b.raid = "hunt", False
            try:
                await b.tick()
            except Exception:
                log.exception("bot %s tick failed", b.p.name)
        await asyncio.sleep(0.6)


def town_spot(p):
    z = min((z for z in SAFE_ZONES if z["town"] in GOODS), key=lambda z: (z["x"] - p.x) ** 2 + (z["z"] - p.z) ** 2)
    return z["x"] + rnd.uniform(-4, 4), z["z"] + rnd.uniform(-8, -5)


async def reset_bot(game, db, cid):
    doc = await db.characters.find_one({"id": cid, "account_id": BOT_ACCOUNT}, {"_id": 0})
    if not doc:
        return None
    fresh = new_character_doc(BOT_ACCOUNT, doc["name"], doc["cls"])
    fresh |= {k: doc[k] for k in ("id", "look", "bot_slot", "created_at") if k in doc}
    live = game.players.get(cid)
    if live:
        game.trade_close(live, f"{live.name} left the world.")
        game.party_leave(live)
        del game.players[cid]
        for m in game.monsters.values():
            if m.target == cid:
                m.target = None
    await db.characters.replace_one({"id": cid}, fresh)
    return fresh
