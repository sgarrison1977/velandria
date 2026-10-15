"""Authoritative real-time game simulation for Suminex."""
import asyncio, time, math, random, uuid, json, logging, re
from datetime import datetime, timezone
from game_data import (ITEMS, MONSTERS, ABILITIES, CLASSES, NPCS, MERCHANTS, QUESTS, XP_TABLE, MAX_LEVEL, INV_SLOTS, TICK, COMBAT,
                       PLAYER_SPEED, PICKUP_RANGE, NPC_RANGE, LOOT_OWNER_SECS, LOOT_EXPIRE_SECS, ACTIONS, RESTOCK_SECS, sell_price, default_binds)
from world import World, in_safe, SAFE_ZONES

log = logging.getLogger("game")
rnd = random.Random()
VIEW_R2 = 85 ** 2
LINKDEAD_SECS = 15
TOWN_NAMES = {"semel": "Titus", "elderglen": "Elderglen"}


def now():
    return time.monotonic()


def dist(a, b):
    return math.hypot(a.x - b.x, a.z - b.z)


def uid():
    return uuid.uuid4().hex[:12]


class Monster:
    def __init__(self, mid, mtype, spawn, world):
        self.id, self.type, self.d, self.spawn, self.world = mid, mtype, MONSTERS[mtype], spawn, world
        self.respawn()

    def respawn(self):
        s = self.spawn
        self.x, self.z = self.world.random_point(s["x"], s["z"], s["r"], rnd)
        self.hx, self.hz = self.x, self.z
        self.hp, self.max_hp = self.d["hp"], self.d["hp"]
        self.state, self.target, self.path, self.dots = "idle", None, [], []
        self.last_attack, self.next_wander, self.repath = 0, now() + rnd.uniform(1, 8), 0
        self.dead_until, self.dmg_by, self.rot, self.moving = 0, {}, rnd.uniform(0, 6.28), False


class Player:
    def __init__(self, doc, ws):
        self.doc_id = doc["id"]
        self.id = doc["id"]
        for k in ("account_id", "name", "cls", "level", "xp", "gold", "attrs", "attr_points", "skill_points", "abilities", "inventory",
                  "equipment", "quests", "binds", "x", "z", "hp", "mp"):
            setattr(self, k, doc[k])
        self.ws, self.queue = ws, asyncio.Queue(maxsize=400)
        self.path, self.target, self.pending, self.queued = [], None, None, None
        self.last_attack, self.cds, self.buffs, self.dots = 0, {}, {}, []
        self.dead_until, self.rot, self.moving, self.repath = 0, 0.0, False, 0
        self.chat_times, self.last_save, self.linkdead_at = [], now(), None
        self.dirty, self.regen_acc, self.rewarded = True, 0.0, set()
        self.recalc()
        self.hp = min(self.hp, self.max_hp) or self.max_hp
        self.mp = min(self.mp, self.max_mp)

    def weapon(self):
        e = self.equipment.get("main")
        return ITEMS[e["item"]] if e else dict(dmg=[1, 3], spd=1.5, magic=False, cls=None)

    def recalc(self):
        a = dict(self.attrs)
        armor = 0
        for e in self.equipment.values():
            it = ITEMS[e["item"]]
            armor += it.get("armor", 0)
            for k, v in it.get("stats", {}).items():
                a[k] = a.get(k, 0) + v
        if "armor" in self.buffs:
            armor += self.buffs["armor"][0]
        self.tot, self.armor = a, armor
        self.max_hp = 50 + self.level * 8 + a["sta"] * 6
        self.max_mp = 30 + self.level * 4 + a["wis"] * 6
        w = self.weapon()
        self.attack_interval = round(w["spd"] / (1 + a["dex"] * 0.012), 3)
        cls_ok = w.get("cls") and self.cls in w["cls"]
        self.range = CLASSES[self.cls]["range"] if cls_ok else 2.4
        self.crit = COMBAT["crit_base"] + a["dex"] * COMBAT["crit_per_dex"]
        lo, hi = self.dmg_range()
        self.dmg_lo, self.dmg_hi = lo, hi
        self.dirty = True

    def dmg_range(self):
        w = self.weapon()
        lo, hi = w["dmg"]
        a = self.tot
        if w.get("magic"):
            bonus = a["int"] * 0.6
        elif self.cls == "ranger" and self.range > 3:
            bonus = a["dex"] * 0.45
        else:
            bonus = a["str"] * 0.5
        return round(lo + bonus, 1), round(hi + bonus, 1)

    def speed(self):
        return PLAYER_SPEED * (1 + self.buffs["speed"][0] if "speed" in self.buffs else 1)

    def to_doc(self):
        return {k: getattr(self, k) for k in ("name", "cls", "level", "xp", "gold", "attrs", "attr_points", "skill_points", "abilities",
                                              "inventory", "equipment", "quests", "binds", "hp", "mp")} | {"x": round(self.x, 2), "z": round(self.z, 2)}

    def self_view(self):
        return self.to_doc() | dict(id=self.id, max_hp=self.max_hp, max_mp=self.max_mp, tot=self.tot, armor=self.armor, attack_interval=self.attack_interval,
                                    range=self.range, crit=round(self.crit, 3), dmg=[self.dmg_lo, self.dmg_hi], buffs={k: round(v[1] - now(), 1) for k, v in self.buffs.items()},
                                    cds={k: round(v - now(), 2) for k, v in self.cds.items() if v > now()})

    def send(self, msg):
        if self.ws is None:
            return
        try:
            self.queue.put_nowait(msg)
        except asyncio.QueueFull:
            pass


class Game:
    def __init__(self, db):
        self.db = db
        self.world = World()
        self.players = {}
        self.monsters = {}
        self.loot = {}
        self.stock = {k: {i: q for i, q in v["stock"]} for k, v in MERCHANTS.items()}
        self.last_restock = now()
        n = 0
        for s in self.world.spawns:
            for _ in range(s["n"]):
                n += 1
                mid = f"m{n}"
                self.monsters[mid] = Monster(mid, s["monster"], s, self.world)
        self.task = None
        self.tick_ms = 0

    # ------------- lifecycle
    def start(self):
        self.task = asyncio.create_task(self.loop())

    async def loop(self):
        last = now()
        while True:
            t0 = now()
            dt = min(0.25, t0 - last)
            last = t0
            try:
                self.tick(dt)
                await self.housekeeping()
            except Exception:
                log.exception("tick error")
            self.tick_ms = (now() - t0) * 1000
            await asyncio.sleep(max(0.01, TICK - (now() - t0)))

    async def housekeeping(self):
        t = now()
        for p in list(self.players.values()):
            if p.linkdead_at and t - p.linkdead_at > LINKDEAD_SECS:
                await self.remove_player(p)
            elif t - p.last_save > 20:
                p.last_save = t
                await self.save(p)
        if t - self.last_restock > RESTOCK_SECS:
            self.last_restock = t
            self.stock = {k: {i: q for i, q in v["stock"]} for k, v in MERCHANTS.items()}

    async def save(self, p):
        await self.db.characters.update_one({"id": p.doc_id}, {"$set": p.to_doc() | {"updated_at": datetime.now(timezone.utc).isoformat()}})

    async def remove_player(self, p):
        if self.players.get(p.id) is p:
            del self.players[p.id]
            await self.save(p)
            for m in self.monsters.values():
                if m.target == p.id:
                    m.target = None
            self.broadcast_sys(f"{p.name} has left the world.")

    async def attach(self, doc, ws):
        p = self.players.get(doc["id"])
        if p:
            old = p.ws
            p.ws, p.linkdead_at, p.queue = ws, None, asyncio.Queue(maxsize=400)
            if old is not None and old is not ws:
                try:
                    await old.close(code=4001)
                except Exception:
                    pass
        else:
            p = Player(doc, ws)
            if not self.world.walkable(p.x, p.z):
                p.x, p.z = self.world.nearest_walkable(p.x, p.z, 10) or (SAFE_ZONES[0]["x"], SAFE_ZONES[0]["z"] - 6)
            self.players[p.id] = p
            self.broadcast_sys(f"{p.name} has entered the world.")
        chat = await self.db.chat.find({}, {"_id": 0}).sort("ts", -1).to_list(40)
        p.send({"t": "init", "me": p.self_view(), "chat": list(reversed(chat)), "stock": None})
        return p

    def detach(self, p, ws):
        if p.ws is ws:
            p.ws, p.linkdead_at = None, now()

    # ------------- simulation
    def tick(self, dt):
        t = now()
        for p in list(self.players.values()):
            self.tick_player(p, dt, t)
        for m in self.monsters.values():
            self.tick_monster(m, dt, t)
        for lid in [k for k, l in self.loot.items() if t > l["expires"]]:
            del self.loot[lid]
        for p in self.players.values():
            if p.ws is not None:
                p.send(self.snapshot(p))
                if p.dirty:
                    p.dirty = False
                    p.send({"t": "me", "me": p.self_view()})

    def snapshot(self, p):
        ps, ms, ls = [], [], []
        for o in self.players.values():
            if (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < VIEW_R2:
                eq = "|".join(o.equipment[s]["item"] if s in o.equipment else "" for s in ("main", "off", "head", "chest"))
                ps.append([o.id, o.name, o.level, o.cls, round(o.x, 2), round(o.z, 2), round(o.rot, 2), 1 if o.moving else 0,
                           round(o.hp), o.max_hp, eq, 1 if o.dead_until else 0, 1 if o.linkdead_at else 0])
        for m in self.monsters.values():
            if (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < VIEW_R2 and not (m.dead_until and now() - m.died_at > 4):
                ms.append([m.id, m.type, round(m.x, 2), round(m.z, 2), round(m.rot, 2), 2 if m.dead_until else (1 if m.moving else 0),
                           round(m.hp), m.max_hp, 1 if m.target == p.id else 0])
        t = now()
        for l in self.loot.values():
            if (l["x"] - p.x) ** 2 + (l["z"] - p.z) ** 2 < VIEW_R2:
                mine = l["owner"] is None or l["owner"] == p.id or t > l["owner_until"]
                ls.append([l["id"], l["item"], l["qty"], l["x"], l["z"], 1 if mine else 0])
        return {"t": "s", "me": [round(p.x, 2), round(p.z, 2), round(p.hp), round(p.mp), p.target], "p": ps, "m": ms, "l": ls}

    def step_along(self, e, speed, dt, monster=False):
        e.moving = False
        if not e.path:
            return
        tx, tz = e.path[0]
        dx, dz = tx - e.x, tz - e.z
        d = math.hypot(dx, dz)
        stepd = speed * dt
        if d <= stepd:
            nx, nz = tx, tz
            e.path.pop(0)
        else:
            nx, nz = e.x + dx / d * stepd, e.z + dz / d * stepd
        if not self.world.walkable(nx, nz) or (monster and in_safe(nx, nz)):
            e.path = []
            return
        if d > 0.01:
            e.rot = math.atan2(dx, dz)
        e.x, e.z, e.moving = nx, nz, True

    def path_to(self, e, tx, tz, limit=25000, monster=False):
        path = self.world.find_path(e.x, e.z, tx, tz, limit=limit, avoid_safe=monster)
        e.path = path or []
        return path is not None

    def tick_player(self, p, dt, t):
        if p.dead_until:
            if t > p.dead_until:
                town = min(SAFE_ZONES, key=lambda s: (s["x"] - p.x) ** 2 + (s["z"] - p.z) ** 2)
                p.x, p.z = town["x"] + rnd.uniform(-4, 4), town["z"] + rnd.uniform(-8, -5)
                p.hp, p.mp, p.dead_until, p.path = p.max_hp * 0.6, p.max_mp * 0.6, 0, []
                p.send({"t": "sys", "msg": f"You awaken in the safe square of {TOWN_NAMES[town['town']]}."})
                p.dirty = True
            return
        changed = False
        for k in [k for k, v in p.buffs.items() if t > v[1]]:
            del p.buffs[k]
            changed = True
        if changed:
            p.recalc()
        self.tick_dots(p, t, is_player=True)
        p.regen_acc += dt
        if p.regen_acc >= 1.0:
            p.regen_acc -= 1.0
            mult = COMBAT["safe_regen_mult"] if in_safe(p.x, p.z) else 1.0
            p.hp = min(p.max_hp, p.hp + (COMBAT["hp_regen_base"] + p.tot["sta"] * COMBAT["hp_regen_per_sta"]) * mult)
            p.mp = min(p.max_mp, p.mp + (COMBAT["mp_regen_base"] + p.tot["wis"] * COMBAT["mp_regen_per_wis"]) * mult)
        if p.pending:
            kind, oid = p.pending
            obj = self.loot.get(oid) if kind == "loot" else NPCS.get(oid)
            if not obj:
                p.pending = None
            else:
                ox, oz = (obj["x"], obj["z"]) if kind == "loot" else obj["pos"]
                d = math.hypot(ox - p.x, oz - p.z)
                if d <= (PICKUP_RANGE if kind == "loot" else NPC_RANGE):
                    p.pending, p.path = None, []
                    self.pickup(p, oid) if kind == "loot" else self.npc_dialog(p, oid)
                elif not p.path and t > p.repath:
                    p.repath = t + 0.5
                    self.path_to(p, ox, oz)
        m = self.monsters.get(p.target) if p.target else None
        if m and m.dead_until:
            p.target, p.queued, m = None, None, None
        if m:
            reach = (ABILITIES[p.queued].get("range", p.range) if p.queued else p.range) + m.d["radius"]
            d = dist(p, m)
            if d > reach:
                if t > p.repath:
                    p.repath = t + 0.4
                    if self.world.los(p.x, p.z, m.x, m.z):
                        p.path = [(m.x, m.z)]
                    else:
                        self.path_to(p, m.x, m.z, limit=8000)
            else:
                p.path = []
                p.rot = math.atan2(m.x - p.x, m.z - p.z)
                if in_safe(p.x, p.z):
                    if t > p.repath:
                        p.repath = t + 3
                        p.send({"t": "err", "msg": "You cannot fight from within a safe square."})
                elif p.queued:
                    ab = p.queued
                    p.queued = None
                    self.do_cast(p, ab, m)
                elif t - p.last_attack >= p.attack_interval:
                    p.last_attack = t
                    self.basic_attack(p, m)
        self.step_along(p, p.speed(), dt)

    def tick_dots(self, e, t, is_player=False):
        keep = []
        for dot in e.dots:
            if t >= dot["next"]:
                dot["next"] += 1.0
                dot["n"] -= 1
                if is_player:
                    self.damage_player(e, dot["dmg"], None, "poison")
                else:
                    src = self.players.get(dot["src"])
                    self.damage_monster(e, dot["dmg"], src, "poison")
            if dot["n"] > 0:
                keep.append(dot)
        e.dots = keep

    def tick_monster(self, m, dt, t):
        d = m.d
        if m.dead_until:
            if t > m.dead_until:
                m.respawn()
            return
        if m.dots:
            self.tick_dots(m, t)
            if m.dead_until:
                return
        if d.get("regen") and m.hp < m.max_hp:
            m.hp = min(m.max_hp, m.hp + d["regen"] * dt)
        tgt = self.players.get(m.target) if m.target else None
        if m.state == "return":
            if not m.path:
                if math.hypot(m.x - m.hx, m.z - m.hz) < 2 or t > m.repath:
                    m.state, m.hp, m.dmg_by = "idle", m.max_hp, {}
                    m.next_wander = t + rnd.uniform(3, 8)
            self.step_along(m, d["speed"] * 1.4, dt, monster=True)
            return
        if tgt and (tgt.dead_until or in_safe(tgt.x, tgt.z) or math.hypot(m.x - m.hx, m.z - m.hz) > d["leash"] or dist(m, tgt) > d["leash"] * 1.5):
            tgt = None
        if not tgt and m.target:
            m.target, m.state = None, "return"
            m.repath = t + 12
            self.path_to(m, m.hx, m.hz, limit=6000, monster=True)
            return
        if not tgt:
            best = None
            for p in self.players.values():
                if p.dead_until or p.linkdead_at:
                    continue
                dd = dist(m, p)
                if dd < d["aggro"] and not in_safe(p.x, p.z) and (best is None or dd < best[0]):
                    best = (dd, p)
            if best:
                tgt = best[1]
                m.target = tgt.id
                m.state = "chase"
        if tgt:
            dd = dist(m, tgt)
            if dd > d["range"] + 0.5:
                if t > m.repath:
                    m.repath = t + 0.5
                    if self.world.los(m.x, m.z, tgt.x, tgt.z):
                        m.path = [(tgt.x, tgt.z)]
                    else:
                        self.path_to(m, tgt.x, tgt.z, limit=3000, monster=True)
                if m.path:
                    lx, lz = m.path[-1]
                    if math.hypot(lx - tgt.x, lz - tgt.z) > 1.5 and len(m.path) == 1:
                        m.path = [(tgt.x, tgt.z)]
                self.step_along(m, d["speed"], dt, monster=True)
                if m.path and dist(m, tgt) <= d["range"]:
                    m.path = []
            else:
                m.path, m.moving = [], False
                m.rot = math.atan2(tgt.x - m.x, tgt.z - m.z)
                if t - m.last_attack >= d["interval"]:
                    m.last_attack = t
                    self.monster_attack(m, tgt)
            return
        if t > m.next_wander:
            m.next_wander = t + rnd.uniform(4, 12)
            wx, wz = self.world.random_point(m.spawn["x"], m.spawn["z"], m.spawn["r"], rnd)
            if self.world.los(m.x, m.z, wx, wz):
                m.path = [(wx, wz)]
        self.step_along(m, d["speed"] * 0.45, dt, monster=True)

    # ------------- combat
    def hit_chance(self, att_lvl, def_lvl, def_dex):
        c = COMBAT["hit_base"] + (att_lvl - def_lvl) * COMBAT["hit_per_level"] - def_dex * COMBAT["evade_per_dex"]
        return max(COMBAT["hit_min"], min(COMBAT["hit_max"], c))

    def fx(self, x, z, msg):
        for p in self.players.values():
            if (p.x - x) ** 2 + (p.z - z) ** 2 < VIEW_R2:
                p.send(msg)

    def basic_attack(self, p, m):
        w = p.weapon()
        magic = bool(w.get("magic"))
        kind = "bolt" if magic and p.range > 3 else ("arrow" if p.range > 3 else "melee")
        if rnd.random() > self.hit_chance(p.level, m.d["level"], 0):
            self.fx(m.x, m.z, {"t": "fx", "k": "attack", "src": p.id, "tgt": m.id, "style": kind, "miss": 1})
            return
        dmg = rnd.uniform(p.dmg_lo, p.dmg_hi)
        crit = rnd.random() < p.crit
        if crit:
            dmg *= COMBAT["crit_mult"]
        self.fx(m.x, m.z, {"t": "fx", "k": "attack", "src": p.id, "tgt": m.id, "style": kind})
        self.damage_monster(m, dmg, p, "magic" if magic else "phys", crit)

    def damage_monster(self, m, raw, p, dtype, crit=False):
        if m.dead_until:
            return
        res = m.d["resist"].get("magic" if dtype in ("magic", "poison") else "phys", 1.0)
        armor = 0 if dtype != "phys" else m.d["armor"]
        dmg = max(1, round(raw * (1 - armor / (armor + COMBAT["armor_k"])) * res))
        m.hp -= dmg
        if p:
            m.dmg_by[p.id] = m.dmg_by.get(p.id, 0) + dmg
            if not m.target and m.state != "return":
                m.target, m.state = p.id, "chase"
        self.fx(m.x, m.z, {"t": "fx", "k": "dmg", "tgt": m.id, "v": dmg, "crit": 1 if crit else 0, "dt": dtype})
        if m.hp <= 0:
            self.kill_monster(m)

    def kill_monster(self, m):
        t = now()
        m.hp, m.dead_until, m.died_at, m.path, m.target, m.dots = 0, t + m.d["respawn"], t, [], None, []
        killer = self.players.get(max(m.dmg_by, key=m.dmg_by.get)) if m.dmg_by else None
        self.fx(m.x, m.z, {"t": "fx", "k": "death", "tgt": m.id})
        if not killer:
            return
        kill_key = f"{m.id}:{m.died_at}"
        if kill_key in killer.rewarded:
            return
        killer.rewarded.add(kill_key)
        if len(killer.rewarded) > 200:
            killer.rewarded = set(list(killer.rewarded)[-100:])
        lvl_diff = killer.level - m.d["level"]
        xp = m.d["xp"] if lvl_diff <= 4 else max(1, round(m.d["xp"] * max(0.1, 1 - (lvl_diff - 4) * 0.15)))
        self.give_xp(killer, xp)
        drops = [("gold", rnd.randint(*m.d["gold"]))]
        for item, chance in m.d["loot"]:
            if rnd.random() < chance:
                drops.append((item, 1))
        for i, (item, qty) in enumerate(drops):
            a = i * 2.1 + rnd.uniform(0, 1)
            lx, lz = m.x + math.cos(a) * (0.6 + 0.4 * i), m.z + math.sin(a) * (0.6 + 0.4 * i)
            if not self.world.walkable(lx, lz):
                lx, lz = m.x, m.z
            lid = "l" + uid()
            self.loot[lid] = dict(id=lid, item=item, qty=qty, x=round(lx, 2), z=round(lz, 2), owner=killer.id,
                                  owner_until=t + LOOT_OWNER_SECS, expires=t + LOOT_EXPIRE_SECS)
        for qid, q in killer.quests.items():
            qd = QUESTS[qid]
            if q["s"] == "active" and qd["kind"] in ("kill", "kill_collect") and qd["target"] == m.type and q["k"] < qd["count"]:
                q["k"] += 1
                killer.send({"t": "sys", "msg": f"[{qd['name']}] {MONSTERS[m.type]['name']} slain: {q['k']}/{qd['count']}", "kind": "quest"})
                killer.dirty = True

    def give_xp(self, p, xp):
        if p.level >= MAX_LEVEL:
            return
        p.xp += xp
        p.send({"t": "sys", "msg": f"+{xp} experience", "kind": "xp"})
        levels = 0
        while p.level < MAX_LEVEL and p.xp >= XP_TABLE[p.level + 1]:
            p.level += 1
            p.attr_points += 1
            p.skill_points += 1
            levels += 1
        if levels:
            p.recalc()
            r = COMBAT["levelup_restore"]
            p.hp = min(p.max_hp, p.hp + p.max_hp * r)
            p.mp = min(p.max_mp, p.mp + p.max_mp * r)
            self.fx(p.x, p.z, {"t": "fx", "k": "levelup", "src": p.id, "lv": p.level})
            p.send({"t": "levelup", "lv": p.level, "n": levels})
            self.broadcast_sys(f"{p.name} has reached level {p.level}!")
            asyncio.create_task(self.save(p))
        p.dirty = True

    def monster_attack(self, m, p):
        d = m.d
        style = "spell" if d.get("ranged") else "melee"
        if rnd.random() > self.hit_chance(d["level"], p.level, p.tot["dex"]):
            self.fx(m.x, m.z, {"t": "fx", "k": "mattack", "src": m.id, "tgt": p.id, "style": style, "miss": 1})
            return
        raw = rnd.uniform(*d["dmg"])
        self.fx(m.x, m.z, {"t": "fx", "k": "mattack", "src": m.id, "tgt": p.id, "style": style})
        k = COMBAT["armor_k"] + COMBAT["armor_k_per_level"] * d["level"]
        dmg = max(1, round(raw * (1 - p.armor / (p.armor + k))))
        self.damage_player(p, dmg, m, "phys")
        if d.get("poison"):
            p.dots.append(dict(dmg=d["poison"][0], n=d["poison"][1], next=now() + 1, src=m.id))

    def damage_player(self, p, dmg, m, dtype):
        if p.dead_until or in_safe(p.x, p.z):
            return
        p.hp -= dmg
        self.fx(p.x, p.z, {"t": "fx", "k": "pdmg", "tgt": p.id, "v": dmg, "dt": dtype})
        if p.hp <= 0:
            p.hp, p.dead_until, p.path, p.target, p.queued, p.dots, p.pending = 0, now() + 6, [], None, None, [], None
            self.fx(p.x, p.z, {"t": "fx", "k": "pdeath", "tgt": p.id})
            p.send({"t": "sys", "msg": "You have fallen. Your spirit returns to town...", "kind": "bad"})
            for mm in self.monsters.values():
                if mm.target == p.id:
                    mm.target = None
        p.dirty = True

    def cast(self, p, ab_id, target_id):
        ab = ABILITIES.get(ab_id)
        t = now()
        if not ab or p.dead_until:
            return "Unknown ability."
        if ab_id not in p.abilities:
            return f"{ab['name']} is locked."
        if ab["cls"] and ab["cls"] != p.cls:
            return "Your class cannot use that."
        if p.level < ab["level"]:
            return f"Requires level {ab['level']}."
        if p.cds.get(ab_id, 0) > t:
            return f"{ab['name']} is not ready."
        if p.mp < ab["cost"]:
            return "Not enough mana."
        needs_target = ab["kind"] in ("melee", "spell", "ranged", "dot", "aoe_target")
        if needs_target:
            m = self.monsters.get(target_id or p.target)
            if not m or m.dead_until:
                return "You need a target."
            if dist(p, m) > ab["range"] + m.d["radius"]:
                p.target, p.queued, p.pending = m.id, ab_id, None
                return None
            return self.do_cast(p, ab_id, m)
        if ab["kind"] in ("aoe_self", "multi") and in_safe(p.x, p.z):
            return "You cannot fight from within a safe square."
        return self.do_cast(p, ab_id, None)

    def do_cast(self, p, ab_id, m):
        ab = ABILITIES[ab_id]
        t = now()
        if p.mp < ab["cost"] or p.cds.get(ab_id, 0) > t:
            return "Not ready."
        if m and in_safe(p.x, p.z):
            return "You cannot fight from within a safe square."
        p.mp -= ab["cost"]
        p.cds[ab_id] = t + ab["cd"]
        k = ab["kind"]
        self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": ab_id, "tgt": m.id if m else None})
        if k in ("melee", "ranged"):
            p.last_attack = t
            dmg = rnd.uniform(p.dmg_lo, p.dmg_hi) * ab["mult"] + ab["flat"]
            crit = rnd.random() < p.crit
            self.damage_monster(m, dmg * (COMBAT["crit_mult"] if crit else 1), p, "phys", crit)
        elif k == "spell":
            dmg = ab["base"] + p.tot["int"] * ab["scale"] + rnd.uniform(0, 4)
            crit = rnd.random() < p.crit
            self.damage_monster(m, dmg * (COMBAT["crit_mult"] if crit else 1), p, "magic", crit)
        elif k == "aoe_target" or k == "aoe_self":
            cx, cz = (m.x, m.z) if m else (p.x, p.z)
            for mm in list(self.monsters.values()):
                if not mm.dead_until and math.hypot(mm.x - cx, mm.z - cz) <= ab["radius"] + mm.d["radius"]:
                    if "base" in ab:
                        self.damage_monster(mm, ab["base"] + p.tot["int"] * ab["scale"] + rnd.uniform(0, 4), p, "magic")
                    else:
                        self.damage_monster(mm, rnd.uniform(p.dmg_lo, p.dmg_hi) * ab["mult"] + ab["flat"], p, "phys")
        elif k == "multi":
            near = sorted((mm for mm in self.monsters.values() if not mm.dead_until and dist(p, mm) <= ab["range"] + mm.d["radius"] and not in_safe(mm.x, mm.z)), key=lambda mm: dist(p, mm))[:ab["count"]]
            p.last_attack = t
            for mm in near:
                self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": "aimed_shot", "tgt": mm.id})
                self.damage_monster(mm, rnd.uniform(p.dmg_lo, p.dmg_hi) * ab["mult"] + ab["flat"], p, "phys")
        elif k == "dot":
            per = ab["base"] + p.tot["dex"] * ab["scale"]
            m.dots.append(dict(dmg=per, n=ab["ticks"], next=t + 1, src=p.id))
            self.damage_monster(m, per, p, "poison")
        elif k == "heal":
            amt = round(ab["base"] + p.tot["wis"] * ab["scale"])
            p.hp = min(p.max_hp, p.hp + amt)
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": amt})
        elif k == "buff":
            p.buffs[ab["buff"]] = (ab["value"], t + ab["dur"])
            p.recalc()
        p.dirty = True
        return None

    # ------------- items
    def can_add(self, p, item, qty):
        it = ITEMS[item]
        if item == "gold":
            return True
        room = 0
        for s in p.inventory:
            if s["item"] == item and it["stack"] > 1:
                room += it["stack"] - s["qty"]
        room += (INV_SLOTS - len(p.inventory)) * it["stack"]
        return room >= qty

    def add_item(self, p, item, qty):
        if item == "gold":
            p.gold += qty
            p.dirty = True
            return True
        if not self.can_add(p, item, qty):
            return False
        it = ITEMS[item]
        for s in p.inventory:
            if qty and s["item"] == item and s["qty"] < it["stack"]:
                n = min(qty, it["stack"] - s["qty"])
                s["qty"] += n
                qty -= n
        while qty > 0:
            n = min(qty, it["stack"])
            p.inventory.append(dict(uid=uid(), item=item, qty=n))
            qty -= n
        p.dirty = True
        return True

    def count_item(self, p, item):
        return sum(s["qty"] for s in p.inventory if s["item"] == item)

    def take_item(self, p, item, qty):
        for s in list(p.inventory):
            if qty and s["item"] == item:
                n = min(qty, s["qty"])
                s["qty"] -= n
                qty -= n
                if s["qty"] <= 0:
                    p.inventory.remove(s)
        p.dirty = True

    def slot_of(self, p, suid):
        return next((s for s in p.inventory if s["uid"] == suid), None)

    def pickup(self, p, lid):
        l = self.loot.get(lid)
        if not l:
            return p.send({"t": "err", "msg": "That item is gone."})
        if math.hypot(l["x"] - p.x, l["z"] - p.z) > PICKUP_RANGE + 0.3:
            return p.send({"t": "err", "msg": "Too far away."})
        if l["owner"] and l["owner"] != p.id and now() < l["owner_until"]:
            return p.send({"t": "err", "msg": "That loot belongs to another adventurer for now."})
        if not self.add_item(p, l["item"], l["qty"]):
            return p.send({"t": "err", "msg": "Your inventory is full."})
        del self.loot[lid]
        p.send({"t": "pickup", "item": l["item"], "qty": l["qty"]})

    # ------------- npcs / quests / merchants
    def near_npc(self, p, npc_id, flag=None):
        n = NPCS.get(npc_id)
        if not n or (flag and not n.get(flag)):
            return None
        if math.hypot(n["pos"][0] - p.x, n["pos"][1] - p.z) > NPC_RANGE + 1.5:
            return None
        return n

    def quest_ready(self, p, qid):
        qd, q = QUESTS[qid], p.quests.get(qid)
        if not q or q["s"] != "active":
            return False
        if qd["kind"] == "kill":
            return q["k"] >= qd["count"]
        if qd["kind"] == "kill_collect":
            return q["k"] >= qd["count"] and self.count_item(p, qd["collect"]) >= qd["collect_count"]
        if qd["kind"] == "deliver":
            return self.count_item(p, qd["item"]) >= 1
        return False

    def npc_dialog(self, p, npc_id):
        n = self.near_npc(p, npc_id)
        if not n:
            return p.send({"t": "err", "msg": "You are too far away."})
        opts, text = [], {"smith": "Steel for the road, traveler?", "merchant": "Supplies for the journey? I've a fair price.",
                          "healer": "Rest a moment. The light will mend you.", "druid": "The grove's breath will restore you.",
                          "elder": "Titus has endured, but the woods grow restless.", "guard": "Keep your blade sharp out there.",
                          "villager": "Fine day, isn't it? Mind the spiders past the north gate.", "child": "Are you a real adventurer?!"}.get(n["kind"], "Greetings.")
        if n.get("merchant"):
            opts.append(dict(id="trade", label="Trade"))
        if n.get("healer"):
            opts.append(dict(id="heal", label="Heal me"))
        for qid in n.get("quests", []):
            q = p.quests.get(qid)
            if not q:
                opts.append(dict(id=f"accept:{qid}", label=f"Quest: {QUESTS[qid]['name']}", text=QUESTS[qid]["text"]))
        for qid, qd in QUESTS.items():
            if qd["turnin"] == npc_id and self.quest_ready(p, qid):
                opts.append(dict(id=f"complete:{qid}", label=f"Complete: {qd['name']}"))
            elif qd["turnin"] == npc_id and p.quests.get(qid, {}).get("s") == "active":
                text = f"How goes '{qd['name']}'? Return when the task is done."
        if npc_id == "lyra" and p.quests.get("q_letter", {}).get("s") == "done":
            text = "Thank you for the letter. Elderglen stands with Titus."
        p.send({"t": "dialog", "npc": npc_id, "text": text, "opts": opts})

    def npc_action(self, p, npc_id, action):
        n = self.near_npc(p, npc_id)
        if not n:
            return "You are too far away."
        if action == "trade" and n.get("merchant"):
            return p.send(self.merchant_view(n["merchant"], npc_id))
        if action == "heal" and n.get("healer"):
            p.hp, p.mp, p.dots, p.dirty = p.max_hp, p.max_mp, [], True
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": 0})
            return p.send({"t": "sys", "msg": f"{n['name']} restores you fully."})
        if action.startswith("accept:"):
            qid = action[7:]
            if qid not in n.get("quests", []) or qid in p.quests:
                return "Cannot accept that quest."
            qd = QUESTS[qid]
            if qd["kind"] == "deliver" and not self.add_item(p, qd["item"], 1):
                return "Your inventory is full."
            p.quests[qid] = dict(s="active", k=0)
            p.dirty = True
            return p.send({"t": "sys", "msg": f"Quest accepted: {qd['name']}", "kind": "quest"})
        if action.startswith("complete:"):
            qid = action[9:]
            qd = QUESTS.get(qid)
            if not qd or qd["turnin"] != npc_id or not self.quest_ready(p, qid):
                return "That task is not complete."
            r = qd["reward"]
            if not all(self.can_add(p, i, q) for i, q in r["items"]):
                return "Make room in your inventory first."
            if qd["kind"] == "kill_collect":
                self.take_item(p, qd["collect"], qd["collect_count"])
            if qd["kind"] == "deliver":
                self.take_item(p, qd["item"], 1)
            p.quests[qid]["s"] = "done"
            for i, q in r["items"]:
                self.add_item(p, i, q)
            p.gold += r["gold"]
            p.send({"t": "sys", "msg": f"Quest complete: {qd['name']} (+{r['gold']} gold)", "kind": "quest"})
            self.give_xp(p, r["xp"])
            asyncio.create_task(self.save(p))
            return None
        return "Nothing happens."

    def merchant_view(self, mk, npc_id):
        return {"t": "merchant", "npc": npc_id, "mk": mk, "name": MERCHANTS[mk]["name"],
                "stock": [dict(item=i, qty=q, price=ITEMS[i]["price"]) for i, q in self.stock[mk].items()]}

    def buy(self, p, npc_id, item, qty):
        n = self.near_npc(p, npc_id, "merchant")
        if not n:
            return "You must stand near the merchant."
        stock = self.stock[n["merchant"]]
        if item not in stock or not isinstance(qty, int) or qty < 1 or qty > 50:
            return "Invalid purchase."
        if stock[item] != -1 and stock[item] < qty:
            return "The merchant doesn't have that many."
        cost = ITEMS[item]["price"] * qty
        if p.gold < cost:
            return "You cannot afford that."
        if not self.add_item(p, item, qty):
            return "Not enough inventory space."
        p.gold -= cost
        if stock[item] != -1:
            stock[item] -= qty
        p.send({"t": "trade", "msg": f"Bought {qty}x {ITEMS[item]['name']} for {cost} gold."})
        p.send(self.merchant_view(n["merchant"], npc_id))
        asyncio.ensure_future(self.db.transactions.insert_one(dict(char=p.id, kind="buy", item=item, qty=qty, gold=cost, ts=datetime.now(timezone.utc).isoformat())))
        asyncio.create_task(self.save(p))

    def sell(self, p, npc_id, suid, qty):
        n = self.near_npc(p, npc_id, "merchant")
        if not n:
            return "You must stand near the merchant."
        s = self.slot_of(p, suid)
        if not s or not isinstance(qty, int) or qty < 1 or qty > s["qty"]:
            return "Invalid sale."
        it = ITEMS[s["item"]]
        if it["type"] == "quest" or it["price"] <= 0:
            return "The merchant won't buy that."
        gain = sell_price(s["item"]) * qty
        s["qty"] -= qty
        if s["qty"] <= 0:
            p.inventory.remove(s)
        p.gold += gain
        p.dirty = True
        p.send({"t": "trade", "msg": f"Sold {qty}x {it['name']} for {gain} gold."})
        asyncio.ensure_future(self.db.transactions.insert_one(dict(char=p.id, kind="sell", item=s["item"], qty=qty, gold=gain, ts=datetime.now(timezone.utc).isoformat())))
        asyncio.create_task(self.save(p))

    def equip(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        it = ITEMS[s["item"]]
        if it["type"] not in ("weapon", "armor"):
            return "That cannot be equipped."
        if it.get("cls") and p.cls not in it["cls"]:
            return f"Only {', '.join(c.capitalize() for c in it['cls'])}s can use that."
        if p.level < it.get("lvl", 1):
            return f"Requires level {it['lvl']}."
        slot = it["slot"]
        p.inventory.remove(s)
        old = p.equipment.get(slot)
        p.equipment[slot] = dict(uid=s["uid"], item=s["item"])
        if old:
            p.inventory.append(dict(uid=old["uid"], item=old["item"], qty=1))
        p.recalc()
        p.hp, p.mp = min(p.hp, p.max_hp), min(p.mp, p.max_mp)
        p.send({"t": "equip", "item": s["item"]})

    def unequip(self, p, slot):
        e = p.equipment.get(slot)
        if not e:
            return "Nothing equipped there."
        if len(p.inventory) >= INV_SLOTS:
            return "Your inventory is full."
        del p.equipment[slot]
        p.inventory.append(dict(uid=e["uid"], item=e["item"], qty=1))
        p.recalc()
        p.hp, p.mp = min(p.hp, p.max_hp), min(p.mp, p.max_mp)

    def use(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        it = ITEMS[s["item"]]
        if it["type"] != "consumable":
            return self.equip(p, suid) if it["type"] in ("weapon", "armor") else "You can't use that."
        if p.cds.get("potion", 0) > now():
            return "You must wait before drinking again."
        p.cds["potion"] = now() + 2
        p.hp = min(p.max_hp, p.hp + it.get("heal", 0))
        p.mp = min(p.max_mp, p.mp + it.get("mana", 0))
        s["qty"] -= 1
        if s["qty"] <= 0:
            p.inventory.remove(s)
        p.dirty = True
        self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": it.get("heal", 0)})

    def destroy(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        if ITEMS[s["item"]]["type"] == "quest":
            return "You cannot discard a quest item."
        p.inventory.remove(s)
        p.dirty = True

    # ------------- chat
    def broadcast_sys(self, msg):
        for p in self.players.values():
            p.send({"t": "chat", "m": dict(kind="system", text=msg, ts=datetime.now(timezone.utc).isoformat())})

    async def chat(self, p, text):
        text = re.sub(r"[\x00-\x1f\x7f<>]", "", str(text or "")).strip()[:200]
        if not text:
            return
        t = now()
        p.chat_times = [x for x in p.chat_times if t - x < 10]
        if len(p.chat_times) >= 5 or (p.chat_times and t - p.chat_times[-1] < 0.8):
            return p.send({"t": "err", "msg": "You are sending messages too quickly."})
        p.chat_times.append(t)
        ts = datetime.now(timezone.utc).isoformat()
        if text.startswith("/w "):
            parts = text.split(" ", 2)
            if len(parts) < 3:
                return p.send({"t": "err", "msg": "Usage: /w Name message"})
            o = next((x for x in self.players.values() if x.name.lower() == parts[1].lower()), None)
            if not o:
                return p.send({"t": "err", "msg": f"{parts[1]} is not online."})
            m = dict(kind="whisper", name=p.name, to=o.name, lvl=p.level, text=parts[2], ts=ts)
            o.send({"t": "chat", "m": m})
            if o is not p:
                p.send({"t": "chat", "m": m})
            return
        m = dict(kind="world", name=p.name, lvl=p.level, cls=p.cls, text=text, ts=ts)
        await self.db.chat.insert_one(dict(m))
        for o in self.players.values():
            o.send({"t": "chat", "m": m})

    # ------------- dispatch
    async def handle(self, p, msg):
        t = msg.get("t")
        err = None
        if t == "ping":
            return p.send({"t": "pong", "c": msg.get("c")})
        if t == "chat":
            return await self.chat(p, msg.get("msg"))
        if t == "logout":
            await self.remove_player(p)
            return "logout"
        if t == "binds":
            binds = msg.get("binds") or {}
            clean = {k: str(v)[:24] for k, v in binds.items() if k in ACTIONS and isinstance(v, str)}
            vals = [v for v in clean.values() if v]
            if len(vals) != len(set(vals)):
                err = "Duplicate key bindings are not allowed."
            else:
                p.binds = clean
                p.dirty = True
                await self.save(p)
                p.send({"t": "sys", "msg": "Key bindings saved."})
        elif t == "inspect":
            o = self.players.get(msg.get("id"))
            if o:
                p.send({"t": "inspect", "d": dict(id=o.id, name=o.name, level=o.level, cls=o.cls, tot=o.tot, armor=o.armor, max_hp=o.max_hp,
                                                  equipment={k: v["item"] for k, v in o.equipment.items()})})
        elif t == "alloc":
            a = msg.get("attr")
            if a in p.attrs and p.attr_points > 0:
                p.attrs[a] += 1
                p.attr_points -= 1
                p.recalc()
            else:
                err = "No attribute points available."
        elif t == "unlock":
            ab = ABILITIES.get(msg.get("ab"))
            if not ab or msg.get("ab") in p.abilities:
                err = "Cannot learn that."
            elif ab["cls"] and ab["cls"] != p.cls:
                err = "Your class cannot learn that."
            elif p.level < ab["level"]:
                err = f"Requires level {ab['level']}."
            elif p.skill_points < 1:
                err = "You need a skill point."
            else:
                p.skill_points -= 1
                p.abilities.append(msg["ab"])
                p.dirty = True
                p.send({"t": "sys", "msg": f"You learned {ab['name']}!", "kind": "quest"})
        elif t == "equip":
            err = self.equip(p, msg.get("uid"))
        elif t == "unequip":
            err = self.unequip(p, msg.get("slot"))
        elif t == "use":
            err = self.use(p, msg.get("uid"))
        elif t == "destroy":
            err = self.destroy(p, msg.get("uid"))
        elif p.dead_until:
            err = "You are dead."
        elif t == "move":
            x, z = msg.get("x"), msg.get("z")
            if not isinstance(x, (int, float)) or not isinstance(z, (int, float)) or math.hypot(x - p.x, z - p.z) > 140:
                err = "Invalid destination."
            else:
                p.target, p.queued, p.pending = None, None, None
                if not self.path_to(p, float(x), float(z), limit=6000 if msg.get("hold") else 25000) and not msg.get("hold"):
                    err = "You can't reach that spot."
        elif t == "stop":
            p.path, p.target, p.queued, p.pending = [], None, None, None
        elif t == "target":
            m = self.monsters.get(msg.get("id"))
            if m and not m.dead_until and dist(p, m) < 90:
                p.target, p.pending, p.queued = m.id, None, None
            else:
                err = "Invalid target."
        elif t == "attack_nearest":
            best = min((m for m in self.monsters.values() if not m.dead_until and dist(p, m) < 25), key=lambda m: dist(p, m), default=None)
            if best:
                p.target, p.pending = best.id, None
            else:
                err = "No enemies nearby."
        elif t == "cast":
            err = self.cast(p, msg.get("ab"), msg.get("id"))
        elif t == "pickup":
            if msg.get("id") in self.loot:
                p.pending, p.target = ("loot", msg["id"]), None
                p.path = []
            else:
                err = "That item is gone."
        elif t == "npc":
            nid = msg.get("id")
            if nid in NPCS:
                if msg.get("action") in (None, "talk"):
                    p.pending, p.target = ("npc", nid), None
                    p.path = []
                else:
                    err = self.npc_action(p, nid, msg["action"])
        elif t == "buy":
            err = self.buy(p, msg.get("npc"), msg.get("item"), msg.get("qty", 1))
        elif t == "sell":
            err = self.sell(p, msg.get("npc"), msg.get("uid"), msg.get("qty", 1))
        if err:
            p.send({"t": "err", "msg": err})


def new_character_doc(account_id, name, cls):
    c = CLASSES[cls]
    eq = {"main": dict(uid=uid(), item=c["weapon"])}
    if c["offhand"]:
        eq["off"] = dict(uid=uid(), item=c["offhand"])
    eq["chest"] = dict(uid=uid(), item="padded_tunic")
    return dict(id=uuid.uuid4().hex, account_id=account_id, name=name, name_lower=name.lower(), cls=cls, level=1, xp=0, gold=25,
                attrs=dict(c["attrs"]), attr_points=0, skill_points=0, abilities=[c["start_ability"]],
                inventory=[dict(uid=uid(), item="minor_hp", qty=5), dict(uid=uid(), item="bread", qty=3)], equipment=eq, quests={},
                binds=default_binds(cls), x=90.0 + random.uniform(-3, 3), z=192.0, hp=9999, mp=9999, schema=1,
                created_at=datetime.now(timezone.utc).isoformat())
