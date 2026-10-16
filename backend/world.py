"""Deterministic world layout + collision grid + pathfinding for Suminex."""
import math, random, base64, heapq
import numpy as np

W, H = 1600, 600
OH = 400
SEMEL = (90.0, 200.0)
ELDER = (1000.0, 210.0)
IRON = (1260.0, 200.0)
SUNH = (1470.0, 300.0)
SAFE_HALF = 16.0
SAFE_ZONES = [dict(town="semel", x=SEMEL[0], z=SEMEL[1], half=SAFE_HALF), dict(town="elderglen", x=ELDER[0], z=ELDER[1], half=SAFE_HALF),
              dict(town="ironhold", x=IRON[0], z=IRON[1], half=SAFE_HALF), dict(town="sunhollow", x=SUNH[0], z=SUNH[1], half=SAFE_HALF)]
TOWN_RINGS = [(SEMEL, 60, 60), (ELDER, 66, 52), (IRON, 50, 44), (SUNH, 54, 44)]


def in_safe(x, z):
    for s in SAFE_ZONES:
        if abs(x - s["x"]) <= s["half"] and abs(z - s["z"]) <= s["half"]:
            return s["town"]
    return None


def catmull(pts, step=1.5):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        seg = math.dist(p1, p2)
        n = max(2, int(seg / step))
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
                                    (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in range(2)))
    out.append(tuple(pts[-1]))
    return out


MAIN_ROAD = [SEMEL, (146, 200), (200, 190), (260, 214), (320, 238), (380, 225), (440, 192), (500, 172), (560, 186), (620, 220),
             (680, 240), (740, 226), (800, 202), (860, 206), (938, 210), ELDER]
SIDE_PATHS = [
    dict(w=2.2, pts=[SEMEL, (90, 144), (85, 110), (95, 72)]),
    dict(w=2.2, pts=[SEMEL, (90, 256), (95, 290), (105, 328)]),
    dict(w=2.0, pts=[(380, 225), (388, 170), (400, 116)]),
    dict(w=1.4, pts=[(400, 116), (455, 92), (518, 66)], hidden=True),
    dict(w=1.8, pts=[(448, 190), (452, 225), (455, 250)]),
    dict(w=2.0, pts=[(620, 220), (612, 270), (600, 318)]),
    dict(w=1.6, pts=[(740, 226), (758, 266), (762, 298)]),
    dict(w=2.0, pts=[(800, 202), (806, 160), (800, 122)]),
    dict(w=2.0, pts=[ELDER, (1000, 162), (990, 112), (966, 72)]),
    dict(w=3.0, pts=[ELDER, (1062, 210), (1110, 214), (1170, 198), (1222, 200), IRON]),
    dict(w=3.0, pts=[IRON, (1310, 214), (1360, 250), (1410, 290), SUNH]),
    dict(w=2.0, pts=[IRON, (1262, 150), (1240, 95), (1215, 80)]),
    dict(w=2.0, pts=[IRON, (1268, 250), (1290, 300), (1300, 335)]),
    dict(w=2.0, pts=[SUNH, (1470, 250), (1520, 190), (1550, 125)]),
    dict(w=1.6, pts=[(1310, 214), (1350, 160), (1385, 100)]),
    dict(w=1.4, pts=[(560, 186), (560, 152)], hidden=True),
    dict(w=1.6, pts=[(200, 190), (215, 240), (232, 262)]),
]
STREAMS = [[(300, -5), (290, 80), (310, 160), (300, 235), (320, 320), (310, 405)],
           [(700, -5), (715, 90), (690, 170), (705, 240), (690, 330), (700, 405)]]
LAKES = [dict(x=1045, z=335, rx=30, rz=20), dict(x=1548, z=352, rx=26, rz=16), dict(x=420, z=330, rx=14, rz=9)]

REGIONS = [
    dict(name="Titus", x=90, z=200, r=58, lvl="Safe town"),
    dict(name="Elderglen", x=1000, z=210, r=64, lvl="Safe town"),
    dict(name="Silkfield Meadows", x=92, z=90, r=45, lvl="1-2"),
    dict(name="Imp Hollow", x=102, z=318, r=40, lvl="1-3"),
    dict(name="Old Watch Ruins", x=400, z=112, r=40, lvl="5-7"),
    dict(name="Hollow Deep Entrance", x=520, z=62, r=28, lvl="Dungeon 35-75"),
    dict(name="Goblin Thicket", x=452, z=255, r=30, lvl="4"),
    dict(name="Ring of Kael", x=560, z=150, r=18, lvl="-"),
    dict(name="Bandit Hideout", x=600, z=322, r=32, lvl="6"),
    dict(name="Veiled Circle", x=762, z=300, r=30, lvl="13"),
    dict(name="Grimtusk Orc Camp", x=800, z=120, r=34, lvl="10"),
    dict(name="Troll Fells", x=962, z=68, r=46, lvl="16 (Danger)"),
    dict(name="Moonmere Lake", x=1045, z=335, r=40, lvl="14-16"),
    dict(name="Direfang Hollow", x=230, z=40, r=32, lvl="20 (Danger)"),
    dict(name="Broodmother's Lair", x=380, z=372, r=30, lvl="25 (Danger)"),
    dict(name="Wraithmoor", x=660, z=48, r=32, lvl="30 (Danger)"),
    dict(name="Shattered Quarry", x=505, z=365, r=30, lvl="38 (Danger)"),
    dict(name="Dreadkeep Ruins", x=820, z=35, r=28, lvl="48 (Deadly)"),
    dict(name="Abyssal Rift", x=1040, z=25, r=26, lvl="60 (Deadly)"),
    dict(name="The Old Pass", x=1094, z=210, r=14, lvl="-"),
    dict(name="Ironhold", x=1260, z=200, r=52, lvl="Safe town"),
    dict(name="Sunhollow", x=1470, z=300, r=54, lvl="Safe town"),
    dict(name="Ashen Steppe", x=1215, z=80, r=38, lvl="20-25"),
    dict(name="Sunken Marsh", x=1300, z=345, r=34, lvl="25-30"),
    dict(name="Emberfall Crags", x=1390, z=95, r=34, lvl="38"),
    dict(name="Howling Ridge", x=1550, z=120, r=36, lvl="48 (Deadly)"),
    dict(name="Sunmere", x=1548, z=352, r=30, lvl="-"),
    dict(name="Ghostlight Fen", x=1170, z=300, r=30, lvl="30"),
]

DUNGEON_ROOMS = [
    dict(name="Hollow Deep Antechamber", x=420, z=555, r=12, lvl="Dungeon"),
    dict(name="Fungal Grotto", x=470, z=505, r=15, lvl="35"),
    dict(name="Bone Gallery", x=540, z=555, r=15, lvl="42"),
    dict(name="Drowned Crypt", x=605, z=495, r=15, lvl="52"),
    dict(name="Shade Sanctum", x=655, z=560, r=14, lvl="58"),
    dict(name="Throne of the Hollow King", x=700, z=500, r=19, lvl="75 (Boss)"),
]
PORTALS = [dict(id="hollow_in", x=518.0, z=51.0, to=(426.0, 550.0), name="Hollow Deep", msg="You descend into the Hollow Deep..."),
           dict(id="hollow_out", x=411.0, z=562.0, to=(518.0, 45.0), name="Exit to the surface", msg="You climb back into the daylight.")]
SCATTER_BANDS = [(200, ["giant_spider", "imp"]), (330, ["forest_wolf", "imp", "goblin_scout"]), (450, ["goblin_scout", "skeleton", "forest_wolf"]),
                 (600, ["forest_bandit", "venomous_spider", "skeleton"]), (760, ["orc_warrior", "venomous_spider", "forest_bandit"]),
                 (900, ["dark_cultist", "orc_warrior"]), (1120, ["forest_troll", "dark_cultist"]),
                 (1350, ["dire_wolf", "shadow_wraith", "forest_troll"]), (99999, ["broodmother", "stone_golem", "shadow_wraith"])]
SPAWNS = [
    ("cave_crawler", 470, 505, 11, 8), ("crypt_ghoul", 540, 555, 11, 8), ("bone_colossus", 605, 495, 10, 5),
    ("hollow_shade", 655, 560, 10, 6), ("crypt_ghoul", 507, 528, 4, 2), ("cave_crawler", 630, 530, 4, 2), ("hollow_king", 702, 500, 3, 1),
    ("giant_spider", 92, 88, 46, 24), ("giant_spider", 190, 245, 30, 12), ("giant_spider", 165, 120, 28, 10),
    ("imp", 102, 322, 42, 22), ("imp", 225, 160, 28, 10), ("imp", 180, 330, 26, 9),
    ("forest_wolf", 268, 175, 34, 12), ("forest_wolf", 350, 290, 36, 12), ("forest_wolf", 330, 140, 26, 8),
    ("goblin_scout", 455, 258, 34, 16), ("goblin_scout", 500, 230, 22, 7),
    ("skeleton", 400, 112, 38, 16), ("skeleton", 545, 122, 30, 10), ("skeleton", 470, 60, 22, 6),
    ("forest_bandit", 600, 322, 36, 16), ("forest_bandit", 650, 270, 24, 8),
    ("venomous_spider", 520, 78, 28, 12), ("venomous_spider", 650, 140, 34, 12), ("venomous_spider", 590, 60, 22, 6),
    ("orc_warrior", 800, 122, 40, 16), ("orc_warrior", 860, 160, 24, 8),
    ("dark_cultist", 762, 300, 32, 13), ("dark_cultist", 830, 350, 22, 6),
    ("dire_wolf", 230, 40, 30, 10), ("broodmother", 380, 372, 28, 6), ("shadow_wraith", 660, 48, 30, 8),
    ("stone_golem", 505, 365, 28, 6), ("death_knight", 820, 35, 26, 7), ("abyssal_fiend", 1040, 25, 24, 4),
    ("dire_wolf", 1215, 80, 34, 12), ("broodmother", 1300, 345, 30, 8), ("stone_golem", 1390, 95, 30, 8),
    ("death_knight", 1550, 120, 32, 9), ("shadow_wraith", 1170, 300, 28, 9), ("abyssal_fiend", 1580, 30, 16, 3),
    ("forest_troll", 962, 72, 44, 10), ("forest_troll", 885, 335, 28, 6), ("forest_troll", 1060, 90, 26, 5),
]


def _rect(x, z, w, d, kind, style, **kw):
    return dict(x=x, z=z, w=w, d=d, kind=kind, style=style, **kw)


SEMEL_BUILDINGS = [
    _rect(64, 180, 12, 10, "smithy", "semel", name="Brannoc's Forge"), _rect(118, 180, 11, 9, "shop", "semel", name="Vell's Sundries"),
    _rect(63, 222, 10, 14, "chapel", "semel", name="Chapel of Dawn"), _rect(119, 224, 14, 10, "hall", "semel", name="Titus Hall"),
    _rect(50, 196, 8, 8, "house", "semel"), _rect(60, 165, 9, 7, "house", "semel"), _rect(118, 165, 8, 8, "house", "semel"),
    _rect(118, 238, 9, 7, "house", "semel"), _rect(64, 240, 8, 8, "house", "semel"), _rect(44, 215, 7, 8, "house", "semel"),
]
ELDER_BUILDINGS = [
    _rect(965, 186, 9, 9, "hut", "elder"), _rect(1035, 186, 10, 10, "hut", "elder", name="Thessaly's Armory"),
    _rect(970, 238, 10, 10, "hut", "elder", name="Grove of Orin"), _rect(1032, 238, 9, 9, "hut", "elder", name="Fenn's Provisions"),
    _rect(1000, 250, 16, 8, "longhouse", "elder", name="Warden's Lodge"), _rect(952, 228, 8, 8, "hut", "elder"),
    _rect(1048, 228, 8, 8, "hut", "elder"), _rect(980, 175, 8, 8, "hut", "elder"), _rect(1022, 174, 8, 8, "hut", "elder"),
]
IRON_BUILDINGS = [
    _rect(1232, 180, 11, 10, "smithy", "iron", town="ironhold", name="Ironbeard Forge"), _rect(1288, 180, 11, 9, "shop", "iron", town="ironhold", name="Brikka's Stores"),
    _rect(1230, 222, 10, 13, "chapel", "iron", town="ironhold", name="Shrine of the Anvil"), _rect(1290, 224, 14, 10, "hall", "iron", town="ironhold", name="Thane's Hall"),
    _rect(1218, 200, 8, 8, "house", "iron", town="ironhold"), _rect(1302, 200, 8, 8, "house", "iron", town="ironhold"),
    _rect(1246, 166, 8, 7, "house", "iron", town="ironhold"), _rect(1276, 236, 8, 7, "house", "iron", town="ironhold"),
]
SUN_BUILDINGS = [
    _rect(1438, 282, 10, 10, "hut", "sun", town="sunhollow", name="Soren's Wharf Goods"), _rect(1502, 282, 10, 10, "hut", "sun", town="sunhollow", name="Lysandra's Curios"),
    _rect(1440, 322, 9, 9, "hut", "sun", town="sunhollow", name="Tidehouse"), _rect(1500, 322, 9, 9, "hut", "sun", town="sunhollow"),
    _rect(1470, 336, 16, 8, "longhouse", "sun", town="sunhollow", name="Harvest Hall"), _rect(1424, 304, 8, 8, "hut", "sun", town="sunhollow"),
    _rect(1516, 304, 8, 8, "hut", "sun", town="sunhollow"), _rect(1470, 266, 8, 8, "hut", "sun", town="sunhollow"),
]
WILD_STRUCTS = [
    _rect(232, 266, 9, 7, "ruin_house", "ruin", name="Abandoned Farmstead"),
    _rect(640, 196, 6, 6, "tower", "ruin", name="Broken Watchtower"),
    _rect(870, 252, 6, 5, "shrine", "ruin", name="Forgotten Shrine"),
]


class World:
    def __init__(self):
        rnd = random.Random(1337)
        self.blocked = np.zeros((H, W), dtype=np.uint8)
        b = self.blocked
        b[:3, :] = 1; b[OH - 3:, :] = 1; b[:, :3] = 1; b[:, -3:] = 1
        self.road_dist = np.full((H, W), 99.0, dtype=np.float32)
        self.main_road = catmull(MAIN_ROAD, 2.0)
        self.paths = [dict(w=p["w"], hidden=p.get("hidden", False), pts=catmull(p["pts"], 2.0)) for p in SIDE_PATHS]
        self._stamp_dist(self.main_road, 3.2, 10)
        for p in self.paths:
            self._stamp_dist(p["pts"], p["w"], 8)
        self.streams = [catmull(s, 2.0) for s in STREAMS]
        self.bridges = []
        for s in self.streams:
            prev_on = False
            for (x, z) in s:
                xi, zi = int(x), int(z)
                if 0 <= xi < W and 0 <= zi < H:
                    on = self.road_dist[zi, xi] < 3.6
                    if on and not prev_on:
                        self.bridges.append(self._bridge_at(s, x, z))
                    prev_on = on
                self._disc(x, z, 2.6, skip_road=True)
        for lk in LAKES:
            for zi in range(int(lk["z"] - lk["rz"]), int(lk["z"] + lk["rz"]) + 1):
                for xi in range(int(lk["x"] - lk["rx"]), int(lk["x"] + lk["rx"]) + 1):
                    if ((xi - lk["x"]) / lk["rx"]) ** 2 + ((zi - lk["z"]) / lk["rz"]) ** 2 <= 1 and 0 <= xi < W and 0 <= zi < H:
                        b[zi, xi] = 1
        # town walls
        self.walls = []
        self.props = []
        self._ring(SEMEL, 56, 56, [0, -math.pi / 2, math.pi / 2], "stone")
        self._ring(ELDER, 62, 48, [math.pi, -math.pi / 2, 0], "palisade")
        self._ring(IRON, 46, 40, [math.pi, 0, math.pi / 2, -math.pi / 2], "stone")
        self._ring(SUNH, 50, 40, [math.pi, -math.pi / 2], "palisade")
        self.buildings = SEMEL_BUILDINGS + ELDER_BUILDINGS + IRON_BUILDINGS + SUN_BUILDINGS + WILD_STRUCTS
        for bd in self.buildings:
            self._block_rect(bd["x"], bd["z"], bd["w"], bd["d"])
        self._town_props()
        self._dungeon(random.Random(909))
        self._camps(rnd)
        self.trees, self.rocks, self.bushes, self.grass = [], [], [], []
        self._vegetation(rnd)
        self.spawns = []
        for (m, x, z, r, n) in SPAWNS:
            self.spawns.append(dict(monster=m, x=x, z=z, r=r, n=n))
        self._scatter_spawns()
        self.npc_block()

    # ---------- stamping helpers
    def _stamp_dist(self, pts, width, rad):
        for (x, z) in pts:
            x0, x1 = max(0, int(x - rad)), min(W, int(x + rad) + 1)
            z0, z1 = max(0, int(z - rad)), min(H, int(z + rad) + 1)
            xs = np.arange(x0, x1) + 0.5
            zs = np.arange(z0, z1) + 0.5
            d = np.sqrt((xs[None, :] - x) ** 2 + (zs[:, None] - z) ** 2) - width
            sub = self.road_dist[z0:z1, x0:x1]
            np.minimum(sub, d, out=sub)

    def _disc(self, x, z, r, skip_road=False):
        for zi in range(int(z - r), int(z + r) + 1):
            for xi in range(int(x - r), int(x + r) + 1):
                if 0 <= xi < W and 0 <= zi < H and (xi + 0.5 - x) ** 2 + (zi + 0.5 - z) ** 2 <= r * r:
                    if skip_road and self.road_dist[zi, xi] < 0.6:
                        continue
                    self.blocked[zi, xi] = 1

    def _block_rect(self, x, z, w, d):
        self.blocked[max(0, int(z - d / 2)):int(z + d / 2) + 1, max(0, int(x - w / 2)):int(x + w / 2) + 1] = 1

    def _bridge_at(self, s, x, z):
        i = min(range(len(s)), key=lambda k: (s[k][0] - x) ** 2 + (s[k][1] - z) ** 2)
        a, c = s[max(0, i - 1)], s[min(len(s) - 1, i + 1)]
        ang = math.atan2(c[1] - a[1], c[0] - a[0])
        return dict(x=x, z=z, rot=ang)

    def _ring(self, c, rx, rz, gates, style):
        n = int(2 * math.pi * max(rx, rz) / 2.5)
        for i in range(n):
            a = 2 * math.pi * i / n
            if any(abs(math.atan2(math.sin(a - g), math.cos(a - g))) < 5.5 / max(rx, rz) for g in gates):
                continue
            x, z = c[0] + math.cos(a) * rx, c[1] + math.sin(a) * rz
            a2 = 2 * math.pi * (i + 1) / n
            self.walls.append(dict(x=x, z=z, x2=c[0] + math.cos(a2) * rx, z2=c[1] + math.sin(a2) * rz, style=style))
            self._disc(x, z, 1.3)
        for g in gates:
            self.props.append(dict(kind="gate_" + style, x=c[0] + math.cos(g) * rx, z=c[1] + math.sin(g) * rz, rot=g))

    def _town_props(self):
        P = self.props
        P.append(dict(kind="fountain", x=SEMEL[0], z=SEMEL[1])); self._disc(SEMEL[0], SEMEL[1], 2.8)
        P.append(dict(kind="elder_tree", x=ELDER[0], z=ELDER[1])); self._disc(ELDER[0], ELDER[1], 3.4)
        P.append(dict(kind="fountain", x=IRON[0], z=IRON[1])); self._disc(IRON[0], IRON[1], 2.8)
        P.append(dict(kind="moonwell", x=SUNH[0], z=SUNH[1])); self._disc(SUNH[0], SUNH[1], 1.6)
        for (x, z, k) in [(1246, 186, "anvil"), (1274, 186, "stall"), (1456, 288, "stall"), (1484, 288, "stall"), (1494, 312, "barrels"), (1252, 214, "barrels")]:
            P.append(dict(kind=k, x=x, z=z)); self._disc(x, z, 1.0)
        for t in SAFE_ZONES:
            for sx in (-1, 1):
                for sz in (-1, 1):
                    kind = "lamp" if t["town"] == "semel" else "spirit_lamp"
                    x, z = t["x"] + sx * (t["half"] - 0.5), t["z"] + sz * (t["half"] - 0.5)
                    P.append(dict(kind=kind, x=x, z=z)); self._disc(x, z, 0.5)
        for (x, z, k) in [(76, 186, "stall"), (104, 186, "stall"), (148, 194, "sign"), (88, 140, "sign"), (936, 216, "sign"),
                          (98, 260, "sign"), (382, 232, "sign"), (620, 228, "sign"), (75, 176, "anvil"), (104, 214, "barrels"),
                          (78, 214, "well"), (986, 196, "stall"), (1014, 196, "stall"), (1003, 226, "moonwell"), (110, 200, "lamp"),
                          (130, 202, "lamp"), (960, 204, "spirit_lamp"), (1040, 214, "spirit_lamp"), (518, 60, "cave"),
                          (300, 345, "cave_small"), (560, 150, "standing_ring")]:
            P.append(dict(kind=k, x=x, z=z))
            r = {"stall": 1.2, "anvil": 0.6, "barrels": 0.8, "well": 1.3, "moonwell": 1.6, "cave": 5.0, "sealed_gate": 3.0, "cave_small": 3.0,
                 "sign": 0.3, "lamp": 0.4, "spirit_lamp": 0.4}.get(k, 0)
            if k == "standing_ring":
                for i in range(7):
                    a = i / 7 * 2 * math.pi
                    self._disc(560 + math.cos(a) * 7, 150 + math.sin(a) * 7, 0.9)
            elif r:
                self._disc(x, z, r)

    def _dungeon(self, rnd):
        b = self.blocked
        def carve(x, z, r):
            for zi in range(int(z - r) - 1, int(z + r) + 2):
                for xi in range(int(x - r) - 1, int(x + r) + 2):
                    if OH + 8 < zi < H - 4 and 4 < xi < W - 4 and (xi + 0.5 - x) ** 2 + (zi + 0.5 - z) ** 2 <= r * r:
                        b[zi, xi] = 0
        for rm in DUNGEON_ROOMS:
            ph = rnd.uniform(0, 6.28)
            for i in range(72):
                a = i / 72 * 6.283
                rr = rm["r"] * (1 + 0.14 * math.sin(3 * a + ph) + 0.08 * math.sin(5 * a + ph * 2))
                for f in (0.35, 0.6, 0.85):
                    carve(rm["x"] + math.cos(a) * rr * f, rm["z"] + math.sin(a) * rr * f, rr * 0.28)
            carve(rm["x"], rm["z"], rm["r"] * 0.6)
        for a, c in zip(DUNGEON_ROOMS, DUNGEON_ROOMS[1:]):
            n = int(math.hypot(c["x"] - a["x"], c["z"] - a["z"]) / 0.5)
            nx, nz = -(c["z"] - a["z"]), c["x"] - a["x"]
            ln = math.hypot(nx, nz)
            for i in range(n + 1):
                t = i / n
                off = math.sin(t * math.pi * 2) * 5
                carve(a["x"] + (c["x"] - a["x"]) * t + nx / ln * off, a["z"] + (c["z"] - a["z"]) * t + nz / ln * off, 2.8)
        P = self.props
        for pt in PORTALS:
            P.append(dict(kind="portal", x=pt["x"], z=pt["z"], name=pt["name"]))
        for k, rm in enumerate(DUNGEON_ROOMS):
            for i in range(4):
                a = i * math.pi / 2 + 0.7
                x, z = rm["x"] + math.cos(a) * rm["r"] * 0.72, rm["z"] + math.sin(a) * rm["r"] * 0.72
                if self.walkable(x, z):
                    P.append(dict(kind="brazier", x=x, z=z)); self._disc(x, z, 0.6)
            for i in range(5):
                a, d = rnd.uniform(0, 6.28), rnd.uniform(0.45, 0.8) * rm["r"]
                x, z = rm["x"] + math.cos(a) * d, rm["z"] + math.sin(a) * d
                if self.walkable(x, z):
                    kind = "bones" if i % 2 else "stalagmite"
                    P.append(dict(kind=kind, x=x, z=z, s=round(rnd.uniform(0.7, 1.4), 2)))
                    if kind == "stalagmite":
                        self._disc(x, z, 0.7)
            if rm["name"].startswith("Drowned"):
                for i in range(6):
                    a = i / 6 * 6.283
                    x, z = rm["x"] + math.cos(a) * rm["r"] * 0.5, rm["z"] + math.sin(a) * rm["r"] * 0.5
                    P.append(dict(kind="pillar", x=x, z=z, h=4.5)); self._disc(x, z, 0.7)
            if rm["name"].startswith("Throne"):
                P.append(dict(kind="throne", x=rm["x"] + 13, z=rm["z"])); self._disc(rm["x"] + 13, rm["z"], 2.2)
        self.cave_rocks = []
        for zi in range(OH + 2, H - 2, 2):
            for xi in range(4, W - 4, 2):
                if b[zi, xi] and (not b[zi - 2, xi] or not b[zi + 2, xi] or not b[zi, xi - 2] or not b[zi, xi + 2]):
                    self.cave_rocks.append([xi + rnd.uniform(-0.4, 0.4), zi + rnd.uniform(-0.4, 0.4), round(rnd.uniform(1.0, 2.0), 2)])

    def _camps(self, rnd):
        camps = [(455, 255, "goblin"), (600, 322, "bandit"), (800, 122, "orc"), (762, 300, "cultist"), (962, 68, "troll")]
        for (cx, cz, k) in camps:
            self.props.append(dict(kind="campfire", x=cx, z=cz, style=k)); self._disc(cx, cz, 1.0)
            for i in range(4 if k != "troll" else 0):
                a = i * math.pi / 2 + 0.6
                x, z = cx + math.cos(a) * 8, cz + math.sin(a) * 8
                if self.road_dist[int(z), int(x)] > 2.5:
                    self.props.append(dict(kind="tent", x=x, z=z, rot=-a, style=k)); self._disc(x, z, 1.8)
            if k == "cultist":
                for i in range(6):
                    a = i / 6 * 2 * math.pi
                    self.props.append(dict(kind="obelisk", x=cx + math.cos(a) * 12, z=cz + math.sin(a) * 12)); self._disc(cx + math.cos(a) * 12, cz + math.sin(a) * 12, 0.9)
        # Old Watch ruins: broken walls and pillars
        for (x, z, w, d) in [(388, 100, 14, 1.4), (412, 100, 8, 1.4), (385, 112, 1.4, 12), (416, 120, 1.4, 10), (395, 126, 9, 1.4)]:
            self.props.append(dict(kind="ruin_wall", x=x, z=z, w=w, d=d)); self._block_rect(x, z, w, d)
        for i in range(8):
            x, z = 392 + (i % 4) * 6, 108 + (i // 4) * 10
            if rnd.random() < 0.8:
                self.props.append(dict(kind="pillar", x=x, z=z, h=rnd.uniform(1.2, 4.5))); self._disc(x, z, 0.7)

    def _vegetation(self, rnd):
        b = self.blocked
        def town_d(x, z):
            return min(((x - c[0]) / rx) ** 2 + ((z - c[1]) / rz) ** 2 for c, rx, rz in TOWN_RINGS)
        clearings = [(r["x"], r["z"], r["r"] * 0.55) for r in REGIONS[2:]] + [(s[1], s[2], s[3] * 0.7) for s in SPAWNS]
        def ok(x, z, road_gap):
            xi, zi = int(x), int(z)
            if not (4 <= xi < W - 4 and 4 <= zi < OH - 4) or b[zi, xi] or self.road_dist[zi, xi] < road_gap:
                return False
            return True
        n_tree = 0
        for _ in range(11000 * W // 1100):
            x, z = rnd.uniform(3, W - 3), rnd.uniform(3, OH - 3)
            if town_d(x, z) < 1.05:
                continue
            dens = 0.75
            for (cx, cz, cr) in clearings:
                if (x - cx) ** 2 + (z - cz) ** 2 < cr * cr:
                    dens = 0.06
                    break
            edge = min(x, W - x, z, OH - z)
            if edge < 25:
                dens = 1.0
            if rnd.random() > dens or not ok(x, z, 4.0):
                continue
            if x > 820: kind = rnd.choice([0, 0, 2, 2, 0])
            elif 360 < x < 820 and rnd.random() < 0.22: kind = 3
            else: kind = rnd.choice([0, 1, 1, 0, 1])
            s = rnd.uniform(0.8, 1.45)
            self.trees.append([round(x, 1), round(z, 1), kind, round(s, 2), round(rnd.uniform(0, 6.28), 2)])
            b[int(z), int(x)] = 1
            if s > 1.25:
                self._disc(x, z, 0.9)
            n_tree += 1
        for _ in range(1100 * W // 1100):
            x, z = rnd.uniform(5, W - 5), rnd.uniform(5, OH - 5)
            if town_d(x, z) < 1.1 or not ok(x, z, 3.0):
                continue
            big = rnd.random() < 0.25 or (x > 900 and z < 120)
            s = rnd.uniform(1.6, 3.4) if big else rnd.uniform(0.4, 1.0)
            self.rocks.append([round(x, 1), round(z, 1), round(s, 2), round(rnd.uniform(0, 6.28), 2)])
            if s > 0.6:
                self._disc(x, z, s * 0.75)
        for _ in range(9000 * W // 1100):
            x, z = rnd.uniform(4, W - 4), rnd.uniform(4, OH - 4)
            if town_d(x, z) < 0.9 or not ok(x, z, 1.5):
                continue
            self.bushes.append([round(x, 1), round(z, 1), round(rnd.uniform(0.6, 1.4), 2), 1 if x > 820 else 0])
        for _ in range(16000 * W // 1100):
            x, z = rnd.uniform(4, W - 4), rnd.uniform(4, OH - 4)
            if not ok(x, z, 0.8) or any(abs(x - t["x"]) < 23 and abs(z - t["z"]) < 23 for t in SAFE_ZONES):
                continue
            self.grass.append([round(x, 1), round(z, 1), round(rnd.uniform(0.6, 1.3), 2)])

    def npc_block(self):
        from game_data import NPCS
        for n in NPCS.values():
            if not n.get("ambient"):
                self._disc(n["pos"][0], n["pos"][1], 0.4)

    # ---------- queries
    def walkable(self, x, z):
        xi, zi = int(x), int(z)
        return 0 <= xi < W and 0 <= zi < H and not self.blocked[zi, xi]

    def nearest_walkable(self, x, z, maxr=6):
        if self.walkable(x, z):
            return x, z
        for r in range(1, maxr + 1):
            for a in range(0, 360, 20):
                nx, nz = x + math.cos(math.radians(a)) * r, z + math.sin(math.radians(a)) * r
                if self.walkable(nx, nz):
                    return nx, nz
        return None

    def los(self, x0, z0, x1, z1):
        d = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(d / 0.4))
        for i in range(1, n + 1):
            t = i / n
            if not self.walkable(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t):
                return False
        return True

    def find_path(self, sx, sz, tx, tz, limit=25000, avoid_safe=False):
        t = self.nearest_walkable(tx, tz)
        if not t:
            return None
        tx, tz = t
        if self.los(sx, sz, tx, tz) and not avoid_safe:
            return [(tx, tz)]
        start, goal = (int(sx), int(sz)), (int(tx), int(tz))
        openh = [(0, start)]
        g = {start: 0}
        came = {}
        n = 0
        b = self.blocked
        found = False
        while openh and n < limit:
            _, cur = heapq.heappop(openh)
            if cur == goal:
                found = True
                break
            n += 1
            cx, cz = cur
            for dx, dz, c in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)):
                nx, nz = cx + dx, cz + dz
                if not (0 <= nx < W and 0 <= nz < H) or b[nz, nx]:
                    continue
                if dx and dz and (b[cz, nx] or b[nz, cx]):
                    continue
                if avoid_safe and in_safe(nx + 0.5, nz + 0.5):
                    continue
                ng = g[cur] + c
                if ng < g.get((nx, nz), 1e9):
                    g[(nx, nz)] = ng
                    came[(nx, nz)] = cur
                    hx, hz = abs(nx - goal[0]), abs(nz - goal[1])
                    heapq.heappush(openh, (ng + max(hx, hz) + 0.414 * min(hx, hz), (nx, nz)))
        if not found:
            return None
        cells = [goal]
        while cells[-1] in came:
            cells.append(came[cells[-1]])
        cells.reverse()
        pts = [(c[0] + 0.5, c[1] + 0.5) for c in cells]
        pts[-1] = (tx, tz)
        out, anchor = [], (sx, sz)
        i = 0
        while i < len(pts) - 1:
            j = len(pts) - 1
            while j > i + 1 and not self.los(anchor[0], anchor[1], pts[j][0], pts[j][1]):
                j -= 1
            out.append(pts[j]); anchor = pts[j]; i = j
        return out or [(tx, tz)]

    def _scatter_spawns(self):
        rnd = random.Random(4242)
        def band(x):
            for lim, opts in SCATTER_BANDS:
                if x < lim:
                    return rnd.choice(opts)
        def ok(x, z):
            if not (5 < x < W - 5 and 5 < z < OH - 5) or not self.walkable(x, z):
                return False
            if any(math.hypot(x - c[0], z - c[1]) < rx - 6 for c, rx, rz in TOWN_RINGS):
                return False
            return all(math.hypot(x - s["x"], z - s["z"]) > s["r"] + 14 for s in self.spawns)
        road = self.main_road
        for i in range(0, len(road), 16):
            x, z = road[i]
            side = 1 if (i // 16) % 2 else -1
            px, pz = x + rnd.uniform(-6, 6), z + side * rnd.uniform(12, 22)
            if ok(px, pz):
                self.spawns.append(dict(monster=band(px), x=px, z=pz, r=10, n=3))
        for gx in range(30, W, 60):
            for gz in range(30, OH, 60):
                px, pz = gx + rnd.uniform(-18, 18), gz + rnd.uniform(-18, 18)
                if ok(px, pz):
                    self.spawns.append(dict(monster=band(px), x=px, z=pz, r=12, n=3))

    def random_point(self, x, z, r, rnd):
        for _ in range(40):
            a, d = rnd.uniform(0, 6.283), rnd.uniform(0, r)
            px, pz = x + math.cos(a) * d, z + math.sin(a) * d
            if self.walkable(px, pz) and not in_safe(px, pz):
                return px, pz
        return x, z

    def client_payload(self):
        bits = np.packbits(self.blocked.flatten())
        return dict(w=W, h=H, grid=base64.b64encode(bits.tobytes()).decode(), main_road=[[round(a, 1), round(b, 1)] for a, b in self.main_road],
                    paths=[dict(w=p["w"], hidden=p["hidden"], pts=[[round(a, 1), round(b, 1)] for a, b in p["pts"]]) for p in self.paths],
                    streams=[[[round(a, 1), round(b, 1)] for a, b in s] for s in self.streams], bridges=self.bridges, lakes=LAKES,
                    walls=self.walls, buildings=self.buildings, props=self.props, trees=self.trees, rocks=self.rocks, bushes=self.bushes,
                    grass=self.grass, regions=REGIONS + DUNGEON_ROOMS, safe_zones=SAFE_ZONES, oh=OH, cave_rocks=self.cave_rocks,
                    portals=[dict(x=p['x'], z=p['z'], name=p['name']) for p in PORTALS], towns=dict(semel=SEMEL, elderglen=ELDER, ironhold=IRON, sunhollow=SUNH))
