"""Deterministic world layout + collision grid + pathfinding for Velandria."""
import math, random, base64, heapq
import numpy as np

W, H = 1600, 600
OH = 400
# the hand-authored layout above lives in "local" coords; at load it is placed on a larger island with ocean around it
OX, OZ = 160, 160
OZS = 400  # southern ocean margin (room for the Offshore Isles)
LW, LH, LOH = W, H, OH
GW, GOH = LW + 2 * OX, LOH + OZ + OZS
GH = GOH + (LH - LOH)
OLD_GOH = LOH + 2 * OZ
# Offshore Isles + Saltmere Harbor are authored directly in global coords
ISLES = [dict(name="Isle of Thorns", x=1000.0, z=800.0, r=34.0), dict(name="Wrecker's Atoll", x=1250.0, z=850.0, r=27.0),
         dict(name="Drowned Spire", x=770.0, z=865.0, r=25.0)]
ISLE_BARS = [(0, 1), (0, 2)]
HARBOR = (1080.0, 582.0)
GRAVEYARD = (285.0, 582.0)
GRAVE_HALF = (26, 18)
MAUS = [(GRAVEYARD[0] - 15, GRAVEYARD[1] + 9), (GRAVEYARD[0] + 15, GRAVEYARD[1] + 9)]
HARBOR_R = (44, 28)
HARBOR_ROAD = [(1080, 548), (1090, 520), (1098, 470), (1094, 420), (1098, 372)]
ISLE_LANDING = (1000.0, 776.0)
DOCKS = [dict(x=1080.0, z=630.0, w=4.0, d=46.0), dict(x=1080.0, z=651.0, w=22.0, d=4.0), dict(x=1000.0, z=757.0, w=4.0, d=28.0)]


def _seg(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az
    t = np.clip(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
    return np.hypot(px - ax - t * dx, pz - az - t * dz)


def isle_sd(x, z):
    w = 4 * np.sin(x * 0.09 + z * 0.07) + 2.5 * np.sin(x * 0.21 - z * 0.17 + 1.3)
    d = np.full(np.shape(x), 999.0) if np.ndim(x) else 999.0
    for i in ISLES:
        d = np.minimum(d, np.hypot(x - i["x"], z - i["z"]) - i["r"] + w)
    for a, b in ISLE_BARS:
        A, B = ISLES[a], ISLES[b]
        d = np.minimum(d, _seg(x, z, A["x"], A["z"], B["x"], B["z"]) - 8.0 + w * 0.15)
    return d


def sea(x, z):
    """global-coords signed distance to any shore (negative = land)"""
    return np.minimum(coast(x - OX, z - OZ), isle_sd(x, z))


_SHIFTED = False


def to_global(x, z):
    return (x + OX, z + OZ) if z <= LOH + 20 else (x + OX, z - LOH + GOH)


def coast(u, v):
    """signed distance-ish to the island shore in local coords (negative = land)"""
    qx, qy = np.abs(u - 800) - 870 + 150, np.abs(v - 200) - 270 + 150
    d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - 150
    return d + 26 * np.sin(u * 0.0105 + v * 0.006) + 16 * np.sin(u * 0.023 - v * 0.017 + 1.7) + 8 * np.sin(u * 0.057 + v * 0.049 + 0.6) + 4 * np.sin(u * 0.13 - v * 0.11 + 2.1)
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
PIT_ROOMS = [
    dict(name="Proving Pits Gate", x=902, z=520, r=10, lvl="Grinding"),
    dict(name="Pit I — Initiates", x=955, z=520, r=26, lvl="1-15"),
    dict(name="Pit II — Bloodied", x=1017, z=520, r=26, lvl="15-35"),
    dict(name="Pit III — Veterans", x=1079, z=520, r=26, lvl="35-60"),
    dict(name="Pit IV — Champions", x=1141, z=520, r=26, lvl="60+"),
]
BARROW_ROOMS = [
    dict(name="Barrow Stair", x=58, z=468, r=10, lvl="1-10"),
    dict(name="Hall of Webs", x=98, z=482, r=21, lvl="1-2"),
    dict(name="Gnawing Pits", x=152, z=468, r=22, lvl="2-4"),
    dict(name="Ossuary Crossing", x=200, z=520, r=23, lvl="4-6"),
    dict(name="Bandit Hideaway", x=140, z=548, r=20, lvl="5-7"),
    dict(name="Venom Grotto", x=84, z=560, r=18, lvl="7-9"),
    dict(name="Hall of the Fallen", x=262, z=468, r=22, lvl="8-10"),
    dict(name="Tomb of the Barrow King", x=300, z=542, r=25, lvl="10 Boss"),
]
BARROW_LINKS = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (3, 6), (6, 7)]
BARROW_ENTRY = (190.0, -22.0)  # north-east of Titus on the northern shore
BARROW_G = (BARROW_ENTRY[0] + 160, BARROW_ENTRY[1] + 160)
DUNGEONS = [dict(name="The Titus Barrows", label="The Titus Barrows — beneath Titus", entry="The Titus Barrows", x0=30, z0=440, w=310, h=140),
            dict(name="The Hollow Deep", label="The Hollow Deep — beneath the cave", entry="Hollow Deep", x0=370, z0=452, w=380, h=138),
            dict(name="The Proving Pits", label="The Proving Pits — grinding halls", entry="The Proving Pits", x0=880, z0=478, w=290, h=84)]
PIT_ENTRY = (722.0, 212.0)
PORTALS = [dict(id="hollow_in", x=518.0, z=57.0, face=(0.0, 1.0), to=(426.0, 550.0), name="Hollow Deep", msg="You descend into the Hollow Deep..."),
           dict(id="hollow_out", x=411.0, z=562.0, to=(518.0, 62.0), name="Exit to the surface", msg="You climb back into the daylight."),
           dict(id="barrow_in", x=BARROW_ENTRY[0], z=BARROW_ENTRY[1], face=(0.0, 1.0), to=(62.0, 468.0), name="The Titus Barrows", msg="You descend the worn stair into the Titus Barrows..."),
           dict(id="barrow_out", x=50.0, z=468.0, to=(BARROW_ENTRY[0], BARROW_ENTRY[1] + 5), name="Exit to the surface", msg="You climb back up into the salt air of the northern shore."),
           dict(id="pits_in", x=PIT_ENTRY[0], z=PIT_ENTRY[1], face=(0.0, 1.0), to=(904.0, 520.0), name="The Proving Pits", msg="You descend into the Proving Pits. The horde never stops coming..."),
           dict(id="pits_out", x=893.0, z=520.0, to=(PIT_ENTRY[0], PIT_ENTRY[1] + 5), name="Exit to the surface", msg="You climb out of the Proving Pits.")]
PIT_TIERS = [(1, ["pit_giant_spider", "pit_skeleton", "pit_orc_warrior", "pit_dark_cultist"]),
             (2, ["pit_forest_troll", "pit_dire_wolf", "pit_broodmother", "pit_shadow_wraith", "pit_cave_crawler"]),
             (3, ["pit_stone_golem", "pit_crypt_ghoul", "pit_death_knight", "pit_bone_colossus", "pit_hollow_shade"]),
             (4, ["pit_abyssal_fiend", "pit_hollow_shade_66", "pit_death_knight_72", "pit_abyssal_fiend_80"])]
SCATTER_BANDS = [(200, ["giant_spider", "imp"]), (330, ["forest_wolf", "imp", "goblin_scout"]), (450, ["goblin_scout", "skeleton", "forest_wolf"]),
                 (600, ["forest_bandit", "venomous_spider", "skeleton"]), (760, ["orc_warrior", "venomous_spider", "forest_bandit"]),
                 (900, ["dark_cultist", "orc_warrior"]), (1120, ["forest_troll", "dark_cultist"]),
                 (1350, ["dire_wolf", "shadow_wraith", "forest_troll"]), (99999, ["broodmother", "stone_golem", "shadow_wraith"])]
TARGET_MONSTERS = 2000
CAMP_COUNT = 36
# open-air castle (global coords): 4x2 rooms, entered from the south gate, snaking to the throne room
CASTLE = dict(name="Castle Vexmoor", x0=1680, z0=160, rw=23, rd=22, t=2, cols=4, rows=4, door=5)
_CR = [("Barbarian Warhall", "castle_barbarian"), ("Berserker Pit", "castle_berserker"), ("Plague Ward", "castle_plague_ghoul"), ("Crossbow Gallery", "castle_crossbowman"),
       ("Arcane Gallery", "castle_battlemage"), ("Ember Sanctum", "castle_pyromancer"), ("Rimeveil Chamber", "castle_frost_witch"), ("Bonechant Crypt", "castle_necromancer"),
       ("Gargoyle Roost", "castle_gargoyle"), ("Golem Foundry", "castle_golem_warden"), ("Hellhound Kennels", "castle_hellhound"), ("Wraith Chapel", "castle_wraith_knight"),
       ("Hall of Knives", "castle_assassin"), ("Executioner's Block", "castle_executioner"), ("Sentinel Hall", "castle_knight"), ("Usurper's Throne", "castle_royal_guard")]
# snake from the south gate (row 3) to the throne (row 0, col 0)
_SN = [(c, 3) for c in range(4)] + [(c, 2) for c in (3, 2, 1, 0)] + [(c, 1) for c in range(4)] + [(c, 0) for c in (3, 2, 1, 0)]
CASTLE_ROOMS = [(c, r, n, m, 4 if i == 15 else 6, f"{65 + i}" if i < 15 else "80 (Boss)") for i, ((c, r), (n, m)) in enumerate(zip(_SN, _CR))]
OUTSKIRT_MOBS = ["giant_spider", "forest_wolf", "imp", "restless_bones", "goblin_scout"]
CAMP_FAMILY = {"giant_spider": "spider", "venomous_spider": "spider", "broodmother": "spider", "imp": "imp", "abyssal_fiend": "imp", "forest_wolf": "beast",
               "dire_wolf": "beast", "goblin_scout": "goblin", "skeleton": "undead", "shadow_wraith": "undead", "death_knight": "undead",
               "forest_bandit": "bandit", "orc_warrior": "orc", "dark_cultist": "cultist", "forest_troll": "troll", "stone_golem": "golem"}
CAMP_NOUN = {"spider": "Nest", "imp": "Pit", "beast": "Den", "goblin": "Warren", "undead": "Boneyard", "bandit": "Hideout", "orc": "Warcamp",
             "cultist": "Coven", "troll": "Lair", "golem": "Circle"}
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
for _ri, _sp in enumerate([[], [("giant_spider", 8), ("imp", 4)], [("imp", 5), ("forest_wolf", 6)], [("goblin_scout", 5), ("skeleton", 6)],
                            [("forest_bandit", 7), ("skeleton", 4)], [("venomous_spider", 8)], [("orc_warrior", 6), ("venomous_spider", 4)], [("barrow_king", 1), ("skeleton", 6)]]):
    _rm = BARROW_ROOMS[_ri]
    for _i, (_t, _n) in enumerate(_sp):
        _off = 0 if _t == "barrow_king" else 9
        SPAWNS.append((_t, _rm["x"] + (_i * 2 - 1) * _off * 0.8, _rm["z"] + (_i % 2 * 2 - 1) * _off * 0.4, _rm["r"] * 0.55, _n))
for _ri, _types in PIT_TIERS:
    _rm = PIT_ROOMS[_ri]
    for _i, _t in enumerate(_types):
        _a = _i / len(_types) * 6.283 + 0.4
        SPAWNS.append((_t, _rm["x"] + math.cos(_a) * 11, _rm["z"] + math.sin(_a) * 11, 8, 20 // len(_types)))


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
        global W, H, OH
        W, H, OH = LW, LH, LOH
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
                if z < OH - 3:
                    self._disc(x, z, 2.6, skip_road=True)
        for lk in LAKES:
            for zi in range(int(lk["z"] - lk["rz"]), int(lk["z"] + lk["rz"]) + 1):
                for xi in range(int(lk["x"] - lk["rx"]), int(lk["x"] + lk["rx"]) + 1):
                    if ((xi - lk["x"]) / lk["rx"]) ** 2 + ((zi - lk["z"]) / lk["rz"]) ** 2 <= 1 and 0 <= xi < W and 0 <= zi < OH:
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
        self.spawns = [dict(monster=m, x=x, z=z, r=r, n=n) for (m, x, z, r, n) in SPAWNS if z > LOH]
        self._globalize(rnd)
        self._harbor()
        self._cave_sites()
        self._graveyard()
        self._castle()
        self._monster_camps()
        from game_data import BOSS_LAIRS
        for k, (x, z) in BOSS_LAIRS.items():
            x, z = self.nearest_walkable(x, z, 12) or (x, z)
            self.spawns.append(dict(monster=k, x=float(x), z=float(z), r=2, n=1))
        self.npc_block()

    def _globalize(self, rnd):
        global W, H, OH
        b, rd = self.blocked, self.road_dist
        b[:3, :] = 0; b[LOH - 3:LOH, :] = 0; b[:LOH, :3] = 0; b[:LOH, -3:] = 0
        nb = np.ones((GH, GW), dtype=np.uint8)
        nr = np.full((GH, GW), 99.0, dtype=np.float32)
        zz, xx = np.mgrid[0:GOH, 0:GW]
        sd = sea(xx + 0.5, zz + 0.5)
        nb[:GOH] = (sd > -3).astype(np.uint8)
        land = nb[OZ:OZ + LOH, OX:OX + LW]
        nb[OZ:OZ + LOH, OX:OX + LW] = np.maximum(land, b[:LOH])
        nb[GOH:, OX:OX + LW] = b[LOH:]
        nr[OZ:OZ + LOH, OX:OX + LW] = rd[:LOH]
        nr[GOH:, OX:OX + LW] = rd[LOH:]
        nb[:3, :] = 1; nb[GOH - 3:GOH, :] = 1; nb[:, :3] = 1; nb[:, -3:] = 1
        self.blocked, self.road_dist = nb, nr
        W, H, OH = GW, GH, GOH
        T = to_global
        pt = lambda p: tuple(T(p[0], p[1]))
        self.main_road = [pt(p) for p in self.main_road]
        for p in self.paths:
            p["pts"] = [pt(q) for q in p["pts"]]
        self.streams = [[pt(q) for q in st] for st in self.streams]
        def dxz(d, kx="x", kz="z"):
            d[kx], d[kz] = T(d[kx], d[kz])
        for d in self.bridges + self.props + self.buildings + self.spawns:
            dxz(d)
        for d in self.walls:
            dxz(d); dxz(d, "x2", "z2")
        for lst in (self.trees, self.rocks, self.bushes, self.grass, self.cave_rocks):
            for v in lst:
                v[0], v[1] = T(v[0], v[1])
        global _SHIFTED
        if not _SHIFTED:
            _SHIFTED = True
            for d in SAFE_ZONES + REGIONS + DUNGEON_ROOMS + PIT_ROOMS + BARROW_ROOMS + LAKES:
                dxz(d)
            for d in PORTALS:
                dxz(d); d["to"] = T(*d["to"])
            for d in DUNGEONS:
                d["x0"], d["z0"] = T(d["x0"], d["z0"])
            from game_data import NPCS
            for n in NPCS.values():
                if not n.get("glob"):
                    n["pos"] = list(T(*n["pos"]))
            SAFE_ZONES.append(dict(town="harbor", x=HARBOR[0], z=HARBOR[1], half=SAFE_HALF))
            REGIONS.append(dict(name="Titus Gravefields", x=GRAVEYARD[0], z=GRAVEYARD[1], r=40, lvl="1-15"))
            SAFE_ZONES.append(dict(town="isles", x=ISLE_LANDING[0], z=ISLE_LANDING[1] + 4, half=7.0, waystone=False))
            REGIONS.extend([dict(name="Saltmere Harbor", x=HARBOR[0], z=HARBOR[1], r=48, lvl="Safe town"),
                            ] +
                           [dict(name=i["name"], x=i["x"], z=i["z"], r=i["r"] + 6, lvl=l) for i, l in zip(ISLES, ["25-30 Offshore", "32-35 (Rare Boss)", "32-35 (Danger)"])])
        dry = lambda x, z, m: sea(x, z) < -m
        self.trees = [t for t in self.trees if t[1] > GOH or dry(t[0], t[1], 6)]
        self.rocks = [t for t in self.rocks if t[1] > GOH or dry(t[0], t[1], 4)]
        self.bushes = [t for t in self.bushes if t[1] > GOH or dry(t[0], t[1], 5)]
        self.grass = [t for t in self.grass if t[1] > GOH or dry(t[0], t[1], 8)]
        # wild growth on the new outer lands
        for _ in range(34000):
            x, z = rnd.uniform(5, GW - 5), rnd.uniform(5, GOH - 5)
            if OX - 4 < x < OX + LW + 4 and OZ - 4 < z < OZ + LOH + 4:
                continue
            c = sea(x, z)
            if c > -14 or nb[int(z), int(x)]:
                continue
            r = rnd.random()
            if r < 0.22 and c < -22:
                self.trees.append([round(x, 1), round(z, 1), rnd.randint(0, 2), round(rnd.uniform(0.8, 1.3), 2), round(rnd.uniform(0, 6.28), 2)])
                self._disc(x, z, 0.6)
            elif r < 0.3:
                self.rocks.append([round(x, 1), round(z, 1), round(rnd.uniform(0.4, 1.4), 2), round(rnd.uniform(0, 6.28), 2)])
            elif r < 0.6:
                self.bushes.append([round(x, 1), round(z, 1), round(rnd.uniform(0.7, 1.3), 2), rnd.randint(0, 2)])
            else:
                self.grass.append([round(x, 1), round(z, 1), round(rnd.uniform(0.7, 1.1), 2)])

    def _monster_camps(self):
        """global: big themed monster camps across the continent + a sprinkling of lone wanderers (~TARGET_MONSTERS total)"""
        from game_data import MONSTERS
        rr = random.Random(5150)
        REGIONS[:] = [r for r in REGIONS if not r.get("camp")]
        towns = [to_global(*c) for c in (SEMEL, ELDER, IRON, SUNH)] + [HARBOR, GRAVEYARD, (self.castle["cx"], self.castle["cz"])]
        caves = [(pt["x"], pt["z"]) for pt in PORTALS if pt.get("face")]
        band = lambda x: next(o for lim, o in SCATTER_BANDS if min(max(x - OX, 0), LW - 1) < lim)
        def land(x, z, m=10):
            return 4 < x < W - 4 and 4 < z < GOH - 4 and sea(x, z) < -m and isle_sd(x, z) > 12 and self.walkable(x, z) and not in_safe(x, z)
        def open_area(x, z, r=9):
            zi, xi = int(z), int(x)
            return self.blocked[zi - r:zi + r, xi - r:xi + r].mean() < 0.1
        camps = []
        def free(x, z, gap):
            return (all(math.hypot(x - a, z - b) > 100 for a, b in towns) and all(math.hypot(x - a, z - b) > 28 for a, b in caves)
                    and all(math.hypot(x - c["x"], z - c["z"]) > gap for c in camps) and self.road_dist[int(z), int(x)] > 7)
        anchors = [(m, *to_global(x, z)) for (m, x, z, r, n) in SPAWNS if z <= LOH and n >= 8]
        for m, x, z in anchors:
            if free(x, z, 45) and land(x, z, 6):
                camps.append(dict(x=x, z=z, primary=m))
        tries = 0
        while len(camps) < CAMP_COUNT and tries < 40000:
            tries += 1
            x, z = rr.uniform(20, W - 20), rr.uniform(20, GOH - 20)
            if land(x, z) and free(x, z, 70) and open_area(x, z):
                camps.append(dict(x=x, z=z, primary=rr.choice(band(x))))
        prefixes = ["Ashen", "Gloom", "Thorn", "Red", "Hollow", "Grim", "Black", "Rot", "Fang", "Iron", "Mire", "Bleak", "Wither", "Raven", "Cinder",
                    "Storm", "Moss", "Stone", "Blood", "Dusk", "Bone", "Gorge", "Shade", "Skull", "Murk", "Briar", "Howl", "Ember", "Frost", "Vile",
                    "Sorrow", "Gnarl", "Scorch", "Gallow", "Sludge", "Rust", "Bramble", "Crow", "Dread", "Fester", "Grave", "Hag", "Knell", "Marrow",
                    "Nettle", "Pyre", "Rattle", "Scar", "Snarl", "Tallow", "Umber", "Venom", "Wolfsbane", "Yew", "Cairn", "Drown", "Feral", "Gore", "Hush", "Lich"]
        rr.shuffle(prefixes)
        total_camp = 0
        for i, c in enumerate(camps):
            x, z, prim = c["x"], c["z"], c["primary"]
            fam = CAMP_FAMILY.get(prim, "beast")
            parts = [(prim, rr.randint(14, 20))]
            for k, (m, cnt) in enumerate(parts):
                if cnt > 0:
                    a = k * 2.1
                    sx, sz = x + math.cos(a) * 2.5, z + math.sin(a) * 2.5
                    if not self.walkable(sx, sz):
                        sx, sz = x, z
                    self.spawns.append(dict(monster=m, x=round(sx, 1), z=round(sz, 1), r=11 if k == 0 else 8, n=cnt))
                    total_camp += cnt
            lv = [MONSTERS[m]["level"] for m, _ in parts]
            name = f"{prefixes[i % len(prefixes)]} {CAMP_NOUN[fam]}" + ("" if i < len(prefixes) else f" {'II' if i < 2 * len(prefixes) else 'III'}")
            REGIONS.append(dict(name=name, x=round(x), z=round(z), r=15, lvl=(f"{min(lv)}-{max(lv)}" if min(lv) != max(lv) else f"{lv[0]}") + " Camp", camp=True))
            self._camp_props(x, z, fam, rr)
        for tx, tz in towns[:5]:
            for k in range(7):
                a = k / 7 * 6.283 + rr.uniform(-0.25, 0.25)
                for d in (82, 92, 104, 118):
                    x, z = tx + math.cos(a) * d, tz + math.sin(a) * d
                    if land(x, z, 8) and all(math.hypot(x - a2, z - b2) > 72 for a2, b2 in towns):
                        self.spawns.append(dict(monster=rr.choice(OUTSKIRT_MOBS), x=round(x, 1), z=round(z, 1), r=10, n=rr.randint(3, 4)))
                        break
        cur = sum(sp["n"] for sp in self.spawns)
        want, tries = max(0, TARGET_MONSTERS - cur), 0
        while want > 0 and tries < 60000:
            tries += 1
            x, z = rr.uniform(20, W - 20), rr.uniform(20, GOH - 20)
            if land(x, z, 8) and all(math.hypot(x - a, z - b) > 80 for a, b in towns) and all(math.hypot(x - cc["x"], z - cc["z"]) > 24 for cc in camps):
                k = 2 if rr.random() < 0.3 else 1
                self.spawns.append(dict(monster=rr.choice(band(x)), x=round(x, 1), z=round(z, 1), r=18, n=k))
                want -= k
        self.camp_count = len(camps)

    def _castle(self):
        C = CASTLE
        x0, z0, rw, rd, t, D = C["x0"], C["z0"], C["rw"], C["rd"], C["t"], C["door"]
        W2, H2 = C["cols"] * (rw + t) + t, C["rows"] * (rd + t) + t
        rx = lambda c: x0 + t + c * (rw + t)
        rz = lambda r: z0 + t + r * (rd + t)
        segs = []
        def hwall(z, xa, xb, gaps):
            cur = xa
            for g in sorted(gaps) + [None]:
                end = xb if g is None else g - D / 2
                if end - cur > 0.5:
                    segs.append([round((cur + end) / 2, 2), z + t / 2, round(end - cur, 2), t])
                if g is not None:
                    cur = g + D / 2
        def vwall(x, za, zb, gaps):
            cur = za
            for g in sorted(gaps) + [None]:
                end = zb if g is None else g - D / 2
                if end - cur > 0.5:
                    segs.append([x + t / 2, round((cur + end) / 2, 2), t, round(end - cur, 2)])
                if g is not None:
                    cur = g + D / 2
        gate = (rx(0) + rw / 2, z0 + H2)
        hwall(z0, x0, x0 + W2, [])
        for r, c in ((1, 3), (2, 0), (3, 3)):
            hwall(rz(r) - t, x0, x0 + W2, [rx(c) + rw / 2])
        hwall(z0 + H2 - t, x0, x0 + W2, [gate[0]])
        for c in range(C["cols"] + 1):
            x = x0 + c * (rw + t)
            vwall(x, z0, z0 + H2, [] if c in (0, C["cols"]) else [rz(r) + rd / 2 for r in range(C["rows"])])
        b = self.blocked
        b[z0 - 3:z0 + H2 + 4, x0 - 3:x0 + W2 + 4] = 0
        for sx, sz, w, d in segs:
            b[int(sz - d / 2):int(sz + d / 2 + 0.999), int(sx - w / 2):int(sx + w / 2 + 0.999)] = 1
        towers = [[x0 + 1, z0 + 1], [x0 + W2 - 1, z0 + 1], [x0 + 1, z0 + H2 - 1], [x0 + W2 - 1, z0 + H2 - 1],
                  [gate[0] - D / 2 - 2, gate[1] - 1], [gate[0] + D / 2 + 2, gate[1] - 1], [x0 + W2 / 2, z0 + 1],
                  [x0 + 1, z0 + H2 / 2], [x0 + W2 - 1, z0 + H2 / 2]]
        for tx, tz in towers:
            self._disc(tx, tz, 3.2)
        inside = lambda v: x0 - 4 < v[0] < x0 + W2 + 4 and z0 - 4 < v[1] < z0 + H2 + 4
        self.trees, self.rocks, self.bushes, self.grass = [[v for v in L if not inside(v)] for L in (self.trees, self.rocks, self.bushes, self.grass)]
        self.props = [p for p in self.props if not inside((p["x"], p["z"]))]
        REGIONS[:] = [r for r in REGIONS if not r.get("castle")]
        REGIONS.append(dict(name="Castle Vexmoor", x=x0 + W2 / 2, z=z0 + H2 / 2, r=62, lvl="65-80 (Castle)", castle=True))
        rooms = []
        for i, (c, r, name, mob, n, lvl) in enumerate(CASTLE_ROOMS):
            cx, cz = rx(c) + rw / 2, rz(r) + rd / 2
            rooms.append(dict(name=name, x=cx, z=cz, w=rw, d=rd, lvl=lvl))
            REGIONS.append(dict(name=name, x=cx, z=cz, r=11, lvl=lvl, castle=True, room=True))
            self.spawns.append(dict(monster=mob, x=cx, z=cz, r=6, n=n, room=i))
            for k in range(4):
                bx, bz = cx + (-1 if k % 2 else 1) * (rw / 2 - 2), cz + (-1 if k < 2 else 1) * (rd / 2 - 2)
                self.props.append(dict(kind="brazier", x=bx, z=bz)); self._disc(bx, bz, 0.6)
            self._castle_furniture(i, cx, cz, rw, rd)
            if mob == "castle_knight":
                for k in range(4):
                    px, pz = cx + (k % 2 * 2 - 1) * 6, cz + (k // 2 * 2 - 1) * 6
                    self.props.append(dict(kind="pillar", x=px, z=pz, h=4.5)); self._disc(px, pz, 0.7)
            if mob == "castle_royal_guard":
                self.props.append(dict(kind="throne", x=cx - rw / 2 + 4, z=cz, rot=1)); self._disc(cx - rw / 2 + 4, cz, 2.2)
                self.spawns.append(dict(monster="vexmoor", x=cx - rw / 2 + 8, z=cz, r=1.5, n=1, room=i))
                self.throne = (cx, cz)
        self.castle = dict(name=C["name"], x0=x0, z0=z0, w=W2, d=H2, cx=x0 + W2 / 2, cz=z0 + H2 / 2, segs=segs, towers=towers, gate=list(gate), rooms=rooms)

    def _castle_furniture(self, i, cx, cz, rw, rd):
        hw, hd = rw / 2 - 1.6, rd / 2 - 1.6
        slot = {"N1": (cx - 5.5, cz - hd, 0), "N2": (cx + 5.5, cz - hd, 0), "S1": (cx - 5.5, cz + hd, math.pi), "S2": (cx + 5.5, cz + hd, math.pi),
                "W1": (cx - hw, cz - 5, math.pi / 2), "W2": (cx - hw, cz + 5, math.pi / 2), "E1": (cx + hw, cz - 5, -math.pi / 2), "E2": (cx + hw, cz + 5, -math.pi / 2)}
        solid = {"table": 1.3, "weapon_rack": 0.9, "armor_stand": 0.7, "bookshelf": 1.1, "candelabra": 0.4, "barrels": 1.2, "crates": 1.0, "anvil": 0.8}
        plan = {0: ("rug:#5a4630", "N1:table", "N2:weapon_rack", "W1:barrels"), 1: ("N1:weapon_rack", "S2:barrels", "C:bones"),
                2: ("N1:crates", "W2:barrels", "C:bones"), 3: ("rug:#3a2a1a", "N1:weapon_rack", "N2:armor_stand"),
                4: ("rug:#1a2a5a", "N1:bookshelf", "N2:bookshelf", "E1:candelabra"), 5: ("rug:#6a1a10", "N1:candelabra", "N2:candelabra", "S1:bookshelf"),
                6: ("rug:#2a4a6a", "N1:bookshelf", "W1:candelabra"), 7: ("N1:bookshelf", "S2:candelabra", "C:bones"), 8: ("W1:crates",),
                9: ("N1:anvil", "N2:crates", "S1:barrels"), 10: ("C:bones", "S1:barrels", "W1:crates"), 11: ("rug:#3a1a4a:12:3", "N1:candelabra", "N2:candelabra"),
                12: ("rug:#2a1a1a", "N1:table", "S2:weapon_rack"), 13: ("N1:weapon_rack", "C:bones"), 14: ("rug:#4a1a1a", "N1:armor_stand", "N2:armor_stand"),
                15: ("rug:#7a1a1a:17:4:2", "N1:candelabra", "S1:candelabra", "N2:table")}
        for item in plan.get(i, ()):
            parts = item.split(":")
            if parts[0] == "rug":
                w, d, ox = (float(parts[2]), float(parts[3]), float(parts[4]) if len(parts) > 4 else 0) if len(parts) > 2 else (8, 5, 0)
                self.props.append(dict(kind="rug", x=cx + ox, z=cz, w=w, d=d, color=parts[1]))
                continue
            k, kind = parts
            x, z, rot = (cx + 3, cz + 4, 0) if k == "C" else slot[k]
            self.props.append(dict(kind=kind, x=x, z=z, rot=rot))
            if kind in solid:
                self._disc(x, z, solid[kind])

    def _camp_props(self, cx, cz, fam, rr):
        P = self.props
        def put(kind, x, z, r, **kw):
            if self.walkable(x, z) and (r == 0 or all(self.walkable(x + dx, z + dz) for dx, dz in ((r, 0), (-r, 0), (0, r), (0, -r)))):
                P.append(dict(kind=kind, x=round(x, 1), z=round(z, 1), **kw))
                if r:
                    self._disc(x, z, r)
                self.grass = [g for g in self.grass if abs(g[0] - x) > 2 or abs(g[1] - z) > 2]
                self.bushes = [g for g in self.bushes if abs(g[0] - x) > 2.5 or abs(g[1] - z) > 2.5]
        ring = lambda n, rad, off=0.0: [(cx + math.cos(i / n * 6.283 + off) * rad, cz + math.sin(i / n * 6.283 + off) * rad, i / n * 6.283 + off) for i in range(n)]
        style = {"goblin": "goblin", "bandit": "bandit", "orc": "orc", "cultist": "cultist", "troll": "troll"}.get(fam)
        if style:
            put("campfire", cx, cz, 1.0, style=style)
            for x, z, a in ring(3 if fam != "troll" else 0, 8, rr.uniform(0, 6)):
                put("tent", x, z, 1.8, rot=-a, style=style)
        if fam == "goblin":
            for x, z, a in ring(2, 5, 0.8): put("totem", x, z, 0.5)
        elif fam == "bandit":
            put("crates", cx + 3.5, cz - 2, 0.9); put("barrels", cx - 3, cz + 3, 0.8)
        elif fam == "orc":
            for x, z, a in ring(3, 5.5, 0.4): put("banner", x, z, 0.4)
        elif fam == "cultist":
            for x, z, a in ring(5, 11): put("obelisk", x, z, 0.9)
        elif fam == "undead":
            put("brazier", cx, cz, 0.6)
            for x, z, a in ring(7, 6.5, rr.uniform(0, 6)): put("grave", x, z, 0.5, rot=-a)
            for x, z, a in ring(4, 3.2, 0.5): put("bones", x, z, 0, s=1.2)
        elif fam == "spider":
            for x, z, a in ring(3, 6, rr.uniform(0, 6)): put("web", x, z, 0, rot=a)
            for x, z, a in ring(4, 3, 0.3): put("bones", x, z, 0, s=1.0)
        elif fam in ("beast", "troll"):
            for x, z, a in ring(5, 3.5 if fam == "beast" else 4.5, 0.2): put("bones", x, z, 0, s=1.3)
            if fam == "beast":
                for x, z, a in ring(4, 9, rr.uniform(0, 6)):
                    if self.walkable(x, z):
                        sc = round(rr.uniform(1.6, 2.4), 2); self.rocks.append([round(x, 1), round(z, 1), sc, round(rr.uniform(0, 6.28), 2)]); self._disc(x, z, sc * 0.75)
        elif fam == "imp":
            for x, z, a in ring(3, 4.5, 0.5): put("brazier", x, z, 0.6)
            for x, z, a in ring(3, 2.5, 1.5): put("bones", x, z, 0)
        elif fam == "golem":
            for x, z, a in ring(6, 8, rr.uniform(0, 6)): put("pillar", x, z, 0.7, h=round(rr.uniform(2.0, 4.5), 1))

    def _graveyard(self):
        """global: Titus Gravefields — iron-fenced graveyard far south of Titus, lv 1-15 skeleton hunting ground"""
        gx, gz = GRAVEYARD
        hx, hz = GRAVE_HALF
        rr = random.Random(1313)
        road = catmull([(250, 418), (258, 468), (276, 520), (gx, gz - hz - 1)], 2.0)
        self.paths.append(dict(w=2.0, hidden=False, pts=road))
        self._stamp_dist(road, 2.0, 8)
        rd = self.road_dist
        inside = lambda x, z, m=0: abs(x - gx) <= hx + m and abs(z - gz) <= hz + m
        def keep(v):
            xi, zi = int(v[0]), int(v[1])
            return not inside(v[0], v[1], 4) and not (0 <= xi < W and 0 <= zi < H and rd[zi, xi] < 3.5)
        self.trees, self.rocks, self.bushes = ([v for v in L if keep(v)] for L in (self.trees, self.rocks, self.bushes))
        self.grass = [v for v in self.grass if keep(v) or (inside(v[0], v[1]) and rr.random() < 0.3)]
        x0, x1, z0, z1 = int(gx - hx - 40), int(gx + hx + 6), 410, int(gz + hz + 6)
        zz, xx = np.mgrid[z0:z1, x0:x1]
        area = ((np.abs(xx + 0.5 - gx) <= hx + 3) & (np.abs(zz + 0.5 - gz) <= hz + 3)) | (rd[z0:z1, x0:x1] < 2.8)
        self.blocked[z0:z1, x0:x1][area & (sea(xx + 0.5, zz + 0.5) < -3)] = 0
        corners = [(gx - hx, gz - hz), (gx + hx, gz - hz), (gx + hx, gz + hz), (gx - hx, gz + hz)]
        for i in range(4):
            (ax, az), (bx, bz) = corners[i], corners[(i + 1) % 4]
            n = int(math.hypot(bx - ax, bz - az) / 3)
            for k in range(n):
                x, z = ax + (bx - ax) * k / n, az + (bz - az) * k / n
                x2, z2 = ax + (bx - ax) * (k + 1) / n, az + (bz - az) * (k + 1) / n
                if i == 0 and abs((x + x2) / 2 - gx) < 4:
                    continue
                self.walls.append(dict(x=x, z=z, x2=x2, z2=z2, style="iron"))
                for t in (0, 0.5, 1):
                    self._disc(x + (x2 - x) * t, z + (z2 - z) * t, 0.7)
        P = self.props
        P.append(dict(kind="gate_iron", x=gx, z=gz - hz, rot=-math.pi / 2))
        P.append(dict(kind="sign", x=gx - 6, z=gz - hz - 3))
        for (mx, mz) in MAUS:
            P.append(dict(kind="mausoleum", x=mx, z=mz, rot=math.pi)); self._block_rect(mx, mz, 9, 7)
        for (x, z) in [(gx - 22, gz - 13), (gx + 21, gz - 12), (gx - 9, gz + 2), (gx + 10, gz - 5), (gx - 23, gz + 4), (gx + 3, gz + 15)]:
            P.append(dict(kind="dead_tree", x=x, z=z, rot=rr.uniform(0, 6.28), s=round(rr.uniform(0.9, 1.4), 2))); self._disc(x, z, 0.6)
        for (x, z) in [(gx - 4, gz - hz + 3), (gx + 4, gz - hz + 3), (gx - 4, gz + 6), (gx + 4, gz + 6)]:
            P.append(dict(kind="brazier", x=x, z=z)); self._disc(x, z, 0.6)
        for z in np.arange(gz - hz + 6, gz + hz - 3, 5.0):
            for x in np.arange(gx - hx + 4, gx + hx - 3, 4.0):
                if abs(x - gx) < 6 or any(abs(x - mx) < 7 and abs(z - mz) < 6 for mx, mz in MAUS) or rr.random() < 0.18:
                    continue
                x2, z2 = x + rr.uniform(-0.6, 0.6), z + rr.uniform(-0.5, 0.5)
                if self.walkable(x2, z2):
                    P.append(dict(kind="grave", x=round(float(x2), 1), z=round(float(z2), 1), rot=round(math.pi / 2 + rr.uniform(-0.15, 0.15), 2))); self._disc(x2, z2, 0.45)
                    if rr.random() < 0.12:
                        P.append(dict(kind="bones", x=round(float(x2) + 1.2, 1), z=round(float(z2) + 0.8, 1), s=0.9))
        for (m, ox, oz, r, n) in [("restless_bones", -12, -11, 8, 8), ("restless_bones", 12, -11, 8, 8), ("skeleton", -13, -2, 8, 8),
                                  ("skeleton", 13, -2, 8, 8), ("grave_warden", -10, 7, 7, 6), ("grave_warden", 10, 7, 7, 6),
                                  ("crypt_knight", -15, 14, 4, 3), ("crypt_knight", 15, 14, 4, 2), ("sexton_of_bones", 0, 13, 3, 1)]:
            x, z = gx + ox, gz + oz
            if not self.walkable(x, z):
                x, z = self.nearest_walkable(x, z) if hasattr(self, "nearest_walkable") else (gx, gz)
            self.spawns.append(dict(monster=m, x=float(x), z=float(z), r=r, n=n, rise=True))

    def _cave_sites(self):
        """global: clear the ground around dungeon cave mouths, block the rock mass, lay the Barrows shore trail"""
        road = catmull([(255, 232), (296, 196), (330, 166), (BARROW_G[0], BARROW_G[1] + 6)], 2.0)
        self.paths.append(dict(w=2.0, hidden=False, pts=road))
        self._stamp_dist(road, 2.0, 8)
        rd = self.road_dist
        sites = [(pt["x"], pt["z"]) for pt in PORTALS if pt.get("face")]
        def keep(v):
            if any(math.hypot(v[0] - x, v[1] - z) < 9 for x, z in sites):
                return False
            xi, zi = int(v[0]), int(v[1])
            return not (0 <= xi < W and 0 <= zi < H and rd[zi, xi] < 3.5)
        self.trees, self.rocks, self.bushes, self.grass = ([v for v in L if keep(v)] for L in (self.trees, self.rocks, self.bushes, self.grass))
        x0, x1, z0, z1 = 240, 365, 120, 240
        zz, xx = np.mgrid[z0:z1, x0:x1]
        near = (rd[z0:z1, x0:x1] < 2.8) | (np.hypot(xx + 0.5 - BARROW_G[0], zz + 0.5 - BARROW_G[1]) < 8)
        self.blocked[z0:z1, x0:x1][near & (sea(xx + 0.5, zz + 0.5) < -3)] = 0
        for pt in PORTALS:
            if pt.get("face"):
                fx, fz = pt["face"]
                self._disc(pt["x"] - fx * 6.5, pt["z"] - fz * 6.5, 4.6)
                for sd in (-1, 1):
                    self._disc(pt["x"] - fx * 2.5 + fz * sd * 3.6, pt["z"] - fz * 2.5 - fx * sd * 3.6, 1.6)

    def _harbor(self):
        """Saltmere Harbor (5th town) and the Offshore Isles, authored in global coords"""
        hx, hz = HARBOR
        rx, rz = HARBOR_R
        road = catmull(HARBOR_ROAD, 2.0)
        self.paths.append(dict(w=2.4, hidden=False, pts=road))
        self._stamp_dist(road, 2.4, 8)
        rd = self.road_dist
        def keep(v):
            x, z = v[0], v[1]
            if ((x - hx) / (rx + 5)) ** 2 + ((z - hz) / (rz + 5)) ** 2 <= 1:
                return False
            xi, zi = int(x), int(z)
            return not (0 <= xi < W and 0 <= zi < H and rd[zi, xi] < 4.5)
        self.trees = [v for v in self.trees if keep(v)]
        self.rocks = [v for v in self.rocks if keep(v)]
        self.bushes = [v for v in self.bushes if keep(v)]
        self.grass = [v for v in self.grass if keep(v)]
        x0, x1, z0, z1 = int(hx - rx - 30), int(hx + rx + 30), 360, int(hz + rz + 8)
        zz, xx = np.mgrid[z0:z1, x0:x1]
        area = ((((xx + 0.5 - hx) / (rx + 3)) ** 2 + ((zz + 0.5 - hz) / (rz + 3)) ** 2) <= 1) | (rd[z0:z1, x0:x1] < 3.4)
        sub = self.blocked[z0:z1, x0:x1]
        sub[area & (sea(xx + 0.5, zz + 0.5) < -3)] = 0
        self._ring(HARBOR, rx, rz, [-math.pi / 2, math.pi / 2], "palisade")
        B = [_rect(1056, 567, 11, 9, "shop", "harbor", town="harbor", name="Brine & Barrel Fishmongers"),
             _rect(1105, 567, 13, 10, "hall", "harbor", town="harbor", name="The Salty Gull"),
             _rect(1055, 598, 9, 8, "house", "harbor", town="harbor", name="Harbormaster's Office"),
             _rect(1106, 599, 8, 8, "house", "harbor", town="harbor"), _rect(1043, 583, 7, 8, "house", "harbor", town="harbor"),
             _rect(1118, 583, 7, 8, "house", "harbor", town="harbor")]
        self.buildings += B
        for bd in B:
            self._block_rect(bd["x"], bd["z"], bd["w"], bd["d"])
        P = self.props
        for (x, z, k, r) in [(hx, hz, "well", 1.3), (1070, 573, "stall", 1.2), (1066, 590, "barrels", 0.8), (1094, 591, "crates", 0.9),
                             (1067, 606, "fish_rack", 1.0), (1094, 606, "fish_rack", 1.0), (1112, 572, "barrels", 0.8), (1086, 616, "crates", 0.9),
                             (1072, 626, "crates", 0), (1088, 644, "barrels", 0)]:
            P.append(dict(kind=k, x=x, z=z))
            if r:
                self._disc(x, z, r)
        for sx in (-1, 1):
            for sz in (-1, 1):
                x, z = hx + sx * (SAFE_HALF - 0.5), hz + sz * (SAFE_HALF - 0.5)
                P.append(dict(kind="lamp", x=x, z=z)); self._disc(x, z, 0.5)
        for (x, z) in [(1077, 612), (1083, 612), (1076, 650), (1084, 650), (996, 744), (1004, 744)]:
            P.append(dict(kind="lamp", x=x, z=z, dock=True))
        for d in DOCKS:
            P.append(dict(kind="dock", **d))
            self.blocked[int(d["z"] - d["d"] / 2):int(d["z"] + d["d"] / 2) + 1, int(d["x"] - d["w"] / 2 + 0.5):int(d["x"] + d["w"] / 2 - 0.5) + 1] = 0
        for (x, z, rot, k) in [(1073, 640, 0.0, "boat"), (1088, 628, 0.15, "boat"), (1080, 659, math.pi / 2, "ferry"), (1066, 662, 0.6, "boat"),
                               (1100, 646, -0.4, "boat"), (1007, 748, 0.0, "ferry")]:
            P.append(dict(kind=k, x=x, z=z, rot=rot))
        rr = random.Random(77)
        for isle in ISLES:
            for _ in range(int(isle["r"] * 2.2)):
                a, dd = rr.uniform(0, 6.283), rr.uniform(0, isle["r"] - 8)
                x, z = isle["x"] + math.cos(a) * dd, isle["z"] + math.sin(a) * dd
                if sea(x, z) > -7 or self.blocked[int(z), int(x)] or math.hypot(x - ISLE_LANDING[0], z - ISLE_LANDING[1]) < 8:
                    continue
                if rr.random() < 0.55:
                    self.trees.append([round(x, 1), round(z, 1), rr.choice([0, 2]), round(rr.uniform(0.8, 1.2), 2), round(rr.uniform(0, 6.28), 2)]); self._disc(x, z, 0.6)
                else:
                    self.bushes.append([round(x, 1), round(z, 1), round(rr.uniform(0.7, 1.3), 2), 1])
        P.append(dict(kind="wreck", x=1262, z=838, rot=0.8)); self._disc(1262, 838, 3.0)
        P.append(dict(kind="wreck", x=760, z=852, rot=-1.1)); self._disc(760, 852, 3.0)
        P.append(dict(kind="sign", x=1078, z=552))
        for (m, x, z, r, n) in [("reef_crawler", 988, 812, 11, 5), ("drowned_corsair", 1016, 806, 10, 5), ("reef_crawler", 1124, 826, 6, 2),
                                ("drowned_corsair", 885, 833, 6, 2), ("drowned_corsair", 1243, 852, 9, 4), ("tidecursed_wraith", 1256, 862, 8, 3),
                                ("captain_blackbrine", 1250, 848, 2, 1), ("tidecursed_wraith", 768, 864, 9, 4), ("coral_colossus", 778, 874, 7, 2)]:
            self.spawns.append(dict(monster=m, x=float(x), z=float(z), r=r, n=n))

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
                          (130, 202, "lamp"), (960, 204, "spirit_lamp"), (1040, 214, "spirit_lamp"),
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
        for rm in DUNGEON_ROOMS + PIT_ROOMS + BARROW_ROOMS:
            ph = rnd.uniform(0, 6.28)
            for i in range(72):
                a = i / 72 * 6.283
                rr = rm["r"] * (1 + 0.14 * math.sin(3 * a + ph) + 0.08 * math.sin(5 * a + ph * 2))
                for f in (0.35, 0.6, 0.85):
                    carve(rm["x"] + math.cos(a) * rr * f, rm["z"] + math.sin(a) * rr * f, rr * 0.28)
            carve(rm["x"], rm["z"], rm["r"] * 0.6)
        for a, c in list(zip(DUNGEON_ROOMS, DUNGEON_ROOMS[1:])) + list(zip(PIT_ROOMS, PIT_ROOMS[1:])) + [(BARROW_ROOMS[i], BARROW_ROOMS[j]) for i, j in BARROW_LINKS]:
            n = int(math.hypot(c["x"] - a["x"], c["z"] - a["z"]) / 0.5)
            nx, nz = -(c["z"] - a["z"]), c["x"] - a["x"]
            ln = math.hypot(nx, nz)
            for i in range(n + 1):
                t = i / n
                off = math.sin(t * math.pi * 2) * 5
                carve(a["x"] + (c["x"] - a["x"]) * t + nx / ln * off, a["z"] + (c["z"] - a["z"]) * t + nz / ln * off, 2.8)
        P = self.props
        for pt in PORTALS:
            P.append(dict(kind="portal", x=pt["x"], z=pt["z"], name=pt["name"], face=pt.get("face")))
        for k, rm in enumerate(DUNGEON_ROOMS + PIT_ROOMS + BARROW_ROOMS):
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
        return dict(ox=OX, oz=OZ, lw=LW, loh=LOH, w=W, h=H, grid=base64.b64encode(bits.tobytes()).decode(), main_road=[[round(a, 1), round(b, 1)] for a, b in self.main_road],
                    paths=[dict(w=p["w"], hidden=p["hidden"], pts=[[round(a, 1), round(b, 1)] for a, b in p["pts"]]) for p in self.paths],
                    streams=[[[round(a, 1), round(b, 1)] for a, b in s] for s in self.streams], bridges=self.bridges, lakes=LAKES,
                    walls=self.walls, buildings=self.buildings, props=self.props, trees=self.trees, rocks=self.rocks, bushes=self.bushes,
                    grass=self.grass, regions=REGIONS + DUNGEON_ROOMS + PIT_ROOMS + BARROW_ROOMS, dungeons=DUNGEONS, safe_zones=SAFE_ZONES, oh=OH, cave_rocks=self.cave_rocks,
                    portals=[dict(x=p['x'], z=p['z'], name=p['name']) for p in PORTALS], isles=ISLES, isle_bars=ISLE_BARS, docks=DOCKS,
                    castle=self.castle,
                    towns={**{k: to_global(*v) for k, v in dict(semel=SEMEL, elderglen=ELDER, ironhold=IRON, sunhollow=SUNH).items()}, "harbor": HARBOR, "graveyard": GRAVEYARD})
