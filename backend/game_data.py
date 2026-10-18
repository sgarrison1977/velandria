"""Static, configurable game definitions for Velandria (balance lives here)."""
import math

MAX_LEVEL = 100
INV_SLOTS = 30
STORAGE_SLOTS = 100
TICK = 0.1
PLAYER_SPEED = 5.0
PICKUP_RANGE = 1.8
NPC_RANGE = 5.0
LOOT_OWNER_SECS = 25
LOOT_EXPIRE_SECS = 60

COMBAT = dict(
    crit_base=0.05, crit_per_dex=0.003, crit_mult=1.6,
    hit_base=0.9, hit_per_level=0.03, evade_per_dex=0.002, hit_min=0.6, hit_max=0.98,
    armor_k=40, armor_k_per_level=5,
    hp_regen_base=0.4, hp_regen_per_sta=0.06, mp_regen_base=0.5, mp_regen_per_wis=0.09,
    safe_regen_mult=4.0, levelup_restore=0.5,
)


def _xp_table():
    t = [0, 0, 200, 1000]  # cumulative lifetime XP to REACH level index
    for lv in range(4, MAX_LEVEL + 1):
        n = lv - 3
        t.append(t[-1] + int(900 + 520 * n ** 1.55 + 18 * n ** 2.3))
    return t


XP_TABLE = _xp_table()

CLASSES = {
    "warrior": dict(name="Warrior", attrs=dict(str=9, sta=8, wis=3, int=3, dex=5), weapon="rusty_sword", offhand="wooden_shield",
                    range=2.4, start_abilities=[], desc="Steel and grit. Fights at arm's length, shrugs off blows."),
    "ranger": dict(name="Ranger", attrs=dict(str=5, sta=6, wis=4, int=3, dex=10), weapon="hunting_bow", offhand=None,
                   range=14.0, start_abilities=[], desc="Swift hunter of the deep woods. Strikes before the foe arrives."),
    "wizard": dict(name="Wizard", attrs=dict(str=3, sta=5, wis=8, int=9, dex=3), weapon="oak_staff", offhand=None,
                   range=11.0, start_abilities=["agredi"], desc="Master of pure arcane energy. Beams, blasts and blinks."),
    "warlock": dict(name="Warlock", attrs=dict(str=3, sta=6, wis=7, int=9, dex=3), weapon="oak_staff", offhand=None,
                    range=11.0, start_abilities=["agredi"], desc="Wields fire, poison and rot. Watches foes wither."),
}

ATTR_INFO = {
    "str": "Strength: +0.5 physical melee damage per point.",
    "sta": "Stamina: +6 maximum health and +0.06 health regen per point.",
    "wis": "Wisdom: +6 maximum mana, +0.09 mana regen and stronger heals.",
    "int": "Intelligence: +0.6 spell damage per point and stronger spells.",
    "dex": "Dexterity: faster attacks, +0.3% crit, evasion, and ranged damage.",
}

ALL_CLS, CASTERS, CHARGE_SECS = ["warrior", "ranger", "wizard", "warlock"], ["wizard", "warlock"], 300
ABILITIES = {
    "agredi": dict(name="Agredi", cls=CASTERS, level=1, cost=5, cd=0, range=14, kind="spell", base=8, scale=1.2,
                   desc="Magic projectile: 8 + 120% Intelligence damage."),
    "minor_mederi": dict(name="Minor Mederi", cls=ALL_CLS, level=2, cost=12, cd=0, kind="heal", base=25, scale=1.5,
                         desc="Heal yourself for 25 + 150% Wisdom health."),
    "minor_sanatio": dict(name="Minor Sanatio", cls=ALL_CLS, level=2, cost=8, cd=0, kind="cure",
                          desc="Cure poison: purge every poison from your body."),
    "double_stab": dict(name="Double Stab", cls=["warrior"], level=2, cost=8, cd=0, range=2.6, kind="melee", hits=2, gap=0.15, mult=1.05, flat=2,
                        desc="Stab your target twice in a flash, each for 105% weapon damage +2."),
    "attack_run": dict(name="Attack Run", cls=["warrior", "ranger"], level=3, cost=12, cd=0, range=16, kind="dash", mult=1.6, flat=4,
                       desc="Rush up to 16m to your target and strike for 160% weapon damage +4. With no enemy under the pointer, sprint toward the pointer instead."),
    "multi_shot": dict(name="Multi Shot", cls=["ranger"], level=3, cost=20, cd=0, range=16, kind="multi", count=10, mult=1.1, flat=3,
                       desc="Arrows fly in all directions, hitting up to 10 enemies within 16m for 110% weapon damage +3."),
    "arrow_barrage": dict(name="Arrow Barrage", cls=["ranger"], level=3, cost=18, cd=0, range=16, kind="ranged", hits=10, gap=0.08, mult=0.45, flat=1,
                          desc="Fire 10 arrows at your target in rapid succession, each 45% weapon damage +1."),
    "ignis": dict(name="Ignis", cls=CASTERS, level=3, cost=14, cd=0, range=15, kind="spell", base=16, scale=1.7, splash=2.5,
                  desc="Fireball: 16 + 170% Intelligence to the target and half that to enemies within 2.5m."),
    "spin_attack": dict(name="Spin Attack", cls=["warrior"], level=4, cost=16, cd=0, kind="aoe_self", radius=1.9, mult=1.4, flat=4,
                        desc="Spin with your weapon, hitting every enemy within reach of your blade for 140% weapon damage +4."),
    "multi_vis_nex": dict(name="Multi Vis Nex", cls=["wizard"], level=4, cost=24, cd=0, range=14, kind="multi", count=8, base=12, scale=1.1,
                          desc="Energy blast that strikes up to 8 enemies within 14m for 12 + 110% Intelligence each."),
    "radius": dict(name="Radius", cls=["wizard"], level=4, cost=16, cd=0, range=16, kind="spell", fast_cast=True, base=24, scale=2.1,
                   desc="Energy beam: a focused ray dealing 24 + 210% Intelligence to one target."),
    "venenum": dict(name="Venenum", cls=["warlock"], level=4, cost=12, cd=0, range=15, kind="dot", base=5, scale=0.45, stat="int", ticks=8,
                    desc="Poison your target for 5 + 45% Intelligence every second for 8 seconds."),
    "flamma_ventus": dict(name="Flamma Ventus", cls=["warlock"], level=5, cost=22, cd=0, range=10, kind="cone", angle=0.7, base=14, scale=1.3,
                          desc="Flame wind: scorch every enemy in a 10m cone for 14 + 130% Intelligence."),
    "lunae_lumen_nex": dict(name="Lunae Lumen Nex", cls=["warlock"], level=12, cost=26, cd=0, range=16, kind="spell", fast_cast=True, base=38, scale=2.8,
                            desc="Moonlight beam: a searing lance of lunar light strikes one enemy for 38 + 280% Intelligence damage."),
    "glacies_nova": dict(name="Glacies Nova", cls=["wizard"], level=8, cost=26, cd=0, kind="aoe_self", radius=8.0, base=18, scale=1.5, chill=True, dtype="frost",
                         desc="A ring of ice explodes outward, striking every enemy within 8m for 18 + 150% Intelligence and slowing their movement and attacks by 30% for 3 seconds."),
    "fulmen_catena": dict(name="Fulmen Catena", cls=["warlock"], level=8, cost=24, cd=0, range=15, kind="spell", base=26, scale=2.0, chain=4, dtype="lightning",
                          desc="A bolt of lightning strikes your target for 26 + 200% Intelligence, then leaps to up to 4 more enemies within 8m of each other, losing 20% damage per jump."),
    "tabes_viscera": dict(name="Tabes Viscera", cls=["warlock"], level=6, cost=30, cd=0, kind="aoe_self", radius=9.0, base=10, scale=1.0, rot=0.3,
                          desc="A blood-red cloud bursts above every enemy within 9m, rotting their flesh for 10 + 100% Intelligence, then more over 5 seconds."),
    "teuri": dict(name="Teuri", cls=ALL_CLS, level=5, cost=15, cd=0, kind="buff", buff="armor", value=10, per_level=0.8, dur=CHARGE_SECS, charge=True,
                  desc="Charge spell: +10 armor (+0.8 per level) for 5 minutes."),
    "velocitas": dict(name="Velocitas", cls=ALL_CLS, level=5, cost=12, cd=0, kind="buff", buff="speed", value=0.4, dur=CHARGE_SECS, charge=True,
                      desc="Charge spell: move 40% faster for 5 minutes."),
    "robur": dict(name="Robur", cls=ALL_CLS, level=5, cost=15, cd=0, kind="buff", buff="str", value=5, per_level=0.25, dur=CHARGE_SECS, charge=True,
                  desc="Charge spell: +5 Strength (+0.25 per level) for 5 minutes."),
    "contra_visus": dict(name="Contra Visus", cls=ALL_CLS, level=5, cost=20, cd=0, kind="buff", buff="invis", value=1, dur=CHARGE_SECS, charge=True,
                         desc="Charge spell: monsters cannot see or attack you for 5 minutes. Attacking or damaging anything breaks it, as does Stop Action."),
    "pergere_trans": dict(name="Pergere Trans", cls=CASTERS, level=8, cost=15, cd=0, range=12, kind="blink",
                          desc="Teleport up to 12m to the spot under your cursor."),
    "creare_porta": dict(name="Creare Porta", cls=ALL_CLS, level=10, cost=30, cd=0, range=8, kind="portal",
                         desc="Open a portal to one of your marks (type mark0 – mark9 in chat to set). Lasts 10 seconds."),
}

ACTIONS = ["attack_nearest", "stop", "loot_all", "inventory", "character", "skills", "map", "quests", "chat", "menu"] + [f"ability:{a}" for a in ABILITIES]
DEFAULT_BINDS = {"attack_nearest": "Space", "stop": "KeyS", "loot_all": "KeyF", "inventory": "KeyI", "character": "KeyC", "skills": "KeyK",
                 "map": "KeyM", "quests": "KeyL", "chat": "Enter", "menu": "Escape"}


def default_binds(cls):
    b = dict(DEFAULT_BINDS)
    keys = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"]
    abil = [k for k, a in ABILITIES.items() if cls in a["cls"]]
    for i, a in enumerate(abil):
        b[f"ability:{a}"] = keys[i] if i < len(keys) else ""
    return b


def W(name, cls, rarity, dmg, spd, price, lvl=1, magic=False, stats=None, desc="", color="#9aa0a6"):
    return dict(name=name, type="weapon", slot="main", cls=cls, rarity=rarity, dmg=dmg, spd=spd, magic=magic, price=price,
                lvl=lvl, stats=stats or {}, desc=desc, color=color, stack=1)


def A(name, slot, rarity, armor, price, lvl=1, stats=None, desc="", cls=None, color="#6b5a45"):
    return dict(name=name, type="armor", slot=slot, cls=cls, rarity=rarity, armor=armor, price=price, lvl=lvl,
                stats=stats or {}, desc=desc, color=color, stack=1)


def M(name, rarity, price, desc, stack=50):
    return dict(name=name, type="material", rarity=rarity, price=price, desc=desc, stack=stack)


ITEMS = {
    "gold": dict(name="Gold Coins", type="gold", rarity="common", price=1, desc="Shiny coins.", stack=10**9),
    # weapons
    "rusty_sword": W("Rusty Sword", ["warrior"], "common", [3, 6], 1.6, 12, desc="Pitted but serviceable."),
    "iron_sword": W("Iron Sword", ["warrior"], "common", [5, 9], 1.55, 70, 3, desc="Honest Titus iron."),
    "spider_fang_blade": W("Spider-Fang Blade", ["warrior", "ranger"], "uncommon", [6, 10], 1.35, 110, 3, stats={"dex": 2}, desc="Light, wickedly sharp.", color="#c9d6c0"),
    "steel_longsword": W("Steel Longsword", ["warrior"], "uncommon", [9, 15], 1.6, 260, 7, stats={"str": 2}, desc="Elderglen-forged steel."),
    "orc_cleaver": W("Orc Cleaver", ["warrior"], "rare", [14, 22], 1.75, 520, 10, stats={"str": 4, "sta": 2}, desc="Brutal and heavy.", color="#7a5b3a"),
    "troll_maul": W("Troll-Bone Maul", ["warrior"], "epic", [22, 34], 1.9, 1200, 15, stats={"str": 7, "sta": 4, "hp_regen": 3}, desc="Carved from a troll's femur.", color="#d8ccb0"),
    "dawnblade": W("Suminex Dawnblade", ["warrior"], "legendary", [30, 44], 1.4, 4000, 18, stats={"str": 10, "dex": 5, "sta": 5, "life_steal": 2}, desc="Said to hold the first light of the world.", color="#ffd36b"),
    "oak_staff": W("Oak Staff", ["mage"], "common", [3, 5], 1.7, 12, magic=True, stats={"int": 1}, desc="A gnarled oak stave.", color="#7a5a35"),
    "ember_staff": W("Ember Staff", ["mage"], "uncommon", [6, 10], 1.65, 240, 5, magic=True, stats={"int": 3}, desc="Its tip smoulders.", color="#c4502a"),
    "cultist_staff": W("Staff of the Veiled", ["mage"], "rare", [11, 17], 1.6, 600, 10, magic=True, stats={"int": 5, "wis": 3, "mp_regen": 2}, desc="Whispers in the dark.", color="#6b3fa0"),
    "hunting_bow": W("Hunting Bow", ["ranger"], "common", [3, 6], 1.6, 12, desc="Yew and sinew."),
    "longbow": W("Elderglen Longbow", ["ranger"], "uncommon", [7, 12], 1.6, 250, 5, stats={"dex": 2}, desc="Strung with spider silk."),
    "emberstrike_bow": W("Emberstrike Longbow", ["ranger"], "legendary", [14, 22], 1.4, 0, 12, desc="Every arrow loosed from it bursts into flame.", color="#ff7a2a"),
    "bandit_bow": W("Bandit's Recurve", ["ranger"], "rare", [11, 18], 1.45, 560, 9, stats={"dex": 4}, desc="Stolen, many times over."),
    # offhand
    "wooden_shield": A("Wooden Shield", "off", "common", 3, 10, cls=["warrior"], desc="Planks bound with iron."),
    "iron_shield": A("Iron Kite Shield", "off", "uncommon", 8, 180, 4, cls=["warrior"], stats={"sta": 1}),
    "spell_tome": A("Apprentice Tome", "off", "common", 1, 80, 2, cls=["mage"], stats={"int": 2, "wis": 1}, desc="Dog-eared spells."),
    "quiver": A("Fletcher's Quiver", "off", "common", 1, 80, 2, cls=["ranger"], stats={"dex": 2}, desc="Well-fletched arrows."),
    # armor
    "leather_cap": A("Leather Cap", "head", "common", 2, 25, desc="Keeps the rain off."),
    "iron_helm": A("Iron Helm", "head", "uncommon", 5, 160, 5, stats={"sta": 1}, color="#8a8f96"),
    "padded_tunic": A("Padded Tunic", "chest", "common", 4, 40, desc="Quilted wool armor."),
    "chainmail": A("Chainmail Hauberk", "chest", "uncommon", 10, 300, 6, stats={"sta": 2}, color="#8a8f96"),
    "mystic_robe": A("Mystic Robe", "chest", "uncommon", 5, 280, 5, stats={"int": 2, "wis": 2}, color="#3c3a7a"),
    "bandit_leathers": A("Bandit Leathers", "chest", "rare", 9, 450, 8, stats={"dex": 3, "sta": 2}, color="#3e3226"),
    "leather_pants": A("Leather Breeches", "legs", "common", 3, 30),
    "iron_greaves": A("Iron Greaves", "legs", "uncommon", 7, 220, 6, color="#8a8f96"),
    "leather_gloves": A("Leather Gloves", "hands", "common", 1, 20),
    "leather_belt": A("Leather Belt", "belt", "common", 1, 18, stats={"sta": 1}, desc="Holds your trousers up and your nerves together."),
    "studded_belt": A("Studded Belt", "belt", "uncommon", 3, 120, 8, stats={"sta": 2, "str": 2}, color="#2a2a2a"),
    "hunters_sash": A("Hunter's Sash", "belt", "uncommon", 2, 140, 10, stats={"dex": 3, "sta": 1}, color="#4a5a2a"),
    "sorcerers_cord": A("Sorcerer's Cord", "belt", "uncommon", 1, 140, 10, stats={"int": 2, "wis": 2, "mp_regen": 1}, color="#2a2a5a"),
    "warlord_girdle": A("Warlord's Girdle", "belt", "rare", 8, 650, 22, stats={"str": 5, "sta": 5, "hp_regen": 2}, color="#6a4a2a"),
    "titan_girdle": A("Girdle of the Titan", "belt", "epic", 14, 1100, 50, stats={"str": 8, "sta": 10, "dex": 4, "hp_regen": 4, "life_steal": 2}, color="#c9a24e", desc="Forged for a giant, fitted by magic."),
    "troll_hide_gloves": A("Troll-Hide Grips", "hands", "rare", 5, 400, 12, stats={"str": 2, "sta": 2}),
    "leather_boots": A("Leather Boots", "feet", "common", 2, 25),
    "wolf_boots": A("Wolfpelt Boots", "feet", "uncommon", 4, 150, 3, stats={"dex": 1}, color="#7a7268"),
    "ring_vigor": A("Ring of Vigor", "ring", "uncommon", 0, 200, 3, stats={"sta": 3}, desc="Warm to the touch."),
    "ring_focus": A("Ring of Focus", "ring", "uncommon", 0, 200, 3, stats={"int": 2, "wis": 2}),
    "amulet_dawn": A("Amulet of First Dawn", "amulet", "epic", 2, 1500, 12, stats={"str": 3, "sta": 3, "wis": 3, "int": 3, "dex": 3}),
    # high-tier drops with special properties
    "vampiric_blade": W("Vampiric Blade", ["warrior"], "rare", [26, 38], 1.5, 1400, 22, stats={"str": 6, "life_steal": 4}, desc="It drinks what it cuts.", color="#9a1a2a"),
    "soulreaver_blade": W("Soulreaver", ["warrior"], "epic", [44, 64], 1.5, 3200, 40, stats={"str": 12, "sta": 6, "life_steal": 6, "hp_regen": 5}, desc="Souls scream along its edge.", color="#5a2a8a"),
    "doom_blade": W("Doombringer", ["warrior"], "legendary", [80, 112], 1.45, 9000, 60, stats={"str": 24, "sta": 14, "life_steal": 8, "hp_regen": 10}, desc="Forged in the Abyssal Rift.", color="#ff3a1a"),
    "wraith_staff": W("Wraithwood Staff", ["mage"], "rare", [20, 30], 1.6, 1400, 25, magic=True, stats={"int": 10, "mana_steal": 4, "mp_regen": 3}, desc="Cold whispers coil around it.", color="#5affe0"),
    "void_staff": W("Staff of the Void", ["mage"], "epic", [30, 46], 1.55, 3400, 45, magic=True, stats={"int": 18, "wis": 8, "mana_steal": 6, "mp_regen": 6}, desc="It hungers for light.", color="#3a1a6a"),
    "abyss_staff": W("Eye of the Abyss Staff", ["mage"], "legendary", [46, 66], 1.5, 9000, 60, magic=True, stats={"int": 30, "wis": 14, "mana_steal": 8, "mp_regen": 10, "hp_regen": 5}, desc="Something within it is watching.", color="#ff5a1a"),
    "bloodthorn_bow": W("Bloodthorn Bow", ["ranger"], "rare", [24, 36], 1.5, 1400, 22, stats={"dex": 8, "life_steal": 4}, desc="Thorns drink from every wound.", color="#8a1a1a"),
    "stormcaller_bow": W("Stormcaller Bow", ["ranger"], "epic", [42, 60], 1.35, 3300, 42, stats={"dex": 16, "life_steal": 5, "mana_steal": 3}, desc="Thunder follows every shot.", color="#8ab8ff"),
    "heartseeker_bow": W("Heartseeker Bow", ["ranger"], "legendary", [70, 98], 1.3, 9000, 60, stats={"dex": 28, "str": 8, "life_steal": 7, "mana_steal": 4}, desc="It never misses a beating heart.", color="#ff3a6a"),
    "wraithweave_robe": A("Wraithweave Robe", "chest", "epic", 18, 1800, 30, cls=["mage"], stats={"int": 10, "wis": 8, "mp_regen": 4}, color="#1a2a3a"),
    "golemstone_plate": A("Golemstone Plate", "chest", "epic", 50, 2000, 35, cls=["warrior"], stats={"sta": 14, "hp_regen": 6}, color="#7a7468"),
    "broodsilk_cloak": A("Broodsilk Hunter's Garb", "chest", "epic", 28, 1800, 25, cls=["ranger"], stats={"dex": 10, "sta": 6, "life_steal": 2}, color="#3a1440"),
    "dreadknight_helm": A("Dreadknight Helm", "head", "epic", 20, 2200, 45, stats={"sta": 10, "str": 6, "life_steal": 2}, color="#2a2a32"),
    "fiendhide_boots": A("Fiendhide Boots", "feet", "epic", 16, 2400, 55, stats={"dex": 10, "sta": 6, "hp_regen": 4}, color="#5a1010"),
    "ring_vampire": A("Ring of the Vampire", "ring", "epic", 0, 2000, 35, stats={"life_steal": 3, "mana_steal": 3}, desc="Cold, and always thirsty."),
    "dire_fang": M("Dire Wolf Fang", "uncommon", 40, "A fang as long as a dagger."),
    "brood_silk": M("Broodmother Silk", "uncommon", 55, "Shimmering, nearly unbreakable."),
    "wraith_essence": M("Wraith Essence", "rare", 80, "A wisp of trapped spirit."),
    "golem_core": M("Golem Core", "rare", 120, "Still warm with binding magic."),
    "dread_shard": M("Dread Shard", "rare", 160, "A splinter of cursed armor."),
    "fiend_horn": M("Fiend Horn", "epic", 300, "Smoulders faintly. Collectors pay well."),
    "crown_hollow": A("Crown of the Hollow King", "head", "legendary", 30, 15000, 70, stats={"sta": 16, "str": 8, "int": 8, "dex": 8, "wis": 8, "life_steal": 3, "hp_regen": 8, "mp_regen": 6}, desc="Vorgath's crown. It still whispers commands.", color="#c9a24e"),
    # quest-only rewards
    "warden_signet": A("Warden's Signet", "ring", "epic", 4, 1500, 14, stats={"sta": 5, "dex": 4, "hp_regen": 3}, desc="Given only to friends of the Elderglen Wardens."),
    "grove_mantle": A("Mantle of the Elder Grove", "chest", "epic", 34, 3000, 20, stats={"sta": 10, "wis": 8, "int": 6, "hp_regen": 5, "mp_regen": 4}, color="#2f5a3a", desc="Woven from bark of the Elder Tree. It breathes."),
    "heartwood_crown": A("Heartwood Crown", "head", "legendary", 22, 9000, 30, stats={"sta": 12, "str": 6, "int": 6, "dex": 6, "wis": 10, "hp_regen": 8, "mp_regen": 8}, color="#6a8a3a", desc="A living crown. Elderglen's highest honor."),
    "tidecaller_boots": A("Tidecaller Boots", "feet", "epic", 18, 2500, 25, stats={"dex": 10, "sta": 6, "mp_regen": 3}, color="#2a5a7a", desc="Your steps leave brief ripples."),
    "drowned_moon_cloak": A("Cloak of the Drowned Moon", "chest", "legendary", 40, 9000, 32, stats={"sta": 14, "int": 10, "dex": 10, "mana_steal": 3, "mp_regen": 6}, color="#1e3a5a", desc="Pulled from the bottom of Sunmere."),
    "sunhollow_seal": A("Seal of Sunhollow", "ring", "legendary", 6, 9000, 45, stats={"str": 8, "sta": 8, "int": 8, "dex": 8, "wis": 8, "life_steal": 4, "hp_regen": 6}, desc="The village's oath, worn as a ring."),
    "eye_of_sunmere": A("Eye of Sunmere", "amulet", "legendary", 10, 15000, 55, stats={"sta": 16, "int": 12, "str": 12, "dex": 12, "wis": 12, "life_steal": 5, "mana_steal": 5, "hp_regen": 10, "mp_regen": 10}, desc="The lake itself looks out through this stone."),
    # legendary arms (Elderglen - Vaelric)
    "sunforged_blade": W("Sunforged Greatblade", ["warrior"], "legendary", [62, 88], 1.45, 2800, 50, stats={"str": 18, "sta": 10, "dex": 6, "life_steal": 3, "hp_regen": 4}, desc="Quenched in the heart of a dying star.", color="#ffd36b"),
    "starfall_staff": W("Starfall Staff", ["mage"], "legendary", [34, 50], 1.5, 2800, 50, magic=True, stats={"int": 22, "wis": 14, "mana_steal": 3, "mp_regen": 5}, desc="Constellations wheel within its crystal.", color="#8ab8ff"),
    "galeheart_bow": W("Galeheart Longbow", ["ranger"], "legendary", [54, 78], 1.3, 2800, 50, stats={"dex": 20, "str": 6, "sta": 6, "life_steal": 3, "mp_regen": 2}, desc="Its string hums with the north wind.", color="#a8f0c8"),
    "aegis_dawn": A("Aegis of Dawn", "off", "legendary", 28, 1200, 50, cls=["warrior"], stats={"sta": 12, "str": 5}, desc="No blow has ever pierced it."),
    "codex_eternity": A("Codex of Eternity", "off", "legendary", 6, 1200, 50, cls=["mage"], stats={"int": 12, "wis": 10}, desc="Its pages write themselves."),
    "quiver_windrider": A("Windrider Quiver", "off", "legendary", 6, 1200, 50, cls=["ranger"], stats={"dex": 12, "str": 4}, desc="Arrows that never miss their mark."),
    "dragonscale_plate": A("Dragonscale Plate", "chest", "epic", 46, 1600, 50, cls=["warrior"], stats={"sta": 14, "str": 8}, color="#8a3a2a", desc="Scales of the elder wyrm Vhorax."),
    "archmage_vestments": A("Archmage Vestments", "chest", "epic", 20, 1600, 50, cls=["mage"], stats={"int": 14, "wis": 12, "sta": 4}, color="#3a2a8a", desc="Woven from moonlit silk."),
    "shadowstalker_garb": A("Shadowstalker Garb", "chest", "epic", 30, 1600, 50, cls=["ranger"], stats={"dex": 14, "sta": 8}, color="#24302a", desc="Drinks in the light around it."),
    "crown_valor": A("Crown of Valor", "head", "epic", 16, 1000, 50, stats={"sta": 8, "str": 4, "int": 4, "dex": 4}, color="#c9a24e", desc="Worn by the first kings of Titus."),
    "titan_greaves": A("Titan Greaves", "legs", "epic", 24, 1200, 50, stats={"sta": 10, "str": 4, "dex": 4}, color="#9a9aa6"),
    "gauntlets_might": A("Gauntlets of Might", "hands", "epic", 12, 700, 50, stats={"str": 6, "dex": 6, "int": 4}, color="#b0a070"),
    "boots_wind": A("Boots of the Swift Wind", "feet", "epic", 12, 700, 50, stats={"dex": 8, "sta": 4}, color="#7aa0a0"),
    "ring_ancients": A("Ring of the Ancients", "ring", "legendary", 0, 600, 50, stats={"str": 6, "sta": 6, "wis": 6, "int": 6, "dex": 6, "hp_regen": 3, "mp_regen": 3}, desc="Older than the world's name."),
    "amulet_eternity": A("Amulet of Eternity", "amulet", "legendary", 6, 900, 50, stats={"sta": 10, "wis": 8, "int": 8, "str": 6, "dex": 6, "hp_regen": 5, "mp_regen": 5}, desc="Time slows around its wearer."),
    "cultist_amulet": A("Veiled Sigil", "amulet", "rare", 0, 500, 10, stats={"int": 4, "wis": 2}),
    # consumables
    "hp_potion": dict(name="Healing Potion", type="consumable", rarity="common", full="hp", price=30, stack=50, desc="Restores all of your health."),
    "mp_potion": dict(name="Mana Potion", type="consumable", rarity="common", full="mp", price=30, stack=50, desc="Restores all of your mana."),
    "grilled_trout": dict(name="Grilled Trout", type="consumable", rarity="common", full="hp", price=28, stack=50, desc="Fresh off the Saltmere docks. Restores all of your health."),
    "smoked_eel": dict(name="Smoked Eel", type="consumable", rarity="common", full="mp", price=28, stack=50, desc="Oily and strangely invigorating. Restores all of your mana."),
    "salted_cod": dict(name="Salted Cod", type="consumable", rarity="uncommon", heal=600, mana=300, price=45, stack=50, desc="Sailor's rations. Restores 600 health and 300 mana."),
    # materials / vendor goods
    "sea_pearl": M("Sea Pearl", "rare", 120, "Lustrous and cold. Fishmongers pay well for these."),
    "black_pearl": M("Black Pearl", "epic", 650, "A pearl dark as a moonless tide. Worth a fortune."),
    "spider_silk": M("Spider Silk", "common", 2, "Sticky strands. Merchants buy it."),
    "imp_horn": M("Imp Horn", "common", 3, "Curled and faintly warm."),
    "wolf_pelt": M("Wolf Pelt", "common", 6, "Thick grey fur."),
    "goblin_ear": M("Goblin Ear", "common", 7, "Proof of a goblin slain."),
    "bone_dust": M("Bone Dust", "common", 9, "Grave-cold powder."),
    "bandit_insignia": M("Bandit Insignia", "uncommon", 14, "A crude brass badge."),
    "venom_sac": M("Venom Sac", "uncommon", 16, "Handle with care."),
    "orc_tusk": M("Orc Tusk", "uncommon", 22, "Yellowed and chipped."),
    "cultist_sigil": M("Shadow Sigil", "rare", 35, "It seems to absorb light."),
    "troll_hide": M("Troll Hide", "rare", 50, "Regrows slowly even when cut."),
    "grave_iron_crown": dict(name="Grave-Iron Crown", type="quest", rarity="epic", price=0, stack=1, desc="Morvath's rusted crown, still cold with the Barrow King's malice. Gravekeeper Morrow will want to see it."),
    "sexton_key": dict(name="Sexton's Crypt Key", type="quest", rarity="rare", price=0, stack=1, desc="A cold iron key shaped like a grinning skull. It opens a mausoleum in the Titus Gravefields."),
    "sealed_letter": dict(name="Sealed Letter", type="quest", rarity="uncommon", price=0, stack=1, desc="Captain Rhea's letter for Warden Lyra of Elderglen."),
}
for _k, _v in ITEMS.items():
    _v.setdefault("stack", 1)
    _v.setdefault("stats", {})

MONSTERS = {
    "giant_spider": dict(name="Giant Spider", level=1, hp=30, dmg=[2, 4], interval=2.0, speed=2.2, armor=0, aggro=6, range=1.8, xp=10,
                         gold=[1, 4], radius=0.8, leash=22, respawn=12, resist={"phys": 1.0, "magic": 1.0},
                         loot=[("spider_silk", 0.55), ("hp_potion", 0.12), ("leather_gloves", 0.04), ("spider_fang_blade", 0.01)]),
    "imp": dict(name="Imp", level=2, hp=45, dmg=[3, 6], interval=1.3, speed=4.0, armor=2, aggro=9, range=1.6, xp=15, gold=[2, 6],
                radius=0.55, leash=24, respawn=14, resist={"phys": 1.0, "magic": 0.85},
                loot=[("imp_horn", 0.5), ("mp_potion", 0.12), ("leather_cap", 0.05)]),
    "forest_wolf": dict(name="Forest Wolf", level=3, hp=75, dmg=[5, 9], interval=1.5, speed=5.6, armor=4, aggro=12, range=1.9, xp=25,
                        gold=[3, 8], radius=0.8, leash=30, respawn=18, resist={"phys": 1.0, "magic": 1.0},
                        loot=[("wolf_pelt", 0.6), ("wolf_boots", 0.04), ("hp_potion", 0.15)]),
    "goblin_scout": dict(name="Goblin Scout", level=4, hp=100, dmg=[6, 11], interval=1.25, speed=4.6, armor=6, aggro=11, range=1.7, xp=40,
                         gold=[5, 12], radius=0.55, leash=28, respawn=20, resist={"phys": 1.0, "magic": 1.0},
                         loot=[("goblin_ear", 0.6), ("leather_pants", 0.06), ("quiver", 0.03), ("hp_potion", 0.2)]),
    "skeleton": dict(name="Skeleton", level=5, hp=150, dmg=[9, 15], interval=2.2, speed=2.8, armor=12, aggro=10, range=2.0, xp=60,
                     gold=[6, 15], radius=0.6, leash=24, respawn=22, resist={"phys": 0.85, "magic": 1.15},
                     loot=[("bone_dust", 0.6), ("iron_sword", 0.05), ("iron_helm", 0.03), ("ring_focus", 0.015)]),
    "forest_bandit": dict(name="Forest Bandit", level=6, hp=190, dmg=[10, 17], interval=1.6, speed=4.3, armor=14, aggro=12, range=2.0, xp=85,
                          gold=[10, 24], radius=0.6, leash=28, respawn=24, resist={"phys": 1.0, "magic": 1.0},
                          loot=[("bandit_insignia", 0.5), ("bandit_leathers", 0.02), ("bandit_bow", 0.02), ("hp_potion", 0.08)]),
    "venomous_spider": dict(name="Venomous Spider", level=8, hp=230, dmg=[12, 18], interval=1.8, speed=3.8, armor=10, aggro=10, range=2.0, xp=120,
                            gold=[12, 26], radius=1.0, leash=24, respawn=25, poison=[3, 5], resist={"phys": 1.0, "magic": 0.9},
                            loot=[("venom_sac", 0.55), ("spider_silk", 0.5), ("ring_vigor", 0.02), ("hp_potion", 0.1)]),
    "orc_warrior": dict(name="Orc Warrior", level=10, hp=340, dmg=[18, 28], interval=2.0, speed=3.8, armor=22, aggro=12, range=2.2, xp=175,
                        gold=[18, 40], radius=0.75, leash=28, respawn=28, resist={"phys": 0.9, "magic": 1.1},
                        loot=[("orc_tusk", 0.55), ("orc_cleaver", 0.025), ("chainmail", 0.03), ("iron_greaves", 0.03)]),
    "dark_cultist": dict(name="Dark Cultist", level=13, hp=280, dmg=[20, 30], interval=2.4, speed=3.2, armor=8, aggro=14, range=10.0, xp=250,
                         gold=[25, 55], radius=0.55, leash=26, respawn=30, ranged=True, resist={"phys": 1.1, "magic": 0.75},
                         loot=[("cultist_sigil", 0.45), ("cultist_staff", 0.025), ("cultist_amulet", 0.02), ("mp_potion", 0.12)]),
    "forest_troll": dict(name="Forest Troll", level=16, hp=700, dmg=[30, 45], interval=2.8, speed=3.4, armor=30, aggro=12, range=2.8, xp=350,
                         gold=[40, 90], radius=1.3, leash=26, respawn=45, regen=4, resist={"phys": 0.9, "magic": 1.0},
                         loot=[("troll_hide", 0.5), ("troll_maul", 0.02), ("troll_hide_gloves", 0.03), ("amulet_dawn", 0.006), ("dawnblade", 0.002)]),
    "dire_wolf": dict(name="Dire Wolf", level=20, hp=1100, dmg=[40, 58], interval=1.4, speed=6.0, armor=30, aggro=14, range=2.4, xp=520,
                      gold=[0, 0], radius=1.2, leash=30, respawn=40, resist={"phys": 1.0, "magic": 1.0},
                      loot=[("dire_fang", 0.6), ("hp_potion", 0.25), ("bloodthorn_bow", 0.03), ("vampiric_blade", 0.03), ("wolf_boots", 0.1)]),
    "broodmother": dict(name="Broodmother", level=25, hp=1600, dmg=[48, 70], interval=1.9, speed=4.0, armor=28, aggro=12, range=3.0, xp=750,
                        gold=[0, 0], radius=2.0, leash=26, respawn=50, poison=[12, 18], resist={"phys": 1.0, "magic": 0.9},
                        loot=[("brood_silk", 0.6), ("hp_potion", 0.3), ("broodsilk_cloak", 0.04), ("bloodthorn_bow", 0.03), ("wraith_staff", 0.02)]),
    "shadow_wraith": dict(name="Shadow Wraith", level=30, hp=1300, dmg=[34, 50], interval=2.8, speed=3.6, armor=15, aggro=9, range=7.0, xp=1000,
                          gold=[0, 0], radius=0.7, leash=28, respawn=45, ranged=True, resist={"phys": 0.7, "magic": 1.1},
                          loot=[("wraith_essence", 0.55), ("mp_potion", 0.3), ("wraith_staff", 0.04), ("wraithweave_robe", 0.04), ("ring_vampire", 0.01)]),
    "stone_golem": dict(name="Stone Golem", level=38, hp=3200, dmg=[80, 115], interval=3.0, speed=2.8, armor=70, aggro=10, range=3.2, xp=1500,
                        gold=[0, 0], radius=1.6, leash=24, respawn=60, regen=10, resist={"phys": 0.7, "magic": 1.25},
                        loot=[("golem_core", 0.55), ("hp_potion", 0.35), ("golemstone_plate", 0.05), ("ring_vampire", 0.03), ("soulreaver_blade", 0.015)]),
    "death_knight": dict(name="Death Knight", level=48, hp=4200, dmg=[110, 150], interval=1.8, speed=4.4, armor=60, aggro=14, range=2.6, xp=2300,
                         gold=[0, 0], radius=0.8, leash=28, respawn=60, resist={"phys": 0.85, "magic": 0.85},
                         loot=[("dread_shard", 0.55), ("hp_potion", 0.4), ("dreadknight_helm", 0.05), ("soulreaver_blade", 0.03), ("void_staff", 0.03), ("stormcaller_bow", 0.03)]),
    "abyssal_fiend": dict(name="Abyssal Fiend", level=60, hp=7500, dmg=[150, 210], interval=2.2, speed=4.6, armor=70, aggro=16, range=3.4, xp=3800,
                          gold=[0, 0], radius=2.0, leash=28, respawn=90, regen=20, resist={"phys": 0.85, "magic": 0.85},
                          loot=[("fiend_horn", 0.6), ("fiendhide_boots", 0.06), ("doom_blade", 0.012), ("abyss_staff", 0.012), ("heartseeker_bow", 0.012),
                                ("void_staff", 0.04), ("stormcaller_bow", 0.04), ("ring_ancients", 0.03)]),
    "cave_crawler": dict(name="Cave Crawler", level=35, hp=2600, dmg=[70, 95], interval=1.6, speed=4.4, armor=45, aggro=12, range=2.4, xp=1400,
                         gold=[0, 0], radius=1.3, leash=22, respawn=45, poison=[18, 5], resist={"phys": 1.0, "magic": 0.9},
                         loot=[("brood_silk", 0.5), ("hp_potion", 0.3), ("broodsilk_cloak", 0.05), ("bloodthorn_bow", 0.04), ("wraith_staff", 0.04), ("ring_vampire", 0.03)]),
    "crypt_ghoul": dict(name="Crypt Ghoul", level=42, hp=3400, dmg=[90, 125], interval=1.4, speed=4.8, armor=50, aggro=13, range=2.2, xp=1900,
                        gold=[0, 0], radius=0.7, leash=22, respawn=50, resist={"phys": 1.0, "magic": 1.0},
                        loot=[("dread_shard", 0.45), ("hp_potion", 0.35), ("golemstone_plate", 0.04), ("soulreaver_blade", 0.03), ("void_staff", 0.03), ("stormcaller_bow", 0.03)]),
    "bone_colossus": dict(name="Bone Colossus", level=52, hp=6000, dmg=[130, 175], interval=2.6, speed=3.2, armor=85, aggro=12, range=3.4, xp=3000,
                          gold=[0, 0], radius=1.6, leash=22, respawn=70, resist={"phys": 0.75, "magic": 1.2},
                          loot=[("golem_core", 0.5), ("dreadknight_helm", 0.06), ("soulreaver_blade", 0.05), ("void_staff", 0.05), ("stormcaller_bow", 0.05), ("ring_ancients", 0.03)]),
    "hollow_shade": dict(name="Hollow Shade", level=58, hp=4800, dmg=[140, 190], interval=2.0, speed=4.6, armor=30, aggro=16, range=12.0, xp=3500,
                         gold=[0, 0], radius=0.8, leash=24, respawn=60, ranged=True, resist={"phys": 0.7, "magic": 1.0},
                         loot=[("wraith_essence", 0.55), ("mp_potion", 0.4), ("fiendhide_boots", 0.05), ("void_staff", 0.05), ("abyss_staff", 0.01), ("heartseeker_bow", 0.01), ("doom_blade", 0.01)]),
    "hollow_king": dict(name="Vorgath, the Hollow King", level=75, hp=30000, dmg=[220, 300], interval=2.0, speed=4.0, armor=90, aggro=18, range=4.0, xp=40000,
                        gold=[0, 0], gold_mult=10, radius=2.6, leash=30, respawn=600, regen=15, boss=True, slam=dict(every=7, radius=9, mult=1.4),
                        resist={"phys": 0.9, "magic": 0.9},
                        loot=[("crown_hollow", 0.5), ("doom_blade", 0.25), ("abyss_staff", 0.25), ("heartseeker_bow", 0.25), ("ring_ancients", 0.4),
                              ("amulet_eternity", 0.4), ("fiendhide_boots", 0.5), ("dreadknight_helm", 0.5), ("fiend_horn", 1.0), ("hp_potion", 1.0)]),
}

# Proving Pits: fast-respawning copies of regular monsters (optionally level-scaled)
def _pit(base, lvl=None):
    m = {k: (list(v) if isinstance(v, list) else v) for k, v in MONSTERS[base].items()}
    if lvl:
        f = lvl / m["level"]
        m.update(name="Ascended " + m["name"], level=lvl, hp=round(m["hp"] * f ** 1.4), xp=round(m["xp"] * f ** 1.4),
                 dmg=[round(d * f ** 1.1) for d in m["dmg"]], armor=round(m["armor"] * f ** 0.8))
    m.update(respawn=5, base=base, leash=18, boss=False)
    m.pop("slam", None)
    return m


for _b in ["giant_spider", "skeleton", "orc_warrior", "dark_cultist", "forest_troll", "dire_wolf", "broodmother", "shadow_wraith", "cave_crawler",
           "stone_golem", "crypt_ghoul", "death_knight", "bone_colossus", "hollow_shade", "abyssal_fiend"]:
    MONSTERS["pit_" + _b] = _pit(_b)
for _b, _l in [("hollow_shade", 66), ("death_knight", 72), ("abyssal_fiend", 80)]:
    MONSTERS[f"pit_{_b}_{_l}"] = _pit(_b, _l)
_bk = _pit("skeleton", 10)
_bk.update(name="Morvath the Barrow King", hp=_bk["hp"] * 6, xp=_bk["xp"] * 5, dmg=[round(d * 1.4) for d in _bk["dmg"]], boss=True,
           respawn=180, leash=24, model_scale=1.4, radius=round(_bk["radius"] * 1.3, 2), barrow=True)
MONSTERS["barrow_king"] = _bk
PIT_CHAMPION_KILLS = 100
PIT_CHAMPIONS = {1: ("orc_warrior", 18, "Gorrak the Unbroken"), 2: ("forest_troll", 38, "Mossjaw the Devourer"),
                 3: ("death_knight", 62, "Ser Vaelric the Hollow"), 4: ("abyssal_fiend", 88, "Azgharoth, Pit Tyrant")}
for _t, (_b, _l, _n) in PIT_CHAMPIONS.items():
    _c = _pit(_b, _l)
    _c.update(name=_n, hp=_c["hp"] * 8, xp=_c["xp"] * 6, dmg=[round(d * 1.5) for d in _c["dmg"]], armor=round(_c["armor"] * 1.3),
              radius=round(_c["radius"] * 1.4, 2), model_scale=1.45, champion=True, respawn=8, leash=26)
    MONSTERS[f"pit_champion_{_t}"] = _c

# Titus Gravefields (lv 1-15 skeleton hunting ground)
for _k, _l, _n, _x in [("restless_bones", 2, "Restless Bones", {}), ("grave_warden", 9, "Gravewarden Skeleton", {"model_scale": 1.1}),
                       ("crypt_knight", 13, "Cryptbound Knight", {"model_scale": 1.2}), ("sexton_of_bones", 15, "Sexton of Bones", {"model_scale": 1.45})]:
    _c = _pit("skeleton", _l)
    _c.update({"name": _n, "respawn": 35, "leash": 16, **_x})
    if _k == "sexton_of_bones":
        _c.update(hp=_c["hp"] * 4, xp=_c["xp"] * 4, respawn=240, gold_mult=4, loot=_c["loot"] + [("bone_dust", 1.0), ("iron_helm", 0.25), ("steel_longsword", 0.2), ("ring_vigor", 0.15)])
    MONSTERS[_k] = _c

# Offshore Isles: rare level 25-35 sea monsters with richer loot
_ISLE_LOOT = [("sea_pearl", 0.35), ("hp_potion", 0.3), ("black_pearl", 0.03), ("ring_vampire", 0.03), ("broodsilk_cloak", 0.04), ("wraith_staff", 0.03),
              ("bloodthorn_bow", 0.03), ("golemstone_plate", 0.03), ("soulreaver_blade", 0.015)]
for _k, _b, _l, _n, _x in [("reef_crawler", "cave_crawler", 27, "Reefback Crawler", {}), ("drowned_corsair", "skeleton", 30, "Drowned Corsair", {}),
                           ("tidecursed_wraith", "shadow_wraith", 33, "Tidecursed Wraith", {}), ("coral_colossus", "stone_golem", 35, "Coral Colossus", {}),
                           ("captain_blackbrine", "death_knight", 35, "Captain Blackbrine", dict(boss=True, respawn=420, model_scale=1.35))]:
    _c = _pit(_b, _l)
    _c.pop("base")
    _c.update({"name": _n, "respawn": 70, "leash": 20, "isle": True, "loot": list(_ISLE_LOOT), **_x})
    if _x.get("boss"):
        _c.update(hp=_c["hp"] * 6, xp=_c["xp"] * 6, dmg=[round(d * 1.3) for d in _c["dmg"]], gold_mult=6, radius=round(_c["radius"] * 1.3, 2),
                  loot=_ISLE_LOOT + [("black_pearl", 0.5), ("ring_ancients", 0.12), ("dreadknight_helm", 0.25), ("stormcaller_bow", 0.2), ("void_staff", 0.2)])
    MONSTERS[_k] = _c

# Gold scales with monster level: [lo, hi] = GOLD_SCALE * level^GOLD_EXP
GOLD_SCALE, GOLD_EXP = (2.0, 5.0), 1.45
for _m in MONSTERS.values():
    _g = _m.get("gold_mult", 1)
    _m["gold"] = [max(1, round(GOLD_SCALE[0] * _m["level"] ** GOLD_EXP * _g)), max(3, round(GOLD_SCALE[1] * _m["level"] ** GOLD_EXP * _g))]
# Extra loot rolls: higher-level monsters roll their loot table more times
EXTRA_ROLLS = [(10, 1), (25, 2), (45, 3)]
# Level-gated bonus drops every monster can roll
BONUS_LOOT = [(5, "hp_potion", 0.08), (8, "mp_potion", 0.08), (12, "ring_vigor", 0.015), (12, "ring_focus", 0.015),
              (16, "amulet_dawn", 0.004), (20, "ring_vampire", 0.004), (30, "dreadknight_helm", 0.003), (40, "fiendhide_boots", 0.002)]

NPCS = {
    "brannoc": dict(name="Brannoc the Smith", role="Equipment Merchant", town="semel", pos=[78, 191], kind="smith", merchant="semel_arms"),
    "mira": dict(name="Mira Vell", role="General Goods", town="semel", pos=[102, 191], kind="merchant", merchant="semel_goods"),
    "alys": dict(name="Sister Alys", role="Healer", town="semel", pos=[90, 211], kind="healer", healer=True),
    "toman": dict(name="Elder Toman", role="Village Elder", town="semel", pos=[83, 208], kind="elder", quests=["q_spiders", "q_imps"]),
    "morrow": dict(name="Gravekeeper Morrow", role="Keeper of the Gravefields", town="semel", pos=[97, 247], kind="gravekeeper", quests=["q_sexton", "q_barrowking"]),
    "crypt_w": dict(name="Sealed Crypt", role="West Mausoleum", town="graveyard", pos=[270, 586.4], kind="crypt_door", crypt=True, glob=True),
    "crypt_e": dict(name="Sealed Crypt", role="East Mausoleum", town="graveyard", pos=[300, 586.4], kind="crypt_door", crypt=True, glob=True),
    "rhea": dict(name="Captain Rhea", role="Town Guard", town="semel", pos=[101, 206], kind="guard", quests=["q_letter"]),
    "thessaly": dict(name="Thessaly Weaponwright", role="Equipment Merchant", town="elderglen", pos=[990, 199], kind="smith", merchant="elder_arms"),
    "fenn": dict(name="Old Fenn", role="Provisions & Curios", town="elderglen", pos=[1011, 200], kind="merchant", merchant="elder_goods"),
    "orin": dict(name="Druid Orin", role="Healer", town="elderglen", pos=[996, 222], kind="druid", healer=True),
    "vaelric": dict(name="Vaelric the Gilded", role="Legendary Arms", town="elderglen", pos=[1003, 192], kind="gilded", merchant="elder_legend"),
    "lyra": dict(name="Warden Lyra", role="Warden of Elderglen", town="elderglen", pos=[1008, 220], kind="guard", quests=["q_veil", "q_tusks", "q_trolls", "q_wardens_oath"]),
    "durgan": dict(name="Durgan Ironbeard", role="Master Armorer", town="ironhold", pos=[1248, 190], kind="smith", merchant="iron_arms"),
    "brikka": dict(name="Brikka Stonehand", role="Provisions", town="ironhold", pos=[1272, 190], kind="merchant", merchant="iron_goods"),
    "maelis": dict(name="Sister Maelis", role="Healer", town="ironhold", pos=[1254, 211], kind="healer", healer=True),
    "thane": dict(name="Thane Borik", role="Lord of Ironhold", town="ironhold", pos=[1268, 211], kind="guard", quests=["q_steppe", "q_fangs", "q_crags", "q_crag_heart"]),
    "soren": dict(name="Old Captain Soren", role="Provisions & Tackle", town="sunhollow", pos=[1458, 292], kind="merchant", merchant="sun_goods", quests=["q_silk", "q_fenlights", "q_ridge", "q_rift"]),
    "lysandra": dict(name="Lysandra the Enchanter", role="Rings & Talismans", town="sunhollow", pos=[1482, 292], kind="elder", merchant="sun_curios"),
    "fael": dict(name="Druid Fael", role="Healer", town="sunhollow", pos=[1462, 310], kind="druid", healer=True),
    "v6": dict(name="Grimli", role="Ironhold Miner", town="ironhold", pos=[1240, 205], kind="villager", ambient=True),
    "v7": dict(name="Nessa", role="Sunhollow Fisher", town="sunhollow", pos=[1490, 310], kind="villager", ambient=True),
    "trunk_titus": dict(name="Titus Storage Trunk", role="Account Storage", town="semel", pos=[97, 189], kind="trunk", storage=True),
    "trunk_elder": dict(name="Elderglen Storage Trunk", role="Account Storage", town="elderglen", pos=[1006, 224], kind="trunk", storage=True),
    "trunk_iron": dict(name="Ironhold Storage Trunk", role="Account Storage", town="ironhold", pos=[1254, 214], kind="trunk", storage=True),
    "trunk_sun": dict(name="Sunhollow Storage Trunk", role="Account Storage", town="sunhollow", pos=[1466, 312], kind="trunk", storage=True),
    "ws_titus": dict(name="Titus Waystone", role="Waystone · Fast Travel", town="semel", pos=[90, 189], kind="waystone", waystone=True),
    "ws_elder": dict(name="Elderglen Waystone", role="Waystone · Fast Travel", town="elderglen", pos=[1012, 212], kind="waystone", waystone=True),
    "ws_iron": dict(name="Ironhold Waystone", role="Waystone · Fast Travel", town="ironhold", pos=[1261, 213], kind="waystone", waystone=True),
    "ws_sun": dict(name="Sunhollow Waystone", role="Waystone · Fast Travel", town="sunhollow", pos=[1479, 311], kind="waystone", waystone=True),
    # ambient townsfolk
    "v1": dict(name="Hob the Farmer", role="Villager", town="semel", pos=[70, 225], kind="villager", ambient=True),
    "v2": dict(name="Ella", role="Villager", town="semel", pos=[112, 178], kind="villager", ambient=True),
    "v3": dict(name="Tobin", role="Child of Titus", town="semel", pos=[95, 186], kind="child", ambient=True),
    "v4": dict(name="Wren the Weaver", role="Villager", town="elderglen", pos=[985, 230], kind="villager", ambient=True),
    "v5": dict(name="Moss", role="Elderglen Forester", town="elderglen", pos=[1020, 215], kind="villager", ambient=True),
    # Saltmere Harbor + Offshore Isles (global coords)
    "marta": dict(name="Marta Brine", role="Fishmonger", town="harbor", pos=[1070, 577], kind="fishmonger", merchant="harbor_fish", glob=True),
    "coralie": dict(name="Sister Coralie", role="Healer", town="harbor", pos=[1090, 588], kind="healer", healer=True, glob=True),
    "trunk_harbor": dict(name="Saltmere Storage Trunk", role="Account Storage", town="harbor", pos=[1088, 575], kind="trunk", storage=True, glob=True),
    "ws_harbor": dict(name="Saltmere Waystone", role="Waystone · Fast Travel", town="harbor", pos=[1080, 571], kind="waystone", waystone=True, glob=True),
    "odo": dict(name="Ferryman Odo", role="Ferry to the Offshore Isles", town="harbor", pos=[1086, 650], kind="sailor", ferry="isles", glob=True),
    "kell": dict(name="Bosun Kell", role="Ferry to Saltmere Harbor", town="isles", pos=[1003, 771], kind="sailor", ferry="harbor", glob=True),
    "v8": dict(name="Pell", role="Saltmere Fisher", town="harbor", pos=[1076, 600], kind="villager", ambient=True, glob=True),
    "chest_thorns": dict(name="Barnacled Chest", role="Sunken Treasure", town="isles", pos=[1010, 826], kind="chest", chest=34, glob=True),
    "chest_atoll": dict(name="Corsair's Hoard", role="Pirate Treasure", town="isles", pos=[1240, 864], kind="chest", chest=38, glob=True),
    "chest_spire": dict(name="Drowned Reliquary", role="Ancient Treasure", town="isles", pos=[764, 876], kind="chest", chest=36, glob=True),
}
FERRY_COST = 1000
FERRY_DEST = {"isles": (1000.0, 777.0), "harbor": (1080.0, 612.0)}
CHEST_COOLDOWN = 900

MERCHANTS = {
    "semel_arms": dict(name="Brannoc's Forge", stock=[("leather_belt", -1), ("iron_sword", 5), ("oak_staff", -1), ("hunting_bow", -1), ("ember_staff", 2), ("wooden_shield", -1),
                                                      ("spell_tome", 3), ("quiver", 3), ("leather_cap", -1), ("padded_tunic", -1), ("leather_pants", -1),
                                                      ("leather_gloves", -1), ("leather_boots", -1)]),
    "semel_goods": dict(name="Vell's Sundries", stock=[("hp_potion", -1), ("mp_potion", -1)]),
    "elder_arms": dict(name="Thessaly's Armory", stock=[("studded_belt", 4), ("hunters_sash", 3), ("sorcerers_cord", 3), ("steel_longsword", 3), ("longbow", 3), ("ember_staff", 3), ("iron_shield", 4), ("iron_helm", 4),
                                                        ("chainmail", 3), ("mystic_robe", 3), ("iron_greaves", 3), ("wolf_boots", 4), ("ring_vigor", 2),
                                                        ("ring_focus", 2)]),
    "elder_legend": dict(name="Vaelric's Legendary Arms", stock=[("titan_girdle", -1), ("sunforged_blade", -1), ("starfall_staff", -1), ("galeheart_bow", -1), ("aegis_dawn", -1),
                                                               ("codex_eternity", -1), ("quiver_windrider", -1), ("dragonscale_plate", -1), ("archmage_vestments", -1),
                                                               ("shadowstalker_garb", -1), ("crown_valor", -1), ("titan_greaves", -1), ("gauntlets_might", -1),
                                                               ("boots_wind", -1), ("ring_ancients", -1), ("amulet_eternity", -1)]),
    "iron_arms": dict(name="Ironbeard Forge", stock=[("warlord_girdle", 3), ("vampiric_blade", 3), ("bloodthorn_bow", 3), ("wraith_staff", 3), ("golemstone_plate", 2), ("wraithweave_robe", 2),
                                                   ("broodsilk_cloak", 2), ("dreadknight_helm", 2), ("troll_hide_gloves", -1), ("iron_shield", -1), ("iron_greaves", -1), ("chainmail", -1)]),
    "iron_goods": dict(name="Brikka's Stores", stock=[("hp_potion", -1), ("mp_potion", -1)]),
    "sun_goods": dict(name="Soren's Wharf Goods", stock=[("hp_potion", -1), ("mp_potion", -1)]),
    "sun_curios": dict(name="Lysandra's Curios", stock=[("ring_vigor", -1), ("ring_focus", -1), ("ring_vampire", 2), ("cultist_amulet", 3), ("amulet_dawn", 2),
                                                       ("fiendhide_boots", 1), ("soulreaver_blade", 1), ("void_staff", 1), ("stormcaller_bow", 1)]),
    "elder_goods": dict(name="Fenn's Provisions", stock=[("hp_potion", -1), ("mp_potion", -1)]),
    "harbor_fish": dict(name="Brine & Barrel Fishmongers", stock=[("grilled_trout", -1), ("smoked_eel", -1), ("salted_cod", -1), ("hp_potion", -1), ("mp_potion", -1)]),
}
SELL_RATIO = 0.4
RESTOCK_SECS = 300

WAYSTONE_COST = (25, 0.08)  # base gold + gold per meter travelled
QUESTS = {
    "q_veil": dict(name="The Veiled Circle", giver="lyra", turnin="lyra", kind="kill", target="dark_cultist", count=12,
                   reward=dict(xp=6000, gold=800, items=[("hp_potion", 5), ("mp_potion", 5)]),
                   text="Cultists chant in the Veiled Circle south of Elderglen. Their rites sicken the Elder Tree. End twelve of them."),
    "q_tusks": dict(name="Tusks of the Warband", giver="lyra", turnin="lyra", kind="kill_collect", target="orc_warrior", count=10, collect="orc_tusk", collect_count=6,
                    requires="q_veil", reward=dict(xp=9000, gold=1400, items=[("warden_signet", 1)]),
                    text="Orc warbands raid our woodcutters. Bring me six tusks so the Wardens know the warband is broken."),
    "q_trolls": dict(name="The Troll Fells", giver="lyra", turnin="lyra", kind="kill_collect", target="forest_troll", count=8, collect="troll_hide", collect_count=4,
                     requires="q_tusks", reward=dict(xp=16000, gold=2500, items=[("grove_mantle", 1)]),
                     text="Trolls have come down from the Fells. Slay eight and bring four hides: our weavers will make you something worthy."),
    "q_wardens_oath": dict(name="The Warden's Oath", giver="lyra", turnin="lyra", kind="kill_collect", target="shadow_wraith", count=10, collect="wraith_essence", collect_count=5,
                           requires="q_trolls", reward=dict(xp=40000, gold=6000, items=[("heartwood_crown", 1)]),
                           text="Wraiths drift from Ghostlight Fen toward our grove. Destroy ten and bind five essences. Do this, and you are a Warden."),
    "q_silk": dict(name="Silk and Venom", giver="soren", turnin="soren", kind="kill_collect", target="broodmother", count=8, collect="brood_silk", collect_count=5,
                   reward=dict(xp=20000, gold=3000, items=[("tidecaller_boots", 1)]),
                   text="My nets keep tearing. Broodmother silk never does. Clear the Sunken Marsh of eight of them and bring me five bolts of silk."),
    "q_fenlights": dict(name="Lights over the Fen", giver="soren", turnin="soren", kind="kill_collect", target="shadow_wraith", count=12, collect="wraith_essence", collect_count=6,
                        requires="q_silk", reward=dict(xp=32000, gold=5000, items=[("drowned_moon_cloak", 1)]),
                        text="Fishers vanish chasing lights on the fen. Those are wraiths. Put twelve to rest and bring their essence as proof."),
    "q_ridge": dict(name="The Howling Ridge", giver="soren", turnin="soren", kind="kill_collect", target="death_knight", count=8, collect="dread_shard", collect_count=5,
                    requires="q_fenlights", reward=dict(xp=60000, gold=9000, items=[("sunhollow_seal", 1)]),
                    text="Death Knights march the Howling Ridge at night. Break eight of them and bring five dread shards. Sunhollow will owe you its seal."),
    "q_rift": dict(name="Beyond the Rift", giver="soren", turnin="soren", kind="kill_collect", target="abyssal_fiend", count=4, collect="fiend_horn", collect_count=3,
                   requires="q_ridge", reward=dict(xp=120000, gold=20000, items=[("eye_of_sunmere", 1)]),
                   text="Something crawls out of the Abyssal Rift past the ridge. Slay four fiends and bring three horns. I have one last treasure for you."),
    "q_steppe": dict(name="Wolves of the Ashen Steppe", giver="thane", turnin="thane", kind="kill", target="dire_wolf", count=10,
                     reward=dict(xp=12000, gold=1500, items=[("hp_potion", 10)]),
                     text="Dire wolves prowl the Ashen Steppe north of Ironhold and drag off our miners. Slay ten of the beasts."),
    "q_fangs": dict(name="Fangs for the Forge", giver="thane", turnin="thane", kind="kill_collect", target="dire_wolf", count=8, collect="dire_fang", collect_count=6,
                    requires="q_steppe", reward=dict(xp=18000, gold=2500, items=[("vampiric_blade", 1)]),
                    text="Durgan swears dire fangs make the finest blade-steel. Hunt eight more wolves and bring me six fangs."),
    "q_crags": dict(name="Stone That Walks", giver="thane", turnin="thane", kind="kill", target="stone_golem", count=8,
                    requires="q_fangs", reward=dict(xp=35000, gold=5000, items=[("golemstone_plate", 1)]),
                    text="Golems have woken in the Emberfall Crags and block our old mine roads. Shatter eight of them."),
    "q_crag_heart": dict(name="The Heart of Emberfall", giver="thane", turnin="thane", kind="kill_collect", target="stone_golem", count=6, collect="golem_core", collect_count=4,
                         requires="q_crags", reward=dict(xp=60000, gold=10000, items=[("ring_ancients", 1), ("amulet_eternity", 1)]),
                         text="Something binds those golems. Destroy six more and bring me four of their cores. Ironhold will remember you."),
    "q_spiders": dict(name="Silk in the Fields", giver="toman", turnin="toman", kind="kill", target="giant_spider", count=6,
                      reward=dict(xp=150, gold=30, items=[("leather_boots", 1)]),
                      text="Giant spiders have crept into the north fields. Slay six of them, and return to me."),
    "q_imps": dict(name="Horns of Mischief", giver="toman", turnin="toman", kind="kill_collect", target="imp", count=5, collect="imp_horn", collect_count=3,
                   reward=dict(xp=260, gold=50, items=[("hp_potion", 5)]),
                   text="Imps from the southern hollow steal our grain. Slay five and bring me three of their horns."),
    "q_sexton": dict(name="The Sexton's Key", giver="morrow", turnin="morrow", kind="crypt", target="sexton_of_bones", item="sexton_key", count=1,
                     reward=dict(xp=4000, gold=0, items=[]),
                     text="The dead won't rest in the Gravefields south of Titus. The old Sexton walks among them still, and he carries the key to the sealed crypt. Destroy him, take his key, unlock a mausoleum and claim what's inside, then come back to me."),
    "q_barrowking": dict(name="The Barrow King's Hold", giver="morrow", turnin="morrow", kind="kill_collect", target="barrow_king", count=1,
                         collect="grave_iron_crown", collect_count=1, drop=True, requires="q_sexton", reward=dict(xp=8000, gold=2500, items=[], gear=("epic", 15)),
                         text="The Sexton was only a servant. His master is Morvath, the Barrow King, who stirs in the deep halls of the Titus Barrows on the northern shore. End him, bring me his Grave-Iron Crown, and the Gravefields may finally sleep."),
    "q_letter": dict(name="The Road to Elderglen", giver="rhea", turnin="lyra", kind="deliver", item="sealed_letter",
                     reward=dict(xp=600, gold=120, items=[("ring_vigor", 1)]),
                     text="Carry this sealed letter east along the forest road to Warden Lyra in Elderglen. Beware the woods."),
}


def item_public():
    return ITEMS


LOOK_OPTS = dict(
    skin=["#f0c8a8", "#e0b090", "#d0a080", "#c8946e", "#b07a58", "#8a5a3e", "#6a4430", "#4a2e20"],
    hair=["#141414", "#3a2414", "#6a4a2a", "#9a6a3a", "#c8a060", "#e8d8a8", "#cfcfcf", "#8a2a1a", "#c85a2a", "#3a4a6a"],
    hairStyle=["short", "long", "tail", "mohawk", "bald"],
    beardStyle=["none", "stubble", "full"],
    face=["classic", "angular", "round", "narrow"],
    eyes=["#3a4a5a", "#5a3a20", "#2a5a3a", "#4a6a9a", "#7a7a7a", "#8a1010"],
)


RARITY_MULT = dict(common=1, uncommon=1.12, rare=1.28, epic=1.5, legendary=1.8)


def gear_score(equipment):
    total = 0
    for e in (equipment or {}).values():
        it = e and ITEMS.get(e.get("item"))
        if not it:
            continue
        vals = sum(v / 10 if k in ("max_hp", "max_mp") else v for k, v in list(it.get("stats", {}).items()) + list((e.get("props") or {}).items()))
        dmg = (it["dmg"][0] + it["dmg"][1]) * 0.75 if it.get("dmg") else 0
        total += (it.get("lvl", 1) * 2 + vals + it.get("armor", 0) + dmg) * RARITY_MULT.get(it.get("rarity"), 1)
    return round(total)


def clean_look(look):
    if not isinstance(look, dict):
        return None
    out = {k: v for k, v in look.items() if k in LOOK_OPTS and v in LOOK_OPTS[k]}
    return out if len(out) == len(LOOK_OPTS) else None


def public_data():
    return dict(items=ITEMS, monsters={k: {kk: vv for kk, vv in v.items() if kk != "loot"} | {"drops": [i for i, _ in v["loot"]]} for k, v in MONSTERS.items()},
                look_opts=LOOK_OPTS, abilities=ABILITIES, classes=CLASSES, xp_table=XP_TABLE, npcs=NPCS, quests=QUESTS, attr_info=ATTR_INFO,
                actions=ACTIONS, max_level=MAX_LEVEL, inv_slots=INV_SLOTS, sell_ratio=SELL_RATIO,
                merchants={k: dict(name=v["name"]) for k, v in MERCHANTS.items()})


def sell_price(item_id, props=None):
    base = max(1, math.floor(ITEMS[item_id]["price"] * SELL_RATIO)) if ITEMS[item_id]["price"] > 0 else 0
    return round(base * (1 + 0.3 * len(props))) if props and base else base


for _it in ITEMS.values():
    if _it.get("cls") and "mage" in _it["cls"]:
        _it["cls"] = [c for c in _it["cls"] if c != "mage"] + CASTERS

# random item properties: (stat, name prefix, base, per item-level)
AFFIX_POOL = [("str", "Mighty", 2, 0.3), ("sta", "Sturdy", 2, 0.3), ("wis", "Wise", 2, 0.3), ("int", "Arcane", 2, 0.3), ("dex", "Nimble", 2, 0.3),
              ("hp_regen", "Regenerating", 1, 0.12), ("mp_regen", "Mystic", 1, 0.1), ("life_steal", "Vampiric", 1, 0.06),
              ("mana_steal", "Siphoning", 1, 0.05), ("crit", "Keen", 1, 0.08), ("max_hp", "Vital", 10, 2.0), ("max_mp", "Brimming", 8, 1.5),
              ("armor", "Warded", 3, 0.6), ("move_speed", "Swift", 3, 0.1)]
AFFIX_SUFFIX = ["of the Bear", "of the Fox", "of the Owl", "of Embers", "of the Void", "of Ages", "of the Wolf", "of Storms", "of the Moon"]
RANDOM_GEAR_CHANCE = 0.25


def roll_props(item_id, mlvl, rnd, force=False):
    it = ITEMS[item_id]
    if it["type"] not in ("weapon", "armor") or (not force and rnd.random() > 0.35 + min(0.4, mlvl * 0.008)):
        return None, None
    n = rnd.choices([1, 2, 3, 4], [50, 30, 15, 5 + mlvl / 5])[0]
    lv = max(mlvl, it.get("lvl", 1))
    picks = rnd.sample(AFFIX_POOL, n)
    props = {k: max(1, round(base + per * lv * rnd.uniform(0.5, 1.0))) for k, _, base, per in picks}
    name = f"{picks[0][1]} {it['name']}" + (f" {rnd.choice(AFFIX_SUFFIX)}" if n >= 3 else "")
    return props, name


QUEST_ONLY = {i for q in QUESTS.values() for i, _ in q["reward"].get("items", [])}


def random_gear(mlvl, rnd):
    pool = [k for k, it in ITEMS.items() if it["type"] in ("weapon", "armor") and it["price"] > 0 and it["rarity"] != "legendary" and k not in QUEST_ONLY
            and mlvl - 15 <= it.get("lvl", 1) <= mlvl + 3]
    return rnd.choice(pool) if pool else None

ACTIONS += [f"item:{k}" for k, it in ITEMS.items() if it["type"] == "consumable"]
