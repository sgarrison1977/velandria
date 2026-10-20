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
BOTS = [("Thorgar", "warrior", "str"), ("Sylvara", "ranger", "dex"), ("Myrrdin", "wizard", "int"), ("Vexa", "warlock", "int")]
LOOKS = {"warrior": dict(skin="#d8a880", hair="#5a3a1a", hairStyle="short", beardStyle="full"), "ranger": dict(skin="#f0c8a8", hair="#c8a050", hairStyle="long"),
         "wizard": dict(skin="#e0b090", hair="#d8d8d8", hairStyle="long", beardStyle="long"), "warlock": dict(skin="#c8946e", hair="#1a1a1a", hairStyle="long")}
GOODS = {"semel": "mira", "elderglen": "fenn", "ironhold": "brikka", "sunhollow": "soren"}
OFFENSE = {"spell", "melee", "multi", "ranged", "dot", "cone", "aoe_self"}
rnd = random.Random()


class Bot:
    def __init__(self, game, p, primary):
        self.g, self.p, self.primary = game, p, primary
        self.state, self.goal, self.ground, self.blacklist = "hunt", None, None, {}
        self.next_gear = self.stuck_t = 0
        self.stuck_pos = (p.x, p.z)

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

    def pick_monster(self, radius):
        p, t = self.p, now()
        lo, hi = max(1, p.level - 4), p.level + 1
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
            return
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
        m = self.g.monsters.get(p.target) if p.target else None
        if m and not m.dead_until:
            return await self.fight(m)
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


async def spawn_bots(game, db):
    bots = []
    for name, cls, primary in BOTS:
        doc = await db.characters.find_one({"account_id": BOT_ACCOUNT, "cls": cls}, {"_id": 0})
        if not doc:
            nm = name
            for suffix in ("", "rin", "dor", "ys", "an"):
                nm = name + suffix
                if not await db.characters.find_one({"name_lower": nm.lower()}):
                    break
            doc = new_character_doc(BOT_ACCOUNT, nm, cls)
            doc["look"] = LOOKS[cls]
            await db.characters.insert_one(dict(doc))
            doc.pop("_id", None)
        p = await game.attach(doc, None)
        p.bot = True
        bots.append(Bot(game, p, primary))
        log.info("bot %s (%s, lv %d) is online", p.name, cls, p.level)
    return bots


async def set_enabled(game, db, on):
    await db.meta.update_one({"_id": "bots"}, {"$set": {"enabled": bool(on)}}, upsert=True)
    game.bots_enabled = bool(on)


async def run_bots(game, db):
    game.bots_enabled = (await db.meta.find_one({"_id": "bots"}) or {}).get("enabled", True)
    bots = []
    while True:
        if not game.bots_enabled:
            for b in bots:
                if game.players.get(b.p.id) is b.p:
                    await game.remove_player(b.p)
            bots = []
            await asyncio.sleep(2)
            continue
        if not bots:
            bots = await spawn_bots(game, db)
        for b in bots:
            if game.players.get(b.p.id) is not b.p:
                b.p = game.players.get(b.p.id) or await game.attach(await db.characters.find_one({"id": b.p.id}, {"_id": 0}), None)
                b.p.bot = True
            if not game.bots_enabled:
                break
            try:
                await b.tick()
            except Exception:
                log.exception("bot %s tick failed", b.p.name)
        await asyncio.sleep(0.6)
