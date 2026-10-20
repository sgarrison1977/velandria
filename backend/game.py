"""Authoritative real-time game simulation for Velandria."""
import asyncio, time, math, random, uuid, json, logging, re
from datetime import datetime, timezone
from game_data import (STORAGE_SLOTS, ITEMS, MONSTERS, ABILITIES, CLASSES, NPCS, MERCHANTS, QUESTS, XP_TABLE, MAX_LEVEL, INV_SLOTS, TICK, COMBAT,
                       PLAYER_SPEED, PICKUP_RANGE, NPC_RANGE, LOOT_OWNER_SECS, LOOT_EXPIRE_SECS, ACTIONS, RESTOCK_SECS, sell_price, default_binds, EXTRA_ROLLS, BONUS_LOOT, WAYSTONE_COST, roll_props, random_gear, RANDOM_GEAR_CHANCE, rare_gear, BOUNTIES, BOUNTY_SHOP, SETS, VEXMOOR_SET)
from world import PORTALS, World, in_safe, SAFE_ZONES, PIT_ROOMS, to_global
from game_data import PIT_CHAMPION_KILLS, FERRY_COST, FERRY_DEST, CHEST_COOLDOWN

log = logging.getLogger("game")
rnd = random.Random()
VIEW_R2 = 85 ** 2
LINKDEAD_SECS = 15
PARTY_MAX, PARTY_SHARE_R, PARTY_XP_BONUS = 5, 60.0, 0.15
SKILL_POINTS_PER_LEVEL = 3
DASH_SPEED = 24.0
GLOBAL_CD = 0.3
ATTR_POINTS_PER_LEVEL = 3
PORTAL_SECS = 10
RING_SLOTS = [f"ring{i}" for i in range(1, 7)]
LOOT_ALL_R = 8.0
GIVE_STATS = {"dmg", "str", "sta", "wis", "int", "dex", "hp_regen", "mp_regen", "life_steal", "mana_steal", "crit", "max_hp", "max_mp", "armor",
              "move_speed", "fire_dmg", "frost_dmg", "lightning_dmg"}
TOWN_NAMES = {"semel": "Titus", "elderglen": "Elderglen", "ironhold": "Ironhold", "sunhollow": "Sunhollow", "harbor": "Saltmere Harbor", "isles": "the Isle of Thorns"}


def fmt_secs(s):
    s = int(s)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


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
        self.max_mp = round((200 + self.d["level"] * 20) * (3 if self.d.get("boss") or self.d.get("champion") else 1))
        self.mp = self.max_mp
        self.state, self.target, self.path, self.dots = "idle", None, [], []
        self.last_attack, self.next_wander, self.repath = 0, now() + rnd.uniform(1, 8), 0
        self.dead_until, self.dmg_by, self.rot, self.moving = 0, {}, rnd.uniform(0, 6.28), False
        self.rise_until = now() + 1.3 if s.get("rise") else 0
        self.phase2 = False


class Player:
    def __init__(self, doc, ws):
        self.doc_id = doc["id"]
        self.id = doc["id"]
        for k in ("account_id", "name", "cls", "level", "xp", "gold", "attrs", "attr_points", "skill_points", "abilities", "inventory",
                  "equipment", "quests", "binds", "x", "z", "hp", "mp"):
            setattr(self, k, doc[k])
        self.look = doc.get("look") or {}
        self.home = doc.get("home")
        self.bounties = doc.get("bounties") or {}
        self.ws, self.queue = ws, asyncio.Queue(maxsize=400)
        self.path, self.target, self.pending, self.queued = [], None, None, None
        self.last_attack, self.cds, self.buffs, self.dots = 0, {}, {}, []
        self.dead_until, self.rot, self.moving, self.repath = 0, 0.0, False, 0
        self.dash, self.next_cast = None, 0
        self.chat_times, self.last_save, self.linkdead_at = [], now(), None
        self.dirty, self.regen_acc, self.rewarded = True, 0.0, set()
        self.marks = doc.get("marks") or {}
        self.binds = {k: v for k, v in self.binds.items() if k in ACTIONS}
        if "ring" in self.equipment:
            self.equipment["ring1"] = self.equipment.pop("ring")
        if "loot_all" not in self.binds and "KeyF" not in self.binds.values():
            self.binds["loot_all"] = "KeyF"
        if self.cls == "mage":
            self.cls = "wizard"
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
            for k, v in list(it.get("stats", {}).items()) + list((e.get("props") or {}).items()):
                if k == "armor":
                    armor += v
                else:
                    a[k] = a.get(k, 0) + v
        sc = {}
        for e in self.equipment.values():
            if ITEMS[e["item"]].get("set"):
                sc[ITEMS[e["item"]]["set"]] = sc.get(ITEMS[e["item"]]["set"], 0) + 1
        for sid, cnt in sc.items():
            for need, bon in SETS[sid]["bonuses"].items():
                if cnt >= need:
                    for k, v in bon.items():
                        if k != "text":
                            a[k] = a.get(k, 0) + v
        if "armor" in self.buffs:
            armor += self.buffs["armor"][0]
        if "str" in self.buffs:
            a["str"] += self.buffs["str"][0]
        self.tot, self.armor = a, round(armor)
        self.max_hp = round((50 + self.level * 8 + a["sta"] * 6 + a.get("max_hp", 0)) * (1 + a.get("max_hp_pct", 0) / 100))
        self.max_mp = 30 + self.level * 4 + a["wis"] * 6 + a.get("max_mp", 0)
        w = self.weapon()
        self.attack_interval = round(w["spd"] / (1 + a["dex"] * 0.012), 3)
        cls_ok = w.get("cls") and self.cls in w["cls"]
        self.range = CLASSES[self.cls]["range"] if cls_ok else 2.4
        self.crit = COMBAT["crit_base"] + a["dex"] * COMBAT["crit_per_dex"] + a.get("crit", 0) / 100
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
        bonus += a.get("dmg", 0)
        return round(lo + bonus, 1), round(hi + bonus, 1)

    def speed(self):
        return PLAYER_SPEED * (1 + (self.buffs["speed"][0] if "speed" in self.buffs else 0) + self.tot.get("move_speed", 0) / 100)

    def to_doc(self):
        return {k: getattr(self, k) for k in ("name", "cls", "level", "xp", "gold", "attrs", "attr_points", "skill_points", "abilities",
                                              "inventory", "equipment", "quests", "binds", "hp", "mp", "marks", "home", "bounties")} | {"x": round(self.x, 2), "z": round(self.z, 2)}

    def self_view(self):
        return self.to_doc() | dict(id=self.id, look=self.look, max_hp=self.max_hp, max_mp=self.max_mp, tot=self.tot, armor=self.armor, attack_interval=self.attack_interval,
                                    range=self.range, crit=round(self.crit, 3), dmg=[self.dmg_lo, self.dmg_hi], buffs={k: round(v[1] - now(), 1) for k, v in self.buffs.items()},
                                    cds={k: round(v - now(), 2) for k, v in self.cds.items() if v > now()}, admin=getattr(self, "admin", False))

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
        self.room_hits, self.room_cd, self.castle_runs = {}, {}, {}
        self.parties, self.invites, self.party_acc = {}, {}, 0.0
        self.storages, self.storage_lock = {}, asyncio.Lock()
        self.sched, self.gates = [], {}
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
        self.pit_kills, self.champ_n, self.spawn_q = {1: 0, 2: 0, 3: 0, 4: 0}, 0, []

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
        mark = getattr(p, "play_mark", now())
        end = p.linkdead_at if p.ws is None and p.linkdead_at else now()
        dt = int(max(0, end - mark))
        p.play_mark = mark + dt
        await self.db.characters.update_one({"id": p.doc_id}, {"$set": p.to_doc() | {"updated_at": datetime.now(timezone.utc).isoformat()}, "$inc": {"play_seconds": dt}})
        if dt:
            await self.db.users.update_one({"id": p.account_id}, {"$inc": {"play_seconds": dt}})

    async def kick(self, p, reason):
        ws = p.ws
        p.ws = None
        if ws is not None:
            try:
                await ws.close(code=4002, reason=reason.encode()[:120].decode("utf-8", "ignore"))
            except Exception:
                pass
        await self.remove_player(p)

    def announce(self, text, title=None, chat=True):
        ts = datetime.now(timezone.utc).isoformat()
        for p in self.players.values():
            p.send({"t": "announce", "text": text, "title": title})
            if chat:
                p.send({"t": "chat", "m": dict(kind="system", text=f"[Announcement] {text}", ts=ts)})

    async def remove_player(self, p):
        if self.players.get(p.id) is p:
            self.party_leave(p)
            del self.players[p.id]
            await self.save(p)
            for m in self.monsters.values():
                if m.target == p.id:
                    m.target = None
            self.broadcast_sys(f"{p.name} has left the world.")

    async def attach(self, doc, ws, admin=False):
        p = self.players.get(doc["id"])
        if p:
            old = p.ws
            if p.linkdead_at and hasattr(p, "play_mark"):
                p.play_mark += now() - max(p.linkdead_at, p.play_mark)
            p.ws, p.linkdead_at, p.queue = ws, None, asyncio.Queue(maxsize=400)
            if old is not None and old is not ws:
                try:
                    await old.close(code=4001)
                except Exception:
                    pass
        else:
            p = Player(doc, ws)
            p.play_mark = now()
            if not self.world.walkable(p.x, p.z):
                p.x, p.z = self.world.nearest_walkable(p.x, p.z, 10) or (SAFE_ZONES[0]["x"], SAFE_ZONES[0]["z"] - 6)
            self.players[p.id] = p
            self.broadcast_sys(f"{p.name} has entered the world.")
        p.admin = admin
        chat = await self.db.chat.find({}, {"_id": 0}).sort("ts", -1).to_list(40)
        p.send({"t": "init", "me": p.self_view(), "chat": list(reversed(chat)), "stock": None})
        self.grant_spells(p)
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
        for mid in [k for k, m in self.monsters.items() if (m.d.get("champion") or m.spawn.get("add_of")) and m.dead_until and t > m.dead_until]:
            del self.monsters[mid]
        while self.spawn_q:
            c = self.spawn_q.pop()
            self.monsters[c.id] = c
        self.tick_sched(t)
        self.tick_castle_runs(t)
        for gid in [g for g, v in self.gates.items() if t > v["expires"]]:
            del self.gates[gid]
        self.party_acc += dt
        if self.party_acc >= 1.0:
            self.party_acc = 0.0
            for pid in list(self.parties):
                self.party_send(pid)
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
                rar = [ITEMS[e["item"]]["rarity"] for e in o.equipment.values()]
                eq += f"|{rar.count('legendary')},{rar.count('epic')}|" + "|".join(o.equipment[s]["item"] if s in o.equipment else "" for s in ("feet", "legs", "hands", "belt")) + "|" + ",".join(o.look.get(k, "") for k in ("skin", "hair", "hairStyle", "beardStyle", "face", "eyes"))
                if sum(1 for e in o.equipment.values() if ITEMS[e["item"]].get("set") == "vexmoor") >= 6:
                    eq += "|vx"
                ps.append([o.id, o.name, o.level, o.cls, round(o.x, 2), round(o.z, 2), round(o.rot, 2), 1 if o.moving else 0,
                           round(o.hp), o.max_hp, eq, 1 if o.dead_until else 0, 1 if o.linkdead_at else 0, 1 if "invis" in o.buffs else 0])
        for m in self.monsters.values():
            if (m.x - p.x) ** 2 + (m.z - p.z) ** 2 < VIEW_R2 and not (m.dead_until and now() - m.died_at > 4):
                ms.append([m.id, m.type, round(m.x, 2), round(m.z, 2), round(m.rot, 2), 2 if m.dead_until else (1 if m.moving else 0),
                           round(m.hp), m.max_hp, 1 if m.target == p.id else 0, 1 if getattr(m, "chill_until", 0) > now() and not m.dead_until else 0, 1 if m.rise_until > now() else 0])
        t = now()
        for l in self.loot.values():
            if (l["x"] - p.x) ** 2 + (l["z"] - p.z) ** 2 < VIEW_R2:
                mine = l["owner"] is None or l["owner"] == p.id or t > l["owner_until"]
                ls.append([l["id"], l["item"], l["qty"], l["x"], l["z"], 1 if mine else 0, l.get("pname") or ""])
        gs = [[g["id"], g["x"], g["z"], g["name"], round(g["expires"] - now(), 1)] for g in self.gates.values() if (g["x"] - p.x) ** 2 + (g["z"] - p.z) ** 2 < VIEW_R2]
        return {"t": "s", "me": [round(p.x, 2), round(p.z, 2), round(p.hp), round(p.mp), p.target], "p": ps, "m": ms, "l": ls, "g": gs}

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
                town = self.home_zone(p)
                p.x, p.z = town["x"] + rnd.uniform(-4, 4), town["z"] + rnd.uniform(-8, -5)
                p.hp, p.mp, p.dead_until, p.path = p.max_hp * 0.6, p.max_mp * 0.6, 0, []
                p.send({"t": "sys", "msg": f"You awaken in the safe square of {TOWN_NAMES[town['town']]}."})
                p.dirty = True
            return
        for pt in PORTALS:
            if (p.x - pt["x"]) ** 2 + (p.z - pt["z"]) ** 2 < 2.6:
                p.x, p.z = pt["to"]
                p.path, p.target, p.pending, p.queued = [], None, None, None
                p.send({"t": "sys", "msg": pt["msg"]})
                for mm in self.monsters.values():
                    if mm.target == p.id:
                        mm.target = None
                p.dirty = True
                return
        for g in self.gates.values():
            if (p.x - g["x"]) ** 2 + (p.z - g["z"]) ** 2 < 1.8 and t > g["ready"]:
                self.teleport(p, g["to"][0] + rnd.uniform(-1, 1), g["to"][1] + rnd.uniform(-1, 1), f"You step through {g['name']}'s portal.")
                return
        changed = False
        for k in [k for k, v in p.buffs.items() if t > v[1]]:
            del p.buffs[k]
            changed = True
            if k in ("armor", "speed", "str", "invis"):
                p.send({"t": "sys", "msg": f"{dict(armor='Teuri', speed='Velocitas', str='Robur', invis='Contra Visus')[k]} has worn off."})
        if changed:
            p.recalc()
        self.tick_dots(p, t, is_player=True)
        p.regen_acc += dt
        if p.regen_acc >= 1.0:
            p.regen_acc -= 1.0
            mult = COMBAT["safe_regen_mult"] if in_safe(p.x, p.z) else 1.0
            p.hp = min(p.max_hp, p.hp + (COMBAT["hp_regen_base"] + p.tot["sta"] * COMBAT["hp_regen_per_sta"]) * mult + p.tot.get("hp_regen", 0))
            p.mp = min(p.max_mp, p.mp + (COMBAT["mp_regen_base"] + p.tot["wis"] * COMBAT["mp_regen_per_wis"]) * mult + p.tot.get("mp_regen", 0))
        if getattr(p, "autoloot", None) and self.loot and t > getattr(p, "next_autoloot", 0):
            p.next_autoloot = t + 0.4
            self.loot_all(p, p.autoloot, radius=1.8, quiet=True)
        if p.dash:
            tx, tz = p.dash
            d, step = math.hypot(tx - p.x, tz - p.z), DASH_SPEED * dt
            if d <= step:
                p.x, p.z, p.dash = tx, tz, None
            else:
                p.x, p.z = p.x + (tx - p.x) / d * step, p.z + (tz - p.z) / d * step
            p.moving, p.dirty = True, True
            return
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
            if t > m.dead_until and not d.get("champion"):
                m.respawn()
            return
        if m.rise_until > t:
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
                    m.state, m.hp, m.mp, m.dmg_by = "idle", m.max_hp, m.max_mp, {}
                    self.end_phase(m)
                    m.next_wander = t + rnd.uniform(3, 8)
            self.step_along(m, d["speed"] * 1.4, dt, monster=True)
            return
        if tgt and (tgt.dead_until or in_safe(tgt.x, tgt.z) or "invis" in tgt.buffs or math.hypot(m.x - m.hx, m.z - m.hz) > d["leash"] or dist(m, tgt) > d["leash"] * 1.5):
            tgt = None
        if not tgt and m.target:
            self.end_phase(m)
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
                if dd < d["aggro"] and not in_safe(p.x, p.z) and "invis" not in p.buffs and (best is None or dd < best[0]):
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
                self.step_along(m, d["speed"] * (0.7 if getattr(m, "chill_until", 0) > t else 1), dt, monster=True)
                if m.path and dist(m, tgt) <= d["range"]:
                    m.path = []
            else:
                m.path, m.moving = [], False
                m.rot = math.atan2(tgt.x - m.x, tgt.z - m.z)
                if d.get("enrage"):
                    rage = m.hp < m.max_hp * d["enrage"]["at"]
                    if rage and not getattr(m, "enraged", False):
                        self.fx(m.x, m.z, {"t": "fx", "k": "slam", "src": m.id, "r": 4, "c1": "#ff2a1a", "c2": "#ff8a3a"})
                        for pp in self.players.values():
                            if dist(m, pp) < 40:
                                pp.send({"t": "sys", "msg": f"{d['name']} flies into a rage!", "kind": "bad"})
                    m.enraged = rage
                ph = d.get("phase2")
                if ph and not m.phase2 and m.hp < m.max_hp * ph["at"]:
                    self.start_phase(m, ph, t)
                sl = ph["slam"] if m.phase2 else d.get("slam")
                if sl and t > getattr(m, "next_slam", 0):
                    m.next_slam = t + sl["every"]
                    self.fx(m.x, m.z, {"t": "fx", "k": "slam", "src": m.id, "r": sl["radius"], "c1": sl.get("c1"), "c2": sl.get("c2"), "name": sl.get("name")})
                    for pp in list(self.players.values()):
                        if not pp.dead_until and "invis" not in pp.buffs and dist(m, pp) <= sl["radius"]:
                            k = COMBAT["armor_k"] + COMBAT["armor_k_per_level"] * d["level"]
                            dmg = max(1, round(rnd.uniform(*d["dmg"]) * sl["mult"] * (d["enrage"]["mult"] if getattr(m, "enraged", False) else 1) * (1 - pp.armor / (pp.armor + k))))
                            self.damage_player(pp, dmg, m, sl.get("dtype", "phys"))
                            if sl.get("poison"):
                                pp.dots.append(dict(dmg=sl["poison"][0], n=sl["poison"][1], next=now() + 1, src=m.id))
                            if sl.get("drain"):
                                m.hp = min(m.max_hp, m.hp + dmg * sl["drain"])
                elif t - m.last_attack >= d["interval"] * (1 / 0.7 if getattr(m, "chill_until", 0) > t else 1) * (d["phase2"]["interval_mult"] if m.phase2 else 1):
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
        els = {k: p.tot.get(k + "_dmg", 0) for k in ("fire", "frost", "lightning")}
        el = max(els, key=els.get) if any(els.values()) else None
        self.fx(m.x, m.z, {"t": "fx", "k": "attack", "src": p.id, "tgt": m.id, "style": kind, **({"el": el} if el else {})})
        self.damage_monster(m, dmg, p, "magic" if magic else "phys", crit)
        self.elemental_hits(p, m, crit)

    def elemental_hits(self, p, m, crit):
        mult = COMBAT["crit_mult"] if crit else 1
        fire, frost, shock = p.tot.get("fire_dmg", 0), p.tot.get("frost_dmg", 0), p.tot.get("lightning_dmg", 0)
        if fire and not m.dead_until:
            self.damage_monster(m, fire * mult * rnd.uniform(0.9, 1.1), p, "fire", crit)
        if frost and not m.dead_until:
            m.chill_until = now() + 3.0
            self.damage_monster(m, frost * mult * rnd.uniform(0.9, 1.1), p, "frost", crit)
        if shock and not m.dead_until:
            self.damage_monster(m, shock * mult * rnd.uniform(0.9, 1.1), p, "lightning", crit)
        if shock:
            near = sorted((o for o in self.monsters.values() if o is not m and not o.dead_until and dist(o, m) < 7), key=lambda o: dist(o, m))[:2]
            for o in near:
                self.fx(m.x, m.z, {"t": "fx", "k": "arc", "src": m.id, "tgt": o.id})
                self.damage_monster(o, shock * 0.5 * mult * rnd.uniform(0.9, 1.1), p, "lightning", False)

    def damage_monster(self, m, raw, p, dtype, crit=False, quiet=False):
        if m.dead_until:
            return
        if p is not None and p.buffs.pop("invis", None):
            p.dirty = True
            p.send({"t": "sys", "msg": "You attacked — Contra Visus fades and you are visible again."})
        if p is not None and p.tot.get("dmg_pct"):
            raw *= 1 + p.tot["dmg_pct"] / 100
        res = m.d["resist"].get("magic" if dtype in ("magic", "poison", "fire", "frost", "lightning") else "phys", 1.0)
        armor = 0 if dtype != "phys" else m.d["armor"]
        dmg = max(1, round(raw * (1 - armor / (armor + COMBAT["armor_k"])) * res))
        m.hp -= dmg
        if p:
            m.dmg_by[p.id] = m.dmg_by.get(p.id, 0) + dmg
            if not m.target and m.state != "return":
                m.target, m.state = p.id, "chase"
        self.fx(m.x, m.z, {"t": "fx", "k": "dmg", "tgt": m.id, "v": dmg, "crit": 1 if crit else 0, "dt": dtype, **({"q": 1} if quiet else {})})
        if p and dtype != "poison" and not p.dead_until:
            ls, ms = p.tot.get("life_steal", 0), p.tot.get("mana_steal", 0)
            if ls:
                p.hp = min(p.max_hp, p.hp + dmg * ls / 100)
            if ms and m.mp > 0:
                take = min(m.mp, m.max_mp * ms / 100)
                m.mp -= take
                p.mp = min(p.max_mp, p.mp + take)
        if m.hp <= 0:
            self.kill_monster(m)

    def start_phase(self, m, ph, t):
        m.phase2 = True
        m.hp = min(m.max_hp, m.hp + m.max_hp * ph["heal"])
        m.next_slam = t + 2
        self.fx(m.x, m.z, {"t": "fx", "k": "slam", "src": m.id, "r": 9, "c1": "#a040ff", "c2": "#ffd36b"})
        for i in range(ph["n"]):
            self.champ_n += 1
            a = i * 6.283 / ph["n"]
            g = Monster(f"add{self.champ_n}", ph["summon"], dict(monster=ph["summon"], x=m.x + math.cos(a) * 4, z=m.z + math.sin(a) * 4, r=1, n=1, add_of=m.id), self.world)
            g.target, g.state, g.rise_until = m.target, "chase", t + 1.3
            self.spawn_q.append(g)
        for pp in self.players.values():
            if dist(m, pp) < 60:
                pp.send({"t": "sys", "msg": f"{m.d['name']} roars: \"Guards! To your king!\" — the Usurper's Wrath awakens!", "kind": "bad"})

    def end_phase(self, m):
        if not m.phase2:
            return
        m.phase2 = False
        for k in [k for k, o in self.monsters.items() if o.spawn.get("add_of") == m.id]:
            del self.monsters[k]

    def in_castle(self, x, z):
        c = self.world.castle
        return c["x0"] - 2 <= x <= c["x0"] + c["w"] + 2 and c["z0"] - 2 <= z <= c["z0"] + c["d"] + 2

    def run_key(self, p):
        return getattr(p, "party", None) or p.id

    def tick_castle_runs(self, t):
        for p in self.players.values():
            if p.dead_until or not self.in_castle(p.x, p.z):
                continue
            k = self.run_key(p)
            r = self.castle_runs.get(k)
            if not r:
                r = self.castle_runs[k] = dict(start=t, members={}, rooms=set(), boss=False)
                for o in self.party_members(p):
                    o.send({"t": "sys", "msg": "[Castle Run] The clock is ticking — clear all 16 halls and slay Lord Vexmoor!", "kind": "quest"})
            r["members"][p.id] = (p.name, p.cls)
            r["last_in"] = t
        for k in [k for k, r in self.castle_runs.items() if t - r["last_in"] > 120]:
            for pid in self.castle_runs.pop(k)["members"]:
                if pid in self.players:
                    self.players[pid].send({"t": "sys", "msg": "[Castle Run] Cancelled — you were outside the castle too long.", "kind": "bad"})

    def run_progress(self, pids, room=None, boss=False):
        for k in {self.run_key(self.players[i]) for i in pids if i in self.players}:
            r = self.castle_runs.get(k)
            if not r:
                continue
            if room is not None and room not in r["rooms"]:
                r["rooms"].add(room)
                for pid in r["members"]:
                    if pid in self.players:
                        self.players[pid].send({"t": "sys", "msg": f"[Castle Run] Hall cleared ({len(r['rooms'])}/16) — {fmt_secs(now() - r['start'])}", "kind": "quest"})
            r["boss"] = r["boss"] or boss
            if len(r["rooms"]) >= 16 and r["boss"]:
                secs = round(now() - r["start"], 1)
                del self.castle_runs[k]
                names = [v[0] for v in r["members"].values()]
                asyncio.ensure_future(self.db.castle_runs.insert_one({"members": [dict(id=i, name=v[0], cls=v[1]) for i, v in r["members"].items()], "secs": secs, "ts": datetime.now(timezone.utc)}))
                self.announce(f"{' and '.join(names) if len(names) < 3 else ', '.join(names[:-1]) + ' and ' + names[-1]} conquered Castle Vexmoor in {fmt_secs(secs)}!", title="Castle Conquered")

    def grant_spells(self, p):
        new = [k for k, ab in ABILITIES.items() if p.cls in ab["cls"] and ab["level"] <= p.level and k not in p.abilities]
        if new:
            p.abilities += new
            p.dirty = True
            p.send({"t": "sys", "msg": "New spell" + ("s" if len(new) > 1 else "") + " learned: " + ", ".join(ABILITIES[k]["name"] for k in new) + "!", "kind": "quest"})
        p.skill_points = 0

    def room_clear(self, m, t):
        room = m.spawn.get("room")
        hits = self.room_hits.setdefault(room, {})
        for pid in m.dmg_by:
            hits[pid] = t
        if any(o.spawn.get("room") == room and not o.dead_until for o in self.monsters.values()):
            return
        winners = [self.players[pid] for pid, ht in hits.items() if t - ht < 240 and pid in self.players]
        self.run_progress([w.id for w in winners], room=room)
        if t < self.room_cd.get(room, 0):
            return
        self.room_cd[room] = t + 120
        self.room_hits[room] = {}
        rx, rz = m.spawn["x"], m.spawn["z"]
        for i, p in enumerate(winners):
            a = i * 1.3
            lid = "l" + uid()
            self.loot[lid] = dict(id=lid, item="vexmoor_coffer", qty=1, props=None, pname=None, x=round(rx + math.cos(a) * 1.5, 2), z=round(rz + math.sin(a) * 1.5, 2),
                                  owner=p.id, party=None, owner_until=t + 120, expires=t + 120)
            p.send({"t": "sys", "msg": "Room cleared! A Vexmoor Coffer has appeared for you — claim it within 2 minutes.", "kind": "quest"})
            self.fx(rx, rz, {"t": "fx", "k": "levelup", "src": p.id, "lv": p.level})

    def open_coffer(self, p, lvl):
        t = now()
        drops = [("gold", rnd.randint(lvl * 40, lvl * 70)), ("hp_potion", 3), ("mp_potion", 2)]
        g = rnd.choice(list(VEXMOOR_SET)) if rnd.random() < 0.25 else rare_gear(lvl, rnd)
        if g:
            drops.append((g, 1 if g in VEXMOOR_SET else -1))
        for i, (item, qty) in enumerate(drops):
            a = i * 2.1 + rnd.uniform(0, 1)
            lx, lz = p.x + math.cos(a) * 1.3, p.z + math.sin(a) * 1.3
            if not self.world.walkable(lx, lz):
                lx, lz = p.x, p.z
            props, pname = (None, None) if item == "gold" or item in VEXMOOR_SET else roll_props(item, lvl, rnd, force=qty == -1)
            lid = "l" + uid()
            self.loot[lid] = dict(id=lid, item=item, qty=max(1, qty), props=props, pname=pname, x=round(lx, 2), z=round(lz, 2), owner=p.id,
                                  party=None, owner_until=t + LOOT_OWNER_SECS, expires=t + LOOT_EXPIRE_SECS)
        p.send({"t": "sys", "msg": "You break the Vexmoor seal. Treasure spills out!", "kind": "quest"})

    def kill_monster(self, m):
        t = now()
        m.hp, m.dead_until, m.died_at, m.path, m.target, m.dots = 0, t + m.d["respawn"], t, [], None, []
        self.end_phase(m)
        if m.type == "vexmoor":
            self.run_progress(list(m.dmg_by), boss=True)
        if m.spawn.get("room") is not None:
            self.room_clear(m, t)
        killer = self.players.get(max(m.dmg_by, key=m.dmg_by.get)) if m.dmg_by else None
        self.fx(m.x, m.z, {"t": "fx", "k": "death", "tgt": m.id})
        if m.type.startswith("pit_") and not m.d.get("champion"):
            self.pit_kill(m)
        if not killer:
            return
        kill_key = f"{m.id}:{m.died_at}"
        if kill_key in killer.rewarded:
            return
        killer.rewarded.add(kill_key)
        if len(killer.rewarded) > 200:
            killer.rewarded = set(list(killer.rewarded)[-100:])
        sharers = [o for o in self.party_members(killer) if o is killer or (not o.dead_until and math.hypot(o.x - m.x, o.z - m.z) < PARTY_SHARE_R)]
        n = len(sharers)
        for o in sharers:
            ld = o.level - m.d["level"]
            base = m.d["xp"] if ld <= 4 else max(1, round(m.d["xp"] * max(0.1, 1 - (ld - 4) * 0.15)))
            self.give_xp(o, max(1, round(base * (1 + PARTY_XP_BONUS * (n - 1)) / n)))
        drops = [("gold", rnd.randint(*m.d["gold"]))]
        rolls = 1 + max([n for lv, n in EXTRA_ROLLS if m.d["level"] >= lv] or [0])
        for _ in range(rolls):
            for item, chance in m.d["loot"]:
                if rnd.random() < chance:
                    drops.append((item, 1))
        for lv, item, chance in BONUS_LOOT:
            if m.d["level"] >= lv and rnd.random() < chance:
                drops.append((item, 1))
        if m.d.get("castle") and rnd.random() < 0.04:
            drops.append((rnd.choice(list(VEXMOOR_SET)), 1))
        if m.d.get("isle") and rnd.random() < 0.35:
            g = random_gear(m.d["level"], rnd)
            if g:
                drops.append((g, -1))
        if rnd.random() < RANDOM_GEAR_CHANCE * (2 if m.d.get("boss") else 1):
            g = random_gear(m.d["level"], rnd)
            if g:
                drops.append((g, -1))
        if m.d.get("bounty"):
            drops += [(g, -1) for g in (rare_gear(m.d["level"], rnd) for _ in range(2)) if g]
        if m.d.get("champion"):
            drops += [(g, -1) for g in (random_gear(m.d["level"], rnd) for _ in range(3)) if g]
            drops.append(("gold", rnd.randint(*m.d["gold"]) * 5))
        drops = drops[:16 if m.d.get("boss") or m.d.get("champion") else 8]
        if m.d.get("champion"):
            self.broadcast_sys(f"{killer.name} has slain the Wave Champion {m.d['name']}!")
        if m.d.get("boss"):
            names = [killer.name] + [o.name for o in sharers if o is not killer]
            who = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
            self.announce(f"{who} {'has' if len(names) == 1 else 'have'} slain {m.d['name']}!", "World Boss Slain", chat=False)
            self.broadcast_sys(f"{who} {'has' if len(names) == 1 else 'have'} slain {m.d['name']}! " + ("Its lair lies quiet... for now." if m.d.get("bounty") else "The Titus Barrows fall silent... for now." if m.d.get("barrow") else "The tides of the Offshore Isles grow calm... for now." if m.d.get("isle") else "The Hollow Deep falls silent... for now."))
        for i, (item, qty) in enumerate(drops):
            a = i * 2.1 + rnd.uniform(0, 1)
            lx, lz = m.x + math.cos(a) * (0.6 + 0.4 * i), m.z + math.sin(a) * (0.6 + 0.4 * i)
            if not self.world.walkable(lx, lz):
                lx, lz = m.x, m.z
            lid = "l" + uid()
            props, pname = (None, None) if item == "gold" else roll_props(item, m.d["level"], rnd, force=qty == -1)
            qty = max(1, qty)
            self.loot[lid] = dict(id=lid, item=item, qty=qty, props=props, pname=pname, x=round(lx, 2), z=round(lz, 2), owner=killer.id,
                                  party=getattr(killer, "party", None), owner_until=t + LOOT_OWNER_SECS, expires=t + (8 if m.type.startswith("pit_") else LOOT_EXPIRE_SECS))
        if m.type in BOUNTIES:
            for o in sharers:
                b = o.bounties.get(m.type)
                if b and b.get("s") == "active":
                    b["s"] = "done"
                    o.send({"t": "sys", "msg": f"[Bounty] {m.d['name']} slain! Claim your reward at any town Bounty Board.", "kind": "quest"})
                    o.dirty = True
        for o in sharers:
            for qid, q in o.quests.items():
                qd = QUESTS[qid]
                if q["s"] == "active" and qd["kind"] == "crypt" and m.type == qd["target"] and not q.get("opened") and not self.count_item(o, qd["item"]):
                    if self.add_item(o, qd["item"], 1):
                        o.send({"t": "sys", "msg": f"[{qd['name']}] The {ITEMS[qd['item']]['name']} falls from the Sexton's bones. Use it on a mausoleum door.", "kind": "quest"})
                        o.dirty = True
                if q["s"] == "active" and qd.get("drop") and m.type == qd["target"] and self.count_item(o, qd["collect"]) < qd["collect_count"] and self.add_item(o, qd["collect"], 1):
                    o.send({"t": "sys", "msg": f"[{qd['name']}] You claim the {ITEMS[qd['collect']]['name']}.", "kind": "quest"})
                if q["s"] == "active" and qd["kind"] in ("kill", "kill_collect") and qd["target"] in (m.d.get("base", m.type), m.type) and q["k"] < qd["count"]:
                    q["k"] += 1
                    o.send({"t": "sys", "msg": f"[{qd['name']}] {MONSTERS[m.type]['name']} slain: {q['k']}/{qd['count']}", "kind": "quest"})
                    o.dirty = True

    def give_xp(self, p, xp):
        if p.level >= MAX_LEVEL:
            return
        p.xp += xp
        p.send({"t": "sys", "msg": f"+{xp} experience", "kind": "xp"})
        levels = 0
        while p.level < MAX_LEVEL and p.xp >= XP_TABLE[p.level + 1]:
            p.level += 1
            p.attr_points += ATTR_POINTS_PER_LEVEL
            levels += 1
        if levels:
            p.recalc()
            r = COMBAT["levelup_restore"]
            p.hp = min(p.max_hp, p.hp + p.max_hp * r)
            p.mp = min(p.max_mp, p.mp + p.max_mp * r)
            self.fx(p.x, p.z, {"t": "fx", "k": "levelup", "src": p.id, "lv": p.level})
            p.send({"t": "levelup", "lv": p.level, "n": levels})
            self.grant_spells(p)
            self.broadcast_sys(f"{p.name} has reached level {p.level}!")
            asyncio.create_task(self.save(p))
        p.dirty = True

    def monster_attack(self, m, p):
        d = m.d
        style = "spell" if d.get("ranged") else "melee"
        if rnd.random() > self.hit_chance(d["level"], p.level, p.tot["dex"]):
            self.fx(m.x, m.z, {"t": "fx", "k": "mattack", "src": m.id, "tgt": p.id, "style": style, "miss": 1})
            return
        raw = rnd.uniform(*d["dmg"]) * (d["enrage"]["mult"] if getattr(m, "enraged", False) else 1)
        self.fx(m.x, m.z, {"t": "fx", "k": "mattack", "src": m.id, "tgt": p.id, "style": style})
        k = COMBAT["armor_k"] + COMBAT["armor_k_per_level"] * d["level"]
        dmg = max(1, round(raw * (1 - p.armor / (p.armor + k))))
        self.damage_player(p, dmg, m, "phys")
        if d.get("poison"):
            p.dots.append(dict(dmg=d["poison"][0], n=d["poison"][1], next=now() + 1, src=m.id))

    def damage_player(self, p, dmg, m, dtype):
        if p.dead_until or in_safe(p.x, p.z):
            return
        if p.tot.get("dr_pct"):
            dmg = max(1, round(dmg * (1 - p.tot["dr_pct"] / 100)))
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

    def cast(self, p, ab_id, target_id, pt=None, mark=None):
        ab = ABILITIES.get(ab_id)
        if not ab or p.dead_until:
            return "Unknown ability."
        if ab_id not in p.abilities:
            return f"{ab['name']} is locked."
        if p.cls not in ab["cls"]:
            return "Your class cannot use that."
        if p.level < ab["level"]:
            return f"Requires level {ab['level']}."
        if p.mp < ab["cost"]:
            return "Not enough mana."
        if now() < p.next_cast or p.dash:
            return None
        k = ab["kind"]
        if k == "portal":
            dest = p.marks.get(str(mark))
            if not dest:
                return f"Mark {mark} is not set. Type mark{mark if mark is not None else 1} in chat to set it."
            if not pt or math.hypot(pt[0] - p.x, pt[1] - p.z) > ab["range"] + 0.5 or not self.world.walkable(*pt):
                return f"Place the portal on open ground within {int(ab['range'])}m."
            return self.do_cast(p, ab_id, None, pt, dest)
        if k == "blink":
            if not pt:
                return "Point at where you want to teleport."
            dx, dz = pt[0] - p.x, pt[1] - p.z
            d = math.hypot(dx, dz) or 1
            for f in (1.0, 0.85, 0.7, 0.55, 0.4, 0.25):
                r = min(d, ab["range"]) * f
                cx, cz = p.x + dx / d * r, p.z + dz / d * r
                if self.world.walkable(cx, cz):
                    return self.do_cast(p, ab_id, None, (cx, cz))
            return "You cannot teleport there."
        if k in ("aoe_target", "cone"):
            m = self.monsters.get(target_id)
            if m and not m.dead_until and dist(p, m) <= ab["range"] + m.d["radius"]:
                return self.do_cast(p, ab_id, m)
            if in_safe(p.x, p.z):
                return "You cannot fight from within a safe square."
            cx, cz = pt if pt else (p.x + math.sin(p.rot), p.z + math.cos(p.rot))
            if k == "aoe_target":
                dx, dz = cx - p.x, cz - p.z
                d = math.hypot(dx, dz)
                kk = min(1.0, ab["range"] / d) if d > 0 else 0
                cx, cz = p.x + dx * kk, p.z + dz * kk
            return self.do_cast(p, ab_id, None, (cx, cz))
        if k in ("melee", "spell", "ranged", "dot", "dash"):
            m = self.monsters.get(target_id) or (self.aim_at(p, ab, pt) if pt and k != "melee" else None)
            if not m and pt and k in ("spell", "ranged", "dot"):
                return self.cast_miss(p, ab_id, pt)
            if not m and pt and k == "dash":
                return self.dash_to(p, ab_id, pt)
            m = m or self.monsters.get(p.target)
            if not m or m.dead_until:
                return "You need a target."
            if dist(p, m) > ab["range"] + m.d["radius"]:
                if k == "dash":
                    return self.dash_to(p, ab_id, pt or (m.x, m.z))
                if k != "melee":
                    return self.cast_miss(p, ab_id, pt or (m.x, m.z))
                p.target, p.queued, p.pending = m.id, ab_id, None
                return None
            if k == "dash" and not self.world.los(p.x, p.z, m.x, m.z):
                return "No clear path to charge."
            return self.do_cast(p, ab_id, m)
        if k in ("aoe_self", "multi") and in_safe(p.x, p.z):
            return "You cannot fight from within a safe square."
        return self.do_cast(p, ab_id, None)

    def dash_to(self, p, ab_id, pt):
        ab = ABILITIES[ab_id]
        dx, dz = pt[0] - p.x, pt[1] - p.z
        d = math.hypot(dx, dz)
        if d < 0.6:
            return None
        ux, uz = dx / d, dz / d
        nx, nz = p.x, p.z
        for i in range(1, int(min(d, ab["range"]) / 0.4) + 1):
            x, z = p.x + ux * 0.4 * i, p.z + uz * 0.4 * i
            if not self.world.walkable(x, z):
                break
            nx, nz = x, z
        if (nx, nz) == (p.x, p.z):
            return "No clear path to run."
        fx0 = [round(p.x, 2), round(p.z, 2)]
        p.mp -= ab["cost"]
        p.next_cast = now() + GLOBAL_CD
        p.dash, p.rot, p.path, p.dirty = (nx, nz), math.atan2(ux, uz), [], True
        self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": ab_id, "tgt": None, "fx0": fx0, "x": round(nx, 2), "z": round(nz, 2)})
        return None

    def cast_gcd(self, p, ab):
        return GLOBAL_CD - (min(p.level, 50) - 1) * 0.1 / 49 if ab.get("fast_cast") else GLOBAL_CD

    def cast_miss(self, p, ab_id, pt):
        ab = ABILITIES[ab_id]
        p.next_cast = now() + self.cast_gcd(p, ab)
        if in_safe(p.x, p.z):
            return "You cannot fight from within a safe square."
        dx, dz = pt[0] - p.x, pt[1] - p.z
        d = math.hypot(dx, dz) or 1
        r = min(d, ab["range"])
        p.mp -= ab["cost"]
        p.rot = math.atan2(dx, dz)
        p.last_attack, p.dirty = now(), True
        self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": ab_id, "tgt": None, "x": round(p.x + dx / d * r, 2), "z": round(p.z + dz / d * r, 2)})

    def aim_at(self, p, ab, pt):
        live = [mm for mm in self.monsters.values() if not mm.dead_until and dist(p, mm) <= ab["range"] + mm.d["radius"] + 4]
        near = min(live, key=lambda mm: math.hypot(mm.x - pt[0], mm.z - pt[1]), default=None)
        if near and math.hypot(near.x - pt[0], near.z - pt[1]) <= 3.0 + near.d["radius"]:
            return near
        dx, dz = pt[0] - p.x, pt[1] - p.z
        d = math.hypot(dx, dz) or 1
        dx, dz = dx / d, dz / d
        best = None
        for mm in live:
            along = (mm.x - p.x) * dx + (mm.z - p.z) * dz
            side = abs((mm.x - p.x) * dz - (mm.z - p.z) * dx)
            if 0 < along <= ab["range"] + mm.d["radius"] and side <= mm.d["radius"] + 1.2 and (not best or along < best[0]):
                best = (along, mm)
        return best[1] if best else None

    def spell_dmg(self, p, ab):
        return ab["base"] + p.tot["int"] * ab["scale"] + rnd.uniform(0, 4)

    def weapon_dmg(self, p, ab):
        return rnd.uniform(p.dmg_lo, p.dmg_hi) * ab["mult"] + ab["flat"]

    def teleport(self, p, x, z, msg=None):
        p.x, p.z = x, z
        p.path, p.target, p.pending, p.queued, p.dirty = [], None, None, None, True
        for mm in self.monsters.values():
            if mm.target == p.id:
                mm.target = None
        if msg:
            p.send({"t": "sys", "msg": msg})

    def tick_sched(self, t):
        due = [h for h in self.sched if t >= h["t"]]
        if not due:
            return
        self.sched = [h for h in self.sched if t < h["t"]]
        for h in due:
            p, m = self.players.get(h["pid"]), self.monsters.get(h["mid"])
            if p and m and not m.dead_until and not p.dead_until:
                self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": h["ab"], "tgt": m.id})
                self.damage_monster(m, h["dmg"], p, h["dtype"], h["crit"])

    def do_cast(self, p, ab_id, m, center=None, dest=None):
        ab = ABILITIES[ab_id]
        t = now()
        p.next_cast = t + self.cast_gcd(p, ab)
        if p.mp < ab["cost"]:
            return "Not enough mana."
        if m and in_safe(p.x, p.z):
            return "You cannot fight from within a safe square."
        k = ab["kind"]
        if k == "dash":
            d = dist(p, m) or 1
            back = 1.2 + m.d["radius"]
            nx, nz = m.x - (m.x - p.x) / d * back, m.z - (m.z - p.z) / d * back
            if d > back and self.world.walkable(nx, nz):
                p.dash = (nx, nz)
            p.path = []
        p.mp -= ab["cost"]
        cfx = {"t": "fx", "k": "cast", "src": p.id, "ab": ab_id, "tgt": m.id if m else None}
        if center:
            cfx["x"], cfx["z"] = round(center[0], 2), round(center[1], 2)
        if k == "blink":
            cfx["fx0"] = [round(p.x, 2), round(p.z, 2)]
        self.fx(p.x, p.z, cfx)
        if m:
            p.rot = math.atan2(m.x - p.x, m.z - p.z)
        if k in ("melee", "ranged", "dash"):
            p.last_attack = t
            delay = math.hypot(p.dash[0] - p.x, p.dash[1] - p.z) / DASH_SPEED if k == "dash" and p.dash else 0
            for i in range(ab.get("hits", 1)):
                crit = rnd.random() < p.crit
                dmg = self.weapon_dmg(p, ab) * (COMBAT["crit_mult"] if crit else 1)
                if i == 0 and not delay:
                    self.damage_monster(m, dmg, p, "phys", crit)
                else:
                    self.sched.append(dict(t=t + delay + i * ab.get("gap", 0), pid=p.id, mid=m.id, dmg=dmg, crit=crit, dtype="phys", ab=ab_id))
        elif k == "spell":
            crit = rnd.random() < p.crit
            dmg = self.spell_dmg(p, ab) * (COMBAT["crit_mult"] if crit else 1)
            if ab.get("splash"):
                for mm in list(self.monsters.values()):
                    if mm is not m and not mm.dead_until and dist(mm, m) <= ab["splash"] + mm.d["radius"]:
                        self.damage_monster(mm, dmg * 0.5, p, "magic")
            self.damage_monster(m, dmg, p, ab.get("dtype", "magic"), crit, quiet=ab.get("fast_cast", False))
            hit, cur = {m.id}, m
            for i in range(ab.get("chain", 0)):
                nxt = min((mm for mm in self.monsters.values() if mm.id not in hit and not mm.dead_until and not in_safe(mm.x, mm.z) and dist(mm, cur) <= 8),
                          key=lambda mm: dist(mm, cur), default=None)
                if not nxt:
                    break
                self.fx(cur.x, cur.z, {"t": "fx", "k": "arc", "src": cur.id, "tgt": nxt.id})
                self.damage_monster(nxt, dmg * 0.8 ** (i + 1), p, ab["dtype"])
                hit.add(nxt.id); cur = nxt
        elif k in ("aoe_target", "aoe_self", "cone"):
            cx, cz = (m.x, m.z) if m else (center or (p.x, p.z))
            if k == "cone":
                ang, cx, cz = math.atan2(cx - p.x, cz - p.z), p.x, p.z
                p.rot = ang
            for mm in list(self.monsters.values()):
                if mm.dead_until or in_safe(mm.x, mm.z):
                    continue
                if k == "cone":
                    dd = dist(p, mm)
                    da = abs((math.atan2(mm.x - p.x, mm.z - p.z) - ang + math.pi) % (2 * math.pi) - math.pi)
                    if dd > ab["range"] + mm.d["radius"] or (da > ab["angle"] and dd > mm.d["radius"] + 1):
                        continue
                elif math.hypot(mm.x - cx, mm.z - cz) > ab["radius"] + mm.d["radius"]:
                    continue
                if "base" in ab:
                    if ab.get("rot"):
                        self.fx(mm.x, mm.z, {"t": "fx", "k": "rot", "tgt": mm.id})
                    if ab.get("chill"):
                        mm.chill_until = t + 3.0
                    self.damage_monster(mm, self.spell_dmg(p, ab), p, ab.get("dtype", "magic"))
                    if ab.get("rot") and not mm.dead_until:
                        mm.dots.append(dict(dmg=4 + p.tot["int"] * ab["rot"], n=5, next=t + 1, src=p.id))
                else:
                    self.damage_monster(mm, self.weapon_dmg(p, ab), p, "phys")
        elif k == "multi":
            near = sorted((mm for mm in self.monsters.values() if not mm.dead_until and dist(p, mm) <= ab["range"] + mm.d["radius"] and not in_safe(mm.x, mm.z)), key=lambda mm: dist(p, mm))[:ab["count"]]
            p.last_attack = t
            for mm in near:
                self.fx(p.x, p.z, {"t": "fx", "k": "cast", "src": p.id, "ab": ab_id, "tgt": mm.id})
                if "base" in ab:
                    self.damage_monster(mm, self.spell_dmg(p, ab), p, "magic")
                else:
                    self.damage_monster(mm, self.weapon_dmg(p, ab), p, "phys")
        elif k == "dot":
            per = ab["base"] + p.tot[ab.get("stat", "dex")] * ab["scale"]
            m.dots.append(dict(dmg=per, n=ab["ticks"], next=t + 1, src=p.id))
            self.damage_monster(m, per, p, "poison")
        elif k == "heal":
            amt = round(ab["base"] + p.tot["wis"] * ab["scale"])
            p.hp = min(p.max_hp, p.hp + amt)
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": amt})
        elif k == "cure":
            n = len(p.dots)
            p.dots = []
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": 0})
            p.send({"t": "sys", "msg": "The poison leaves your body." if n else "You are not poisoned."})
        elif k == "buff":
            p.buffs[ab["buff"]] = (round(ab["value"] + ab.get("per_level", 0) * p.level, 2), t + ab["dur"])
            p.recalc()
        elif k == "blink":
            if math.hypot(center[0] - p.x, center[1] - p.z) > 0.1:
                p.rot = math.atan2(center[0] - p.x, center[1] - p.z)
            p.x, p.z, p.path, p.dirty = center[0], center[1], [], True
        elif k == "portal":
            for gid in [g["id"] for g in self.gates.values() if g["owner"] == p.id]:
                del self.gates[gid]
            gid = "g" + uid()
            self.gates[gid] = dict(id=gid, x=round(center[0], 2), z=round(center[1], 2), to=list(dest), owner=p.id, name=p.name,
                                   ready=t + 1.0, expires=t + PORTAL_SECS)
            p.send({"t": "sys", "msg": f"A portal tears open. It will close in {PORTAL_SECS} seconds.", "kind": "quest"})
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

    def add_item(self, p, item, qty, props=None, pname=None):
        if props:
            if len(p.inventory) >= INV_SLOTS:
                return False
            p.inventory.append(dict(uid=uid(), item=item, qty=1, props=props, pname=pname))
            p.dirty = True
            return True
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
        if l["owner"] and l["owner"] != p.id and now() < l["owner_until"] and not (l.get("party") and l["party"] == getattr(p, "party", None)):
            return p.send({"t": "err", "msg": "That loot belongs to another adventurer for now."})
        if not self.add_item(p, l["item"], l["qty"], l.get("props"), l.get("pname")):
            return p.send({"t": "err", "msg": "Your inventory is full."})
        del self.loot[lid]
        p.send({"t": "pickup", "item": l["item"], "qty": l["qty"], "name": l.get("pname")})

    @staticmethod
    def loot_wanted(l, f):
        if not isinstance(f, dict):
            return True
        it = ITEMS[l["item"]]
        name = (l.get("pname") or it["name"]).lower()
        names = [n.strip().lower() for n in (f.get("names") or []) if isinstance(n, str) and n.strip()][:30]
        if any(n in name for n in names):
            return True
        if f.get("names_only"):
            return False
        kind = it["type"]
        if kind == "gold":
            return f.get("gold", True)
        if kind == "consumable":
            return f.get("consumables", True)
        if kind in ("material", "quest"):
            return f.get("materials", True) or kind == "quest"
        if f.get("props_only") and not l.get("props"):
            return False
        return it["rarity"] in (f.get("rarities") or ["common", "uncommon", "rare", "epic", "legendary"])

    def loot_all(self, p, flt=None, radius=None, quiet=False):
        t, got, full, owned, skipped = now(), {}, False, 0, 0
        for lid, l in sorted(self.loot.items(), key=lambda kv: math.hypot(kv[1]["x"] - p.x, kv[1]["z"] - p.z)):
            if math.hypot(l["x"] - p.x, l["z"] - p.z) > (radius or LOOT_ALL_R):
                continue
            if not self.loot_wanted(l, flt):
                skipped += 1
                continue
            if l["owner"] and l["owner"] != p.id and t < l["owner_until"] and not (l.get("party") and l["party"] == getattr(p, "party", None)):
                owned += 1
                continue
            if not self.add_item(p, l["item"], l["qty"], l.get("props"), l.get("pname")):
                full = True
                continue
            del self.loot[lid]
            name = "gold" if l["item"] == "gold" else (l.get("pname") or ITEMS[l["item"]]["name"])
            got[name] = got.get(name, 0) + l["qty"]
        if got:
            p.send({"t": "pickup", "item": "gold" if list(got) == ["gold"] else "loot_all", "qty": 1,
                    "name": ", ".join(f"{q}× {n}" if q > 1 else n for n, q in got.items())})
        if quiet:
            if full and t > getattr(p, "full_warn", 0):
                p.full_warn = t + 10
                p.send({"t": "err", "msg": "Your inventory is full. Auto-loot left items on the ground."})
            return
        if full:
            p.send({"t": "err", "msg": "Your inventory is full. Some items were left on the ground."})
        elif not got:
            p.send({"t": "err", "msg": "Some loot nearby belongs to another adventurer." if owned else
                    f"Your loot filter skipped {skipped} item{'s' if skipped != 1 else ''} nearby." if skipped else "There is no loot nearby."})

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
        if qd["kind"] == "crypt":
            return bool(q.get("opened"))
        return False

    def npc_dialog(self, p, npc_id):
        n = self.near_npc(p, npc_id)
        if not n:
            return p.send({"t": "err", "msg": "You are too far away."})
        if n.get("board"):
            return self.bounty_view(p, npc_id)
        opts, text = [], {"smith": "Steel for the road, traveler?", "merchant": "Supplies for the journey? I've a fair price.",
                          "healer": "Rest a moment. The light will mend you.", "druid": "The grove's breath will restore you.",
                          "elder": "Titus has endured, but the woods grow restless.", "guard": "Keep your blade sharp out there.",
                          "villager": "Fine day, isn't it? Mind the spiders past the north gate.", "child": "Are you a real adventurer?!"}.get(n["kind"], "Greetings.")
        if n.get("storage"):
            text = "A heavy iron-bound trunk. Everything inside is shared by all characters on your account."
            opts.append(dict(id="storage", label="Open storage"))
        if n.get("waystone"):
            text = f"The runes flare at your touch. Your home is {TOWN_NAMES.get(p.home, 'not set — you return to the nearest town')}. Where would you go?"
            if p.home != n["town"]:
                opts.append(dict(id="sethome", label=f"Make {TOWN_NAMES[n['town']]} my home town"))
            for z in SAFE_ZONES:
                if z["town"] != n["town"] and z.get("waystone", True):
                    opts.append(dict(id=f"travel:{z['town']}", label=f"Travel to {TOWN_NAMES[z['town']]} ({self.travel_cost(n, z)} gold)"))
        if n.get("ferry") == "isles":
            text = f"Passage to the Offshore Isles costs {FERRY_COST} gold. Rare beasts and old treasure out there — and the trip home is free."
            opts.append(dict(id="ferry", label=f"Sail to the Offshore Isles ({FERRY_COST} gold)"))
        elif n.get("ferry") == "harbor":
            text = "Had your fill of the isles? Hop aboard — the ride back to Saltmere is on the house."
            opts.append(dict(id="ferry", label="Sail back to Saltmere Harbor (free)"))
        if n.get("crypt"):
            q = p.quests.get("q_sexton")
            if q and q.get("opened"):
                text = "The crypt door hangs open. Only dust and old bones remain inside."
            elif q and q["s"] == "active" and self.count_item(p, "sexton_key"):
                text = "A heavy door sealed with a rusted lock. The Sexton's key feels cold in your hand."
                opts.append(dict(id="crypt", label="Unlock the Sealed Crypt"))
            else:
                text = "A heavy door sealed with a rusted lock shaped like a grinning skull. It will not budge."
        if n.get("chest"):
            left = getattr(p, "chest_cd", {}).get(npc_id, 0) - now()
            text = f"The chest lies empty. It will refill in about {int(left // 60) + 1} min." if left > 0 else "Salt-crusted iron bands hold the lid shut. Something glints inside."
            if left <= 0:
                opts.append(dict(id="chest", label="Pry open the chest"))
        if n.get("merchant"):
            opts.append(dict(id="trade", label="Trade"))
        if n.get("healer"):
            opts.append(dict(id="heal", label="Heal me"))
        for qid in n.get("quests", []):
            q = p.quests.get(qid)
            req = QUESTS[qid].get("requires")
            if not q and (not req or p.quests.get(req, {}).get("s") == "done"):
                opts.append(dict(id=f"accept:{qid}", label=f"Quest: {QUESTS[qid]['name']}", text=QUESTS[qid]["text"]))
        for qid, qd in QUESTS.items():
            if qd["turnin"] == npc_id and self.quest_ready(p, qid):
                opts.append(dict(id=f"complete:{qid}", label=f"Complete: {qd['name']}"))
            elif qd["turnin"] == npc_id and p.quests.get(qid, {}).get("s") == "active":
                text = f"How goes '{qd['name']}'? Return when the task is done."
        if npc_id == "lyra" and p.quests.get("q_letter", {}).get("s") == "done":
            text = "Thank you for the letter. Elderglen stands with Titus."
        p.send({"t": "dialog", "npc": npc_id, "text": text, "opts": opts})

    async def storage_cmd(self, p, msg):
        n = self.near_npc(p, msg.get("npc"))
        if not n or not n.get("storage"):
            return "You must stand by a storage trunk."
        async with self.storage_lock:
            acc = p.account_id
            if acc not in self.storages:
                doc = await self.db.storage.find_one({"account_id": acc}, {"_id": 0}) or {}
                self.storages[acc] = {"items": doc.get("items", []), "gold": int(doc.get("gold", 0))}
            vault, t = self.storages[acc], msg["t"]
            st = vault["items"]
            if t == "storage_gold":
                try:
                    amt = int(msg.get("amount") or 0)
                except (TypeError, ValueError):
                    return "Invalid amount."
                if amt == 0:
                    return "Enter an amount."
                if amt > 0 and amt > p.gold:
                    return "You don't have that much gold."
                if amt < 0 and -amt > vault["gold"]:
                    return "The vault doesn't hold that much gold."
                p.gold -= amt
                vault["gold"] += amt
                p.dirty = True
                await self.db.storage.update_one({"account_id": acc}, {"$set": {"gold": vault["gold"]}}, upsert=True)
                await self.save(p)
            if t == "storage_sort":
                tord = {"weapon": 0, "armor": 1, "consumable": 2, "material": 3, "quest": 4}
                rord = {"legendary": 0, "epic": 1, "rare": 2, "uncommon": 3, "common": 4}
                st.sort(key=lambda x: (tord.get(ITEMS[x["item"]]["type"], 9), ITEMS[x["item"]].get("slot") or "", rord.get(ITEMS[x["item"]]["rarity"], 9), x.get("pname") or ITEMS[x["item"]]["name"]))
                await self.db.storage.update_one({"account_id": acc}, {"$set": {"items": st}}, upsert=True)
            if t in ("storage_put", "storage_take"):
                src, dst, cap = (p.inventory, st, STORAGE_SLOTS) if t == "storage_put" else (st, p.inventory, INV_SLOTS)
                s = next((x for x in src if x["uid"] == msg.get("uid")), None)
                if not s:
                    return "Item not found."
                qty = max(1, min(int(msg.get("qty") or s["qty"]), s["qty"]))
                it = ITEMS[s["item"]]
                tgt = None if s.get("props") or it["stack"] <= 1 else next((x for x in dst if x["item"] == s["item"] and not x.get("props") and x["qty"] + qty <= it["stack"]), None)
                if not tgt and len(dst) >= cap:
                    return "Storage is full." if t == "storage_put" else "Your inventory is full."
                if tgt:
                    tgt["qty"] += qty
                else:
                    dst.append(dict(s, qty=qty) if qty == s["qty"] else dict(s, uid=uid(), qty=qty))
                if qty == s["qty"]:
                    src.remove(s)
                else:
                    s["qty"] -= qty
                p.dirty = True
                await self.db.storage.update_one({"account_id": acc}, {"$set": {"items": st}}, upsert=True)
                await self.save(p)
            view = {"t": "storage", "npc": n["id"] if "id" in n else msg.get("npc"), "name": n["name"], "items": st, "gold": vault["gold"], "cap": STORAGE_SLOTS}
            for o in self.players.values():
                if o.account_id == acc:
                    o.send(dict(view, sync=o is not p))

    def travel_cost(self, n, z):
        return round(WAYSTONE_COST[0] + math.hypot(n["pos"][0] - z["x"], n["pos"][1] - z["z"]) * WAYSTONE_COST[1])

    # ------------- party
    def party_members(self, p):
        pt = self.parties.get(getattr(p, "party", None))
        return [self.players[i] for i in pt["members"] if i in self.players] if pt else [p]

    def party_send(self, pid):
        pt = self.parties.get(pid)
        if not pt:
            return
        mem = [self.players[i] for i in pt["members"] if i in self.players]
        view = {"t": "party", "id": pid, "leader": pt["leader"], "members": [dict(id=o.id, name=o.name, level=o.level, cls=o.cls, hp=round(o.hp), max_hp=o.max_hp,
                                                                                    x=round(o.x, 1), z=round(o.z, 1), dead=bool(o.dead_until)) for o in mem]}
        for o in mem:
            o.send(view)

    def party_leave(self, p, note="You left the party."):
        pid = getattr(p, "party", None)
        pt = self.parties.get(pid)
        p.party = None
        p.send({"t": "party", "id": None, "members": []})
        if not pt:
            return
        p.send({"t": "sys", "msg": note})
        pt["members"].discard(p.id)
        if len(pt["members"]) <= 1:
            for i in pt["members"]:
                o = self.players.get(i)
                if o:
                    o.party = None
                    o.send({"t": "party", "id": None, "members": []})
                    o.send({"t": "sys", "msg": "Your party has disbanded."})
            del self.parties[pid]
            return
        if pt["leader"] == p.id:
            pt["leader"] = next(iter(pt["members"]))
        for o in self.party_members(self.players[pt["leader"]]):
            o.send({"t": "sys", "msg": f"{p.name} left the party."})
        self.party_send(pid)

    def party_cmd(self, p, msg):
        t, pid = msg["t"], getattr(p, "party", None)
        if t == "party_invite":
            o = self.players.get(msg.get("id"))
            if not o or o is p:
                return "That player is not available."
            if getattr(o, "party", None):
                return f"{o.name} is already in a party."
            if pid and self.parties[pid]["leader"] != p.id:
                return "Only the party leader can invite."
            if pid and len(self.parties[pid]["members"]) >= PARTY_MAX:
                return "Your party is full."
            self.invites[o.id] = (p.id, now() + 60)
            o.send({"t": "party_invite", "from": p.name, "fid": p.id, "lvl": p.level})
            return p.send({"t": "sys", "msg": f"Party invitation sent to {o.name}."})
        if t in ("party_accept", "party_decline"):
            inv = self.invites.pop(p.id, None)
            inviter = self.players.get(inv[0]) if inv and now() < inv[1] else None
            if not inviter:
                return "That invitation has expired."
            if t == "party_decline":
                return inviter.send({"t": "sys", "msg": f"{p.name} declined your invitation."})
            if pid:
                return "You are already in a party."
            ipid = getattr(inviter, "party", None)
            if not ipid:
                ipid = uid()
                self.parties[ipid] = dict(leader=inviter.id, members={inviter.id})
                inviter.party = ipid
            pt = self.parties[ipid]
            if len(pt["members"]) >= PARTY_MAX:
                return "That party is full."
            pt["members"].add(p.id)
            p.party = ipid
            for o in self.party_members(p):
                o.send({"t": "sys", "msg": f"{p.name} joined the party.", "kind": "good"})
            return self.party_send(ipid)
        if t == "party_leave":
            return self.party_leave(p)
        if t == "party_kick":
            o = self.players.get(msg.get("id"))
            if not pid or self.parties[pid]["leader"] != p.id or not o or getattr(o, "party", None) != pid or o is p:
                return "You cannot remove that player."
            return self.party_leave(o, "You were removed from the party.")

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
        if action == "sethome" and n.get("waystone"):
            p.home, p.dirty = n["town"], True
            asyncio.create_task(self.save(p))
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": 0})
            p.send({"t": "sys", "msg": f"{TOWN_NAMES[n['town']]} is now your home. You will return here when you fall or use Stuck.", "kind": "quest"})
            self.npc_dialog(p, npc_id)
            return None
        if action.startswith("travel:") and n.get("waystone"):
            z = next((z for z in SAFE_ZONES if z["town"] == action[7:] and z["town"] != n["town"] and z.get("waystone", True)), None)
            if not z:
                return "Unknown destination."
            cost = self.travel_cost(n, z)
            if p.gold < cost:
                return f"You need {cost} gold to travel there."
            p.gold -= cost
            self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": 0})
            p.x, p.z = z["x"] + rnd.uniform(-4, 4), z["z"] + rnd.uniform(5, 8)
            p.path, p.target, p.pending, p.queued, p.dirty = [], None, None, None, True
            for mm in self.monsters.values():
                if mm.target == p.id:
                    mm.target = None
            return p.send({"t": "trade", "msg": f"The waystone carries you to {TOWN_NAMES[z['town']]} (-{cost} gold)."})
        if action == "ferry" and n.get("ferry"):
            out = n["ferry"] == "isles"
            if out and p.gold < FERRY_COST:
                return f"You need {FERRY_COST} gold for passage to the isles."
            if out:
                p.gold -= FERRY_COST
            dx, dz = FERRY_DEST[n["ferry"]]
            self.teleport(p, dx + rnd.uniform(-1.5, 1.5), dz + rnd.uniform(-1, 1))
            return p.send({"t": "trade", "msg": f"The ferry carries you across the waves to the Offshore Isles (-{FERRY_COST} gold)." if out else "The ferry carries you back to Saltmere Harbor."})
        if action == "crypt" and n.get("crypt"):
            q = p.quests.get("q_sexton")
            if not q or q["s"] != "active" or q.get("opened") or not self.count_item(p, "sexton_key"):
                return "The lock will not turn."
            self.take_item(p, "sexton_key", 1)
            q["opened"], p.dirty = True, True
            pool = [k for k, it in ITEMS.items() if it["type"] in ("weapon", "armor") and it["rarity"] in ("rare", "epic", "legendary")
                    and it.get("lvl", 1) <= 15 and it.get("price", 0) > 0 and (not it.get("cls") or p.cls in it["cls"])]
            gear = rnd.choice(pool)
            props, pname = roll_props(gear, 15, rnd, force=True)
            t = now()
            for item, qty, pr, pn, ox in [(gear, 1, props, pname, -0.8), ("gold", 1500, None, None, 0.8)]:
                lid = "l" + uid()
                self.loot[lid] = dict(id=lid, item=item, qty=qty, props=pr, pname=pn, x=round(n["pos"][0] + ox, 2), z=round(n["pos"][1] - 1.2, 2), owner=p.id,
                                      party=None, owner_until=t + LOOT_EXPIRE_SECS, expires=t + LOOT_EXPIRE_SECS * 3)
            self.fx(n["pos"][0], n["pos"][1], {"t": "fx", "k": "legendary_burst", "x": n["pos"][0], "z": n["pos"][1]})
            return p.send({"t": "sys", "msg": "The lock grinds open! Treasure glitters in the Sealed Crypt. Return to Gravekeeper Morrow.", "kind": "quest"})
        if action == "chest" and n.get("chest"):
            cds = p.__dict__.setdefault("chest_cd", {})
            if cds.get(npc_id, 0) > now():
                return "The chest is empty for now."
            cds[npc_id] = now() + CHEST_COOLDOWN
            self.open_chest(p, n)
            return p.send({"t": "sys", "msg": f"You pry open the {n['name']}! Treasure spills onto the sand.", "kind": "quest"})
        if action.startswith("accept:"):
            qid = action[7:]
            req = QUESTS.get(qid, {}).get("requires")
            if qid not in n.get("quests", []) or qid in p.quests or (req and p.quests.get(req, {}).get("s") != "done"):
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
            if not all(self.can_add(p, i, q) for i, q in r["items"]) or (r.get("gear") and len(p.inventory) >= INV_SLOTS):
                return "Make room in your inventory first."
            if qd["kind"] == "kill_collect":
                self.take_item(p, qd["collect"], qd["collect_count"])
            if qd["kind"] == "deliver":
                self.take_item(p, qd["item"], 1)
            p.quests[qid]["s"] = "done"
            for i, q in r["items"]:
                self.add_item(p, i, q)
            if r.get("gear"):
                rar, lvl = r["gear"]
                pool = [k for k, it in ITEMS.items() if it["type"] in ("weapon", "armor") and it["rarity"] == rar and it.get("lvl", 1) <= lvl
                        and it.get("price", 0) > 0 and (not it.get("cls") or p.cls in it["cls"])]
                g = rnd.choice(pool)
                props, pname = roll_props(g, lvl, rnd, force=True)
                p.inventory.append(dict(uid=uid(), item=g, qty=1, props=props, pname=pname))
                p.send({"t": "sys", "msg": f"Reward: {pname or ITEMS[g]['name']}", "kind": "quest"})
            p.gold += r["gold"]
            p.send({"t": "sys", "msg": f"Quest complete: {qd['name']} (+{r['gold']} gold)", "kind": "quest"})
            self.give_xp(p, r["xp"])
            asyncio.create_task(self.save(p))
            return None
        return "Nothing happens."

    def open_chest(self, p, n):
        lvl, t = n["chest"], now()
        drops = [("gold", rnd.randint(lvl * 25, lvl * 45)), ("sea_pearl", 1)]
        drops += [(g, -1) for g in (random_gear(lvl, rnd) for _ in range(rnd.randint(1, 2))) if g]
        if rnd.random() < 0.25:
            drops.append(("black_pearl", 1))
        if rnd.random() < 0.1:
            drops.append((rnd.choice(["ring_vampire", "soulreaver_blade", "void_staff", "stormcaller_bow", "dreadknight_helm"]), 1))
        cx, cz = n["pos"]
        for i, (item, qty) in enumerate(drops):
            a = i * 2.1 + rnd.uniform(0, 1)
            lx, lz = cx + math.cos(a) * (1.2 + 0.4 * i), cz + math.sin(a) * (1.2 + 0.4 * i)
            if not self.world.walkable(lx, lz):
                lx, lz = p.x, p.z
            props, pname = (None, None) if item == "gold" else roll_props(item, lvl, rnd, force=qty == -1)
            lid = "l" + uid()
            self.loot[lid] = dict(id=lid, item=item, qty=max(1, qty), props=props, pname=pname, x=round(lx, 2), z=round(lz, 2), owner=p.id,
                                  party=getattr(p, "party", None), owner_until=t + LOOT_OWNER_SECS, expires=t + LOOT_EXPIRE_SECS)

    def drop_item(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "That item is gone."
        if p.dead_until:
            return "You cannot do that while dead."
        if ITEMS[s["item"]]["type"] == "quest":
            return "Quest items cannot be dropped."
        p.inventory.remove(s)
        t, a = now(), rnd.uniform(0, 6.283)
        lx, lz = p.x + math.cos(a) * 0.8, p.z + math.sin(a) * 0.8
        if not self.world.walkable(lx, lz):
            lx, lz = p.x, p.z
        lid = "l" + uid()
        self.loot[lid] = dict(id=lid, item=s["item"], qty=s["qty"], props=s.get("props"), pname=s.get("pname"), x=round(lx, 2), z=round(lz, 2),
                              owner=None, party=None, owner_until=0, expires=t + 300)
        p.send({"t": "sys", "msg": f"You drop {s.get('pname') or ITEMS[s['item']]['name']}" + (f" ×{s['qty']}" if s["qty"] > 1 else "") + "."})
        p.dirty = True
        return None

    @staticmethod
    def bounty_state(p, k):
        b = p.bounties.get(k) or {}
        if b.get("s") in ("active", "done"):
            return b["s"]
        return "claimed" if b.get("s") == "claimed" and b.get("day") == datetime.now(timezone.utc).date().isoformat() else "available"

    def boss_respawn_in(self, key):
        t = now()
        return max([0] + [round(m.dead_until - t) for m in self.monsters.values() if m.type == key and m.dead_until and m.dead_until > t])

    def bounty_view(self, p, npc_id):
        p.send({"t": "bounty", "npc": npc_id, "tokens": self.count_item(p, "bounty_token"),
                "list": [dict(id=k, **{kk: v for kk, v in b.items()}, state=self.bounty_state(p, k), respawn_in=self.boss_respawn_in(k)) for k, b in BOUNTIES.items()],
                "shop": [dict(item=i, cost=c) for i, c in BOUNTY_SHOP]})

    def bounty_cmd(self, p, npc_id, action, bid):
        n = self.near_npc(p, npc_id, "board")
        if not n:
            return "You are too far from a Bounty Board."
        if action == "buy":
            cost = dict(BOUNTY_SHOP).get(bid)
            if not cost:
                return "That item is not for trade."
            if self.count_item(p, "bounty_token") < cost:
                return f"You need {cost} Bounty Tokens."
            if not self.can_add(p, bid, 1):
                return "Your inventory is full."
            self.take_item(p, "bounty_token", cost)
            self.add_item(p, bid, 1)
            p.send({"t": "trade", "msg": f"Traded {cost} Bounty Tokens for {ITEMS[bid]['name']}."})
        elif bid not in BOUNTIES:
            return "Unknown bounty."
        else:
            st, b = self.bounty_state(p, bid), BOUNTIES[bid]
            if action == "accept":
                if st != "available":
                    return "You cannot take that bounty right now."
                p.bounties[bid] = {"s": "active"}
                p.send({"t": "sys", "msg": f"[Bounty] Accepted: slay {b['name']} — {b['where']}.", "kind": "quest"})
            elif action == "abandon":
                if st != "active":
                    return "That bounty is not active."
                p.bounties.pop(bid, None)
            elif action == "turnin":
                if st != "done":
                    return "That bounty is not complete."
                if not self.can_add(p, "bounty_token", b["tokens"]):
                    return "Your inventory is full."
                self.add_item(p, "bounty_token", b["tokens"])
                p.gold += b["gold"]
                p.bounties[bid] = {"s": "claimed", "day": datetime.now(timezone.utc).date().isoformat()}
                asyncio.ensure_future(self.db.bounty_claims.insert_one({"char_id": p.id, "name": p.name, "cls": p.cls, "boss": bid, "ts": datetime.now(timezone.utc)}))
                p.send({"t": "trade", "msg": f"Bounty claimed: +{b['gold']} gold, +{b['tokens']} Bounty Token{'s' if b['tokens'] > 1 else ''}."})
                self.give_xp(p, b["xp"])
            else:
                return "Unknown action."
        p.dirty = True
        self.bounty_view(p, npc_id)
        return None

    async def admin_give(self, p, msg):
        if not getattr(p, "admin", False):
            return "Only the realm's keeper may do that."
        name, item, pname = str(msg.get("to", "")).strip().lower(), msg.get("item"), str(msg.get("pname") or "").strip()[:48] or None
        it = ITEMS.get(item)
        if not it or it["type"] == "quest":
            return "Unknown item."
        props = {}
        for k, v in (msg.get("props") or {}).items():
            if k not in GIVE_STATS or not isinstance(v, (int, float)) or not -100000 <= v <= 100000:
                return f"Invalid stat: {k}"
            if v:
                props[k] = round(v, 1) if v % 1 else int(v)
        qty = max(1, min(it["stack"], int(msg.get("qty") or 1)))
        gear = it["type"] in ("weapon", "armor")
        props = props if gear and props else None
        slot = dict(uid=uid(), item=item, qty=1 if props else qty, props=props, pname=pname if gear else None) if props or (gear and pname) else None
        o = next((o for o in self.players.values() if o.name.lower() == name), None)
        label = f"{pname or it['name']}" + (f" x{qty}" if not slot and qty > 1 else "")
        if o:
            if slot:
                if len(o.inventory) >= INV_SLOTS:
                    return f"{o.name}'s inventory is full."
                o.inventory.append(slot)
                o.dirty = True
            elif not self.add_item(o, item, qty):
                return f"{o.name}'s inventory is full."
            o.send({"t": "sys", "msg": f"A gift from the realm's keeper: {label}", "kind": "quest"})
            asyncio.create_task(self.save(o))
        else:
            doc = await self.db.characters.find_one({"name_lower": name}, {"_id": 0, "inventory": 1, "name": 1})
            if not doc:
                return "No character by that name."
            if len(doc["inventory"]) >= INV_SLOTS:
                return f"{doc['name']}'s inventory is full."
            await self.db.characters.update_one({"name_lower": name}, {"$push": {"inventory": slot or dict(uid=uid(), item=item, qty=qty)}})
        p.send({"t": "sys", "msg": f"Gave {label} to {o.name if o else doc['name']}.", "kind": "quest"})
        return None

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
        gain = sell_price(s["item"], s.get("props")) * qty
        s["qty"] -= qty
        if s["qty"] <= 0:
            p.inventory.remove(s)
        p.gold += gain
        p.dirty = True
        p.send({"t": "trade", "msg": f"Sold {qty}x {it['name']} for {gain} gold."})
        asyncio.ensure_future(self.db.transactions.insert_one(dict(char=p.id, kind="sell", item=s["item"], qty=qty, gold=gain, ts=datetime.now(timezone.utc).isoformat())))
        asyncio.create_task(self.save(p))

    def equip(self, p, suid, want=None):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        it = ITEMS[s["item"]]
        if it["type"] not in ("weapon", "armor"):
            return "That cannot be equipped."
        if it.get("cls") and p.cls not in it["cls"]:
            return f"Only {', '.join(c.capitalize() for c in it['cls'])}s can use that."
        req = s.get("lvl", it.get("lvl", 1))
        if p.level < req:
            return f"Requires level {req}."
        slot = it["slot"]
        if slot == "ring":
            slot = want if want in RING_SLOTS else next((r for r in RING_SLOTS if r not in p.equipment), RING_SLOTS[0])
        p.inventory.remove(s)
        old = p.equipment.get(slot)
        p.equipment[slot] = {k: s[k] for k in ("uid", "item", "props", "pname") if s.get(k)}
        if old:
            p.inventory.append(dict(old, qty=1))
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
        p.inventory.append(dict(e, qty=1))
        p.recalc()
        p.hp, p.mp = min(p.hp, p.max_hp), min(p.mp, p.max_mp)

    def use(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        it = ITEMS[s["item"]]
        if it["type"] != "consumable":
            return self.equip(p, suid) if it["type"] in ("weapon", "armor") else "You can't use that."
        if it.get("coffer"):
            s["qty"] -= 1
            if s["qty"] <= 0:
                p.inventory.remove(s)
            p.dirty = True
            return self.open_coffer(p, it["coffer"])
        if p.cds.get("potion", 0) > now():
            return "You must wait before drinking again."
        p.cds["potion"] = now() + 2
        before = p.hp
        p.hp = p.max_hp if it.get("full") == "hp" else min(p.max_hp, p.hp + it.get("heal", 0))
        p.mp = p.max_mp if it.get("full") == "mp" else min(p.max_mp, p.mp + it.get("mana", 0))
        s["qty"] -= 1
        if s["qty"] <= 0:
            p.inventory.remove(s)
        p.dirty = True
        self.fx(p.x, p.z, {"t": "fx", "k": "heal", "tgt": p.id, "v": round(p.hp - before)})

    def destroy(self, p, suid):
        s = self.slot_of(p, suid)
        if not s:
            return "Item not found."
        if ITEMS[s["item"]]["type"] == "quest":
            return "You cannot discard a quest item."
        p.inventory.remove(s)
        p.dirty = True

    # ------------- chat
    def home_zone(self, p):
        z = next((z for z in SAFE_ZONES if z["town"] == p.home), None)
        return z or min(SAFE_ZONES, key=lambda s: (s["x"] - p.x) ** 2 + (s["z"] - p.z) ** 2)

    def pit_kill(self, m):
        tier = min(range(1, 5), key=lambda i: abs(PIT_ROOMS[i]["x"] - m.spawn["x"]))
        self.pit_kills[tier] += 1
        if self.pit_kills[tier] % PIT_CHAMPION_KILLS or any(c.type == f"pit_champion_{tier}" and not c.dead_until for c in list(self.monsters.values()) + self.spawn_q):
            return
        rm, self.champ_n = PIT_ROOMS[tier], self.champ_n + 1
        mid = f"champ{self.champ_n}"
        c = Monster(mid, f"pit_champion_{tier}", dict(x=rm["x"], z=rm["z"], r=4, monster=f"pit_champion_{tier}", n=1), self.world)
        self.spawn_q.append(c)
        self.broadcast_sys(f"After {self.pit_kills[tier]} kills, the Wave Champion {c.d['name']} (Lv {c.d['level']}) rises in {rm['name']}!")

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
        mk = re.fullmatch(r"mark([0-9])", text.lower())
        if mk:
            p.marks[mk.group(1)] = [round(p.x, 1), round(p.z, 1)]
            p.dirty = True
            return p.send({"t": "sys", "msg": f"Mark {mk.group(1)} set here ({round(p.x)}, {round(p.z)}). Creare Porta can now open a portal to it.", "kind": "quest"})
        if text.lower().strip() in ("/who", "/online", "/players"):
            ps = sorted(self.players.values(), key=lambda x: (-x.level, x.name.lower()))
            names = ", ".join(f"{x.name} (Lv {x.level} {x.cls.title()}{', away' if x.linkdead_at else ''})" for x in ps)
            return p.send({"t": "sys", "msg": f"{len(ps)} hero{'es' if len(ps) != 1 else ''} online: {names}"})
        if text.startswith("/p "):
            if not getattr(p, "party", None):
                return p.send({"t": "err", "msg": "You are not in a party."})
            m = dict(kind="party", name=p.name, lvl=p.level, text=text[3:], ts=ts)
            for o in self.party_members(p):
                o.send({"t": "chat", "m": m})
            return
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
        elif t in ("party_invite", "party_accept", "party_decline", "party_leave", "party_kick"):
            err = self.party_cmd(p, msg)
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
            err = "Spells are learned automatically as you level up."
        elif t == "equip":
            err = self.equip(p, msg.get("uid"), msg.get("slot"))
        elif t == "unequip":
            err = self.unequip(p, msg.get("slot"))
        elif t == "use":
            err = self.use(p, msg.get("uid"))
        elif t == "destroy":
            err = self.destroy(p, msg.get("uid"))
        elif t == "drop":
            err = self.drop_item(p, msg.get("uid"))
        elif t == "bounty":
            err = self.bounty_cmd(p, msg.get("npc"), msg.get("action"), msg.get("id"))
        elif t == "give":
            err = await self.admin_give(p, msg)
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
        elif t == "unstuck":
            tt = now()
            if p.dead_until:
                return
            if tt < getattr(p, "unstuck_at", 0):
                return p.send({"t": "err", "msg": f"You can use Unstuck again in {int(p.unstuck_at - tt) + 1}s."})
            p.unstuck_at = tt + 60
            town = self.home_zone(p)
            p.x, p.z = town["x"] + rnd.uniform(-4, 4), town["z"] + rnd.uniform(-8, -5)
            p.path, p.target, p.queued, p.pending, p.dash, p.dirty = [], None, None, None, None, True
            p.send({"t": "sys", "msg": f"You have been freed and returned to the safe square of {TOWN_NAMES[town['town']]}."})
        elif t == "stop":
            p.path, p.target, p.queued, p.pending = [], None, None, None
            if msg.get("action") and p.buffs.pop("invis", None):
                p.dirty = True
                p.send({"t": "sys", "msg": "Contra Visus ends. You are visible again."})
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
            pt = msg.get("pt")
            pt = (float(pt[0]), float(pt[1])) if isinstance(pt, list) and len(pt) == 2 and all(isinstance(v, (int, float)) for v in pt) else None
            err = self.cast(p, msg.get("ab"), msg.get("id"), pt, msg.get("mark"))
        elif t == "loot_all":
            self.loot_all(p, msg.get("filter"))
        elif t == "autoloot":
            p.autoloot = msg.get("filter") if isinstance(msg.get("filter"), dict) else None
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
                elif msg["action"] == "storage":
                    err = await self.storage_cmd(p, {"t": "storage_open", "npc": nid})
                else:
                    err = self.npc_action(p, nid, msg["action"])
        elif t in ("storage_open", "storage_put", "storage_take", "storage_gold", "storage_sort"):
            err = await self.storage_cmd(p, msg)
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
                attrs=dict(c["attrs"]), attr_points=0, skill_points=0, abilities=list(c["start_abilities"]), marks={},
                inventory=[dict(uid=uid(), item="hp_potion", qty=5), dict(uid=uid(), item="mp_potion", qty=3)], equipment=eq, quests={},
                binds=default_binds(cls), x=to_global(90.0, 192.0)[0] + random.uniform(-3, 3), z=to_global(90.0, 192.0)[1], hp=9999, mp=9999, schema=1,
                created_at=datetime.now(timezone.utc).isoformat())
