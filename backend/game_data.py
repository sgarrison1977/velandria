"""Static, configurable game definitions for Suminex (balance lives here)."""
import math

MAX_LEVEL = 100
INV_SLOTS = 30
TICK = 0.1
PLAYER_SPEED = 5.0
PICKUP_RANGE = 1.8
NPC_RANGE = 5.0
LOOT_OWNER_SECS = 25
LOOT_EXPIRE_SECS = 150

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
                    range=2.4, start_ability="power_strike", desc="Steel and grit. Fights at arm's length, shrugs off blows."),
    "mage": dict(name="Mage", attrs=dict(str=3, sta=5, wis=8, int=9, dex=3), weapon="oak_staff", offhand=None,
                 range=11.0, start_ability="arcane_bolt", desc="Wields raw arcana from afar. Fragile, devastating."),
    "ranger": dict(name="Ranger", attrs=dict(str=5, sta=6, wis=4, int=3, dex=10), weapon="hunting_bow", offhand=None,
                   range=14.0, start_ability="aimed_shot", desc="Swift hunter of the deep woods. Strikes before the foe arrives."),
}

ATTR_INFO = {
    "str": "Strength: +0.5 physical melee damage per point.",
    "sta": "Stamina: +6 maximum health and +0.06 health regen per point.",
    "wis": "Wisdom: +6 maximum mana, +0.09 mana regen and stronger heals.",
    "int": "Intelligence: +0.6 spell damage per point and stronger spells.",
    "dex": "Dexterity: faster attacks, +0.3% crit, evasion, and ranged damage.",
}

ABILITIES = {
    "power_strike": dict(name="Power Strike", cls="warrior", level=1, cost=8, cd=0, range=2.6, kind="melee", mult=1.9, flat=4,
                         desc="A crushing blow dealing 190% weapon damage +4."),
    "iron_guard": dict(name="Iron Guard", cls="warrior", level=3, cost=15, cd=0, kind="buff", buff="armor", value=25, dur=10,
                       desc="Brace yourself: +25 armor for 10 seconds."),
    "cleave": dict(name="Cleave", cls="warrior", level=5, cost=18, cd=0, kind="aoe_self", radius=4.0, mult=1.3, flat=2,
                   desc="Sweep all enemies within 4m for 130% weapon damage."),
    "arcane_bolt": dict(name="Arcane Bolt", cls="mage", level=1, cost=6, cd=0, range=14, kind="spell", base=8, scale=1.2,
                        desc="Hurl a bolt of arcane force: 8 + 120% Intelligence damage."),
    "flame_burst": dict(name="Flame Burst", cls="mage", level=3, cost=20, cd=0, range=12, kind="aoe_target", radius=4.0, base=12, scale=1.0,
                        desc="Erupt fire at your target, burning everything within 4m."),
    "aimed_shot": dict(name="Aimed Shot", cls="ranger", level=1, cost=7, cd=0, range=16, kind="ranged", mult=1.8, flat=3,
                       desc="A careful shot for 180% weapon damage +3 at long range."),
    "venom_arrow": dict(name="Venom Arrow", cls="ranger", level=4, cost=14, cd=0, range=16, kind="dot", base=6, scale=0.5, ticks=6,
                        desc="Poison the target, dealing damage every second for 6s."),
    "whirlwind": dict(name="Whirlwind", cls="warrior", level=8, cost=25, cd=0, kind="aoe_self", radius=6.0, mult=1.6, flat=6,
                      desc="Spin with your blade, striking every enemy within 6m for 160% weapon damage +6."),
    "earthshatter": dict(name="Earthshatter", cls="warrior", level=12, cost=32, cd=0, range=8, kind="aoe_target", radius=6.0, mult=2.0, flat=8,
                         desc="Slam the ground at your target, hitting all enemies within 6m for 200% weapon damage +8."),
    "frost_nova": dict(name="Frost Nova", cls="mage", level=6, cost=22, cd=0, kind="aoe_self", radius=7.0, base=18, scale=1.3,
                       desc="Blast frost outward, dealing 18 + 130% Intelligence to all enemies within 7m."),
    "meteor_storm": dict(name="Meteor Storm", cls="mage", level=8, cost=35, cd=0, range=16, kind="aoe_target", radius=7.0, base=30, scale=1.8,
                         desc="Call down meteors on your target: 30 + 180% Intelligence to everything within 7m."),
    "volley": dict(name="Volley", cls="ranger", level=6, cost=20, cd=0, range=18, kind="aoe_target", radius=6.0, mult=1.3, flat=4,
                   desc="Rain arrows on your target, hitting all enemies within 6m for 130% weapon damage +4."),
    "multishot": dict(name="Multishot", cls="ranger", level=8, cost=24, cd=0, range=16, kind="multi", count=5, mult=1.2, flat=3,
                      desc="Loose arrows at up to 5 nearby enemies within 16m for 120% weapon damage +3 each."),
    "minor_heal": dict(name="Minor Heal", cls=None, level=2, cost=12, cd=0, kind="heal", base=25, scale=1.5,
                       desc="Restore 25 + 150% Wisdom health to yourself."),
    "quickstep": dict(name="Quickstep", cls=None, level=2, cost=10, cd=0, kind="buff", buff="speed", value=0.5, dur=5,
                      desc="Move 50% faster for 5 seconds."),
}

ACTIONS = ["attack_nearest", "stop", "inventory", "character", "skills", "map", "quests", "chat", "menu"] + [f"ability:{a}" for a in ABILITIES]
DEFAULT_BINDS = {"attack_nearest": "Space", "stop": "KeyS", "inventory": "KeyI", "character": "KeyC", "skills": "KeyK",
                 "map": "KeyM", "quests": "KeyL", "chat": "Enter", "menu": "Escape"}


def default_binds(cls):
    b = dict(DEFAULT_BINDS)
    keys = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"]
    abil = [k for k, a in ABILITIES.items() if a["cls"] == cls] + [k for k, a in ABILITIES.items() if a["cls"] is None]
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
    "troll_maul": W("Troll-Bone Maul", ["warrior"], "epic", [22, 34], 1.9, 1200, 15, stats={"str": 7, "sta": 4}, desc="Carved from a troll's femur.", color="#d8ccb0"),
    "dawnblade": W("Suminex Dawnblade", ["warrior"], "legendary", [30, 44], 1.4, 4000, 18, stats={"str": 10, "dex": 5, "sta": 5}, desc="Said to hold the first light of the world.", color="#ffd36b"),
    "oak_staff": W("Oak Staff", ["mage"], "common", [3, 5], 1.7, 12, magic=True, stats={"int": 1}, desc="A gnarled oak stave.", color="#7a5a35"),
    "ember_staff": W("Ember Staff", ["mage"], "uncommon", [6, 10], 1.65, 240, 5, magic=True, stats={"int": 3}, desc="Its tip smoulders.", color="#c4502a"),
    "cultist_staff": W("Staff of the Veiled", ["mage"], "rare", [11, 17], 1.6, 600, 10, magic=True, stats={"int": 5, "wis": 3}, desc="Whispers in the dark.", color="#6b3fa0"),
    "hunting_bow": W("Hunting Bow", ["ranger"], "common", [3, 6], 1.6, 12, desc="Yew and sinew."),
    "longbow": W("Elderglen Longbow", ["ranger"], "uncommon", [7, 12], 1.6, 250, 5, stats={"dex": 2}, desc="Strung with spider silk."),
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
    "troll_hide_gloves": A("Troll-Hide Grips", "hands", "rare", 5, 400, 12, stats={"str": 2, "sta": 2}),
    "leather_boots": A("Leather Boots", "feet", "common", 2, 25),
    "wolf_boots": A("Wolfpelt Boots", "feet", "uncommon", 4, 150, 3, stats={"dex": 1}, color="#7a7268"),
    "ring_vigor": A("Ring of Vigor", "ring", "uncommon", 0, 200, 3, stats={"sta": 3}, desc="Warm to the touch."),
    "ring_focus": A("Ring of Focus", "ring", "uncommon", 0, 200, 3, stats={"int": 2, "wis": 2}),
    "amulet_dawn": A("Amulet of First Dawn", "amulet", "epic", 2, 1500, 12, stats={"str": 3, "sta": 3, "wis": 3, "int": 3, "dex": 3}),
    # legendary arms (Elderglen - Vaelric)
    "sunforged_blade": W("Sunforged Greatblade", ["warrior"], "legendary", [62, 88], 1.45, 2800, 50, stats={"str": 18, "sta": 10, "dex": 6}, desc="Quenched in the heart of a dying star.", color="#ffd36b"),
    "starfall_staff": W("Starfall Staff", ["mage"], "legendary", [34, 50], 1.5, 2800, 50, magic=True, stats={"int": 22, "wis": 14}, desc="Constellations wheel within its crystal.", color="#8ab8ff"),
    "galeheart_bow": W("Galeheart Longbow", ["ranger"], "legendary", [54, 78], 1.3, 2800, 50, stats={"dex": 20, "str": 6, "sta": 6}, desc="Its string hums with the north wind.", color="#a8f0c8"),
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
    "ring_ancients": A("Ring of the Ancients", "ring", "legendary", 0, 600, 50, stats={"str": 6, "sta": 6, "wis": 6, "int": 6, "dex": 6}, desc="Older than the world's name."),
    "amulet_eternity": A("Amulet of Eternity", "amulet", "legendary", 6, 900, 50, stats={"sta": 10, "wis": 8, "int": 8, "str": 6, "dex": 6}, desc="Time slows around its wearer."),
    "cultist_amulet": A("Veiled Sigil", "amulet", "rare", 0, 500, 10, stats={"int": 4, "wis": 2}),
    # consumables
    "minor_hp": dict(name="Minor Healing Draught", type="consumable", rarity="common", heal=45, price=8, stack=20, desc="Restores 45 health."),
    "hp_potion": dict(name="Healing Potion", type="consumable", rarity="uncommon", heal=130, price=30, stack=20, desc="Restores 130 health."),
    "minor_mp": dict(name="Minor Mana Tonic", type="consumable", rarity="common", mana=35, price=10, stack=20, desc="Restores 35 mana."),
    "mp_potion": dict(name="Mana Elixir", type="consumable", rarity="uncommon", mana=100, price=34, stack=20, desc="Restores 100 mana."),
    "bread": dict(name="Traveler's Bread", type="consumable", rarity="common", heal=20, mana=10, price=3, stack=20, desc="Restores 20 health and 10 mana."),
    # materials / vendor goods
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
    "sealed_letter": dict(name="Sealed Letter", type="quest", rarity="uncommon", price=0, stack=1, desc="Captain Rhea's letter for Warden Lyra of Elderglen."),
}
for _k, _v in ITEMS.items():
    _v.setdefault("stack", 1)
    _v.setdefault("stats", {})

MONSTERS = {
    "giant_spider": dict(name="Giant Spider", level=1, hp=30, dmg=[2, 4], interval=2.0, speed=2.2, armor=0, aggro=6, range=1.8, xp=10,
                         gold=[1, 4], radius=0.8, leash=22, respawn=12, resist={"phys": 1.0, "magic": 1.0},
                         loot=[("spider_silk", 0.55), ("minor_hp", 0.12), ("leather_gloves", 0.04), ("spider_fang_blade", 0.01)]),
    "imp": dict(name="Imp", level=2, hp=45, dmg=[3, 6], interval=1.3, speed=4.0, armor=2, aggro=9, range=1.6, xp=15, gold=[2, 6],
                radius=0.55, leash=24, respawn=14, resist={"phys": 1.0, "magic": 0.85},
                loot=[("imp_horn", 0.5), ("minor_mp", 0.12), ("leather_cap", 0.05), ("bread", 0.1)]),
    "forest_wolf": dict(name="Forest Wolf", level=3, hp=75, dmg=[5, 9], interval=1.5, speed=5.6, armor=4, aggro=12, range=1.9, xp=25,
                        gold=[3, 8], radius=0.8, leash=30, respawn=18, resist={"phys": 1.0, "magic": 1.0},
                        loot=[("wolf_pelt", 0.6), ("wolf_boots", 0.04), ("minor_hp", 0.15)]),
    "goblin_scout": dict(name="Goblin Scout", level=4, hp=100, dmg=[6, 11], interval=1.25, speed=4.6, armor=6, aggro=11, range=1.7, xp=40,
                         gold=[5, 12], radius=0.55, leash=28, respawn=20, resist={"phys": 1.0, "magic": 1.0},
                         loot=[("goblin_ear", 0.6), ("leather_pants", 0.06), ("quiver", 0.03), ("minor_hp", 0.2)]),
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
}

NPCS = {
    "brannoc": dict(name="Brannoc the Smith", role="Equipment Merchant", town="semel", pos=[78, 191], kind="smith", merchant="semel_arms"),
    "mira": dict(name="Mira Vell", role="General Goods", town="semel", pos=[102, 191], kind="merchant", merchant="semel_goods"),
    "alys": dict(name="Sister Alys", role="Healer", town="semel", pos=[90, 211], kind="healer", healer=True),
    "toman": dict(name="Elder Toman", role="Village Elder", town="semel", pos=[83, 208], kind="elder", quests=["q_spiders", "q_imps"]),
    "rhea": dict(name="Captain Rhea", role="Town Guard", town="semel", pos=[101, 206], kind="guard", quests=["q_letter"]),
    "thessaly": dict(name="Thessaly Weaponwright", role="Equipment Merchant", town="elderglen", pos=[990, 199], kind="smith", merchant="elder_arms"),
    "fenn": dict(name="Old Fenn", role="Provisions & Curios", town="elderglen", pos=[1011, 200], kind="merchant", merchant="elder_goods"),
    "orin": dict(name="Druid Orin", role="Healer", town="elderglen", pos=[996, 222], kind="druid", healer=True),
    "vaelric": dict(name="Vaelric the Gilded", role="Legendary Arms", town="elderglen", pos=[1003, 192], kind="gilded", merchant="elder_legend"),
    "lyra": dict(name="Warden Lyra", role="Warden of Elderglen", town="elderglen", pos=[1008, 220], kind="guard"),
    # ambient townsfolk
    "v1": dict(name="Hob the Farmer", role="Villager", town="semel", pos=[70, 225], kind="villager", ambient=True),
    "v2": dict(name="Ella", role="Villager", town="semel", pos=[112, 178], kind="villager", ambient=True),
    "v3": dict(name="Tobin", role="Child of Titus", town="semel", pos=[95, 186], kind="child", ambient=True),
    "v4": dict(name="Wren the Weaver", role="Villager", town="elderglen", pos=[985, 230], kind="villager", ambient=True),
    "v5": dict(name="Moss", role="Elderglen Forester", town="elderglen", pos=[1020, 215], kind="villager", ambient=True),
}

MERCHANTS = {
    "semel_arms": dict(name="Brannoc's Forge", stock=[("iron_sword", 5), ("oak_staff", -1), ("hunting_bow", -1), ("ember_staff", 2), ("wooden_shield", -1),
                                                      ("spell_tome", 3), ("quiver", 3), ("leather_cap", -1), ("padded_tunic", -1), ("leather_pants", -1),
                                                      ("leather_gloves", -1), ("leather_boots", -1)]),
    "semel_goods": dict(name="Vell's Sundries", stock=[("minor_hp", -1), ("minor_mp", -1), ("bread", -1), ("hp_potion", 10)]),
    "elder_arms": dict(name="Thessaly's Armory", stock=[("steel_longsword", 3), ("longbow", 3), ("ember_staff", 3), ("iron_shield", 4), ("iron_helm", 4),
                                                        ("chainmail", 3), ("mystic_robe", 3), ("iron_greaves", 3), ("wolf_boots", 4), ("ring_vigor", 2),
                                                        ("ring_focus", 2)]),
    "elder_legend": dict(name="Vaelric's Legendary Arms", stock=[("sunforged_blade", -1), ("starfall_staff", -1), ("galeheart_bow", -1), ("aegis_dawn", -1),
                                                               ("codex_eternity", -1), ("quiver_windrider", -1), ("dragonscale_plate", -1), ("archmage_vestments", -1),
                                                               ("shadowstalker_garb", -1), ("crown_valor", -1), ("titan_greaves", -1), ("gauntlets_might", -1),
                                                               ("boots_wind", -1), ("ring_ancients", -1), ("amulet_eternity", -1)]),
    "elder_goods": dict(name="Fenn's Provisions", stock=[("minor_hp", -1), ("hp_potion", -1), ("minor_mp", -1), ("mp_potion", -1), ("bread", -1)]),
}
SELL_RATIO = 0.4
RESTOCK_SECS = 300

QUESTS = {
    "q_spiders": dict(name="Silk in the Fields", giver="toman", turnin="toman", kind="kill", target="giant_spider", count=6,
                      reward=dict(xp=150, gold=30, items=[("leather_boots", 1)]),
                      text="Giant spiders have crept into the north fields. Slay six of them, and return to me."),
    "q_imps": dict(name="Horns of Mischief", giver="toman", turnin="toman", kind="kill_collect", target="imp", count=5, collect="imp_horn", collect_count=3,
                   reward=dict(xp=260, gold=50, items=[("minor_hp", 5)]),
                   text="Imps from the southern hollow steal our grain. Slay five and bring me three of their horns."),
    "q_letter": dict(name="The Road to Elderglen", giver="rhea", turnin="lyra", kind="deliver", item="sealed_letter",
                     reward=dict(xp=600, gold=120, items=[("ring_vigor", 1)]),
                     text="Carry this sealed letter east along the forest road to Warden Lyra in Elderglen. Beware the woods."),
}


def item_public():
    return ITEMS


def public_data():
    return dict(items=ITEMS, monsters={k: {kk: vv for kk, vv in v.items() if kk != "loot"} | {"drops": [i for i, _ in v["loot"]]} for k, v in MONSTERS.items()},
                abilities=ABILITIES, classes=CLASSES, xp_table=XP_TABLE, npcs=NPCS, quests=QUESTS, attr_info=ATTR_INFO,
                actions=ACTIONS, max_level=MAX_LEVEL, inv_slots=INV_SLOTS, sell_ratio=SELL_RATIO,
                merchants={k: dict(name=v["name"]) for k, v in MERCHANTS.items()})


def sell_price(item_id):
    return max(1, math.floor(ITEMS[item_id]["price"] * SELL_RATIO)) if ITEMS[item_id]["price"] > 0 else 0
