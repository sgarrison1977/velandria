# Velandria (formerly Suminex / Eryndovar) — PRD

## Original problem statement
Build SUMINEX: a fully playable browser-based real-time multiplayer dark-fantasy MMORPG (Xenimus-inspired feel, original assets). Angled top-down 3D (Three.js), persistent accounts/characters, live multiplayer, real combat, 10 enemy types, loot, inventory/equipment, merchants, leveling to 100 (L2=200, L3=1000 cumulative XP), attributes (Str/Sta/Wis/Int/Dex), 6+ abilities, keybinds, world chat, safe zones (server enforced), two towns (Titus — formerly Semel — and Elderglen) linked by a long forest road, minimap/world map, quests, audio.

## User choices
JWT email/password · procedural low-poly 3D models in code · three classes (Warrior/Mage/Ranger) · procedural WebAudio SFX.
Later requests: hold-to-walk toward pointer; ranged/spell abilities fire at the hovered enemy (melee needs a click); Minor Heal no cooldown; rename Semel → Titus; tooltips must not be clipped; better graphics/characters.

## Architecture
- Backend: FastAPI + Motor/MongoDB. `server.py` (auth, characters, REST, WS `/api/ws`), `game.py` (10 Hz authoritative simulation: movement via A*, monster AI, combat, loot, merchants, quests, chat, persistence), `game_data.py` (all balance/config), `world.py` (deterministic world gen + 1 m collision grid + pathfinding).
- Frontend: React + Three.js engine (`src/game/*`: terrain/vegetation instancing, structures, procedural rigs + animations, effects, bloom post-processing, DOM nameplates, minimap) + HUD components (`src/components/game/*`).

## Implemented (2026-06)
- Auth, character create/select/delete (unique names), persistence (periodic + on logout/linkdead + on trades/level-ups)
- 1100×400 m world, 2 towns with distinct architecture, safe squares, walls/gates, ~5k trees, rocks, streams+bridges, lakes, ruins, camps, caves, sealed dungeon gate, standing stones
- 10 monster types (108 spawns), AI (wander/aggro/chase/leash/return/respawn), ranged cultists, poison spiders, regenerating trolls
- Combat (hit/crit/armor/resists), 9 abilities, buffs/DoT/AoE, loot with ownership timers, rarity tiers
- Inventory (30 slots, stacking), 9 equipment slots, merchants (buy/sell, stock), healers, 3 quests
- XP table to 100, attribute & skill points, keybinding editor (conflict handling, defaults), audio settings, graphics quality + auto-degrade
- Global chat + whispers, rate limiting; player inspect, context menus; minimap + fog-of-war world map
- Hold-to-walk, hover-targeted ranged casting, portal tooltips, Minor Heal cd 0

## Testing
- 30 backend pytest tests pass (/app/backend/tests); frontend focused test iteration_1: 100%.

## Backlog
- DONE: Hollow Deep dungeon (6 chambers, 4 dungeon monsters, boss Vorgath lvl 75 with slam AoE, portals at (518,51) and inside)
- DONE: Map waypoints (click world map, minimap arrow + distance, 3D beam); East expansion "Sundered Marches" W=1600 with towns Ironhold (1260,200) and Sunhollow (1470,300)
- DONE: Waystones in 4 towns (gold fast travel), Thane Borik 4-quest chain (requires field), Party system (invite/accept/leave/kick, shared XP+quest credit within 60m, party loot, /p chat, party frame, minimap green dots)
- DONE: Elderglen (Warden Lyra) + Sunhollow (Captain Soren) 4-quest chains with unique rewards; legendary/epic gear glow (weapon shimmer + aura); hotbar removed, spells bound in Settings > Key Bindings; 3 skill points per level (retroactive)
- DONE: 4 classes (warrior/ranger/wizard/warlock), 20 Latin-named spells, charge buffs 5min + buff bar, Contra Visus + Stop Action, Creare Porta + mark0-9, random item properties (AFFIX_POOL), settings blank fix (ab-glyph absolute)
- DONE: drag ring to chosen ring slot, portal countdown ring, spells aim at pointer (aim_at)
- DONE: realistic trees (leaf cards, bark textures, vertex-shaded canopies), belt slot + 6 belts, potions full restore
- DONE: account storage trunks (100 slots, db.storage by account_id) in 4 towns; item compare + red locked items
- P1: bank/storage NPC, PvP arenas outside towns
- DONE: Elderglen (Warden Lyra) + Sunhollow (Captain Soren) 4-quest chains with unique rewards; legendary/epic gear glow (weapon shimmer + aura); hotbar removed, spells bound in Settings > Key Bindings; 3 skill points per level (retroactive)
- DONE: 4 classes (warrior/ranger/wizard/warlock), 20 Latin-named spells, charge buffs 5min + buff bar, Contra Visus + Stop Action, Creare Porta + mark0-9, random item properties (AFFIX_POOL), settings blank fix (ab-glyph absolute)
- DONE: drag ring to chosen ring slot, portal countdown ring, spells aim at pointer (aim_at)
- DONE: realistic trees (leaf cards, bark textures, vertex-shaded canopies), belt slot + 6 belts, potions full restore
- DONE: account storage trunks (100 slots, db.storage by account_id) in 4 towns; item compare + red locked items
- P1: Client-side movement prediction; more quests; crafting from materials
- P2: GLTF character art pass, day/night cycle, music, mobile controls
- DONE (2026-06): Character model overhaul — new procedural rig system in `frontend/src/game/rig/` (tex.js canvas textures + env-mapped metals, geo.js sculpted lathe/heads/hair/cloth, gear.js weapons/shields, body.js humanoid w/ visible gear per slot, beasts.js spider/wolf, anim.js walk/attack/cast/cape). Snapshot eq string now `main|off|head|chest|counts|feet|legs|hands|belt`. Dev viewer at `/gallery?set=players|monsters|monsters2|npcs`.
- DONE: Elderglen square tree removed; Gribllin granted 50k gold, 6 mana-regen rings, level 50.
- DONE: Contra Visus (5 min) no longer cancelled by releasing hold-to-walk; only the Stop Action keybind ends it.
- DONE (untested per user request): Look customization — LOOK_OPTS in game_data (skin, hair, hairStyle, beardStyle, face, eyes), POST /api/characters accepts `look`, PUT /api/characters/{id}/look (only when not in world). Snapshot eq string index 9 = look csv. UI: `components/game/Appearance.jsx` (live 3D preview w/ drag-rotate + face zoom, swatch picker, randomize) in Forge form + palette button on each character card.
- DONE (untested): Contra Visus shimmer — snapshot player tuple index 13 = invis flag; `setInvis` swaps rig materials to fresnel SHIMMER shader (rig/anim.js).
- DONE (2026-06, untested per user): The Proving Pits grinding dungeon — world.py PIT_ROOMS (gate + 4 tier halls r=26 at x 955-1141, z 520), DUNGEONS list sent to client, portals pits_in (722,212 wilderness) / pits_out. 80 monsters (20/tier) using `pit_*` variants (game_data `_pit`, respawn=5, `base` field for client model + quest credit; tier IV uses level-scaled "Ascended" 66/72/80). Map: generic dungeon insets for each dungeon, portal labels, region banner via dungeonAt().
- Attack Run: dashes to pointer when no enemy (game.py dash_to). Item props now support "dmg" (flat weapon damage).
- DONE (untested): Wave Champions — every 100 kills per Pit tier spawns `pit_champion_{1-4}` (Gorrak 18, Mossjaw 38, Ser Vaelric 62, Azgharoth 88; 8x HP, 6x XP, model_scale 1.45) with 3 guaranteed random gear + 5x gold; server-wide announce; removed 8s after death (game.py pit_kill/spawn_q).
- DONE (untested): Pacing fixes — GLOBAL_CD 0.7s between casts, held keys no longer auto-repeat casts, projectiles ~40% slower, Attack Run now a real 24 m/s dash (p.dash) instead of an instant snap.
- DONE (2026-06): Gear Score leaderboard (GET /api/leaderboard/gear, game_data.gear_score; Leaderboard.jsx panel, Trophy menu button + "Rankings" link under gear score). Live 3D character in equipment doll, gear score w/ count animation, drag slot highlighting (window "sx-drag" event).
- DONE: Realism pass — MeshPhysical skin/cloth/hair/leather (sheen/clearcoat), smooth rounded limb joints, painted face map (eye shadow, blush, lips, stubble), eyelids/iris/pupil/lashes, capsule lips, hair strand shell + fringe, cap/nasal helms sit above brow (helmShell), beards hug jaw below nose (beardGeo rewrite).
- USER RULE: Do NOT run tests (testing agent / in-game screenshots) unless the user explicitly says so. Gallery page (/gallery) visual checks only.
- DONE (untested): The Titus Barrows (lvl 1-10) — world.py BARROW_ROOMS (8 large rooms, branching BARROW_LINKS), entrance portal barrow_in at (92,128) north of Titus; 70 monsters (spider/imp/wolf/goblin/skeleton/bandit/venom spider/orc) + boss barrow_king (Morvath, lvl 10, respawn 180s). Third map inset. Spin/whirlwind = 360° body spin anim (no trail).
- DONE (untested): Realistic SFX — 31 clips generated once via fal ElevenLabs sound-effects v2 (Universal Key, builder-time script backend/scripts/gen_sfx.py) stored in frontend/public/sfx; audio.js plays clips w/ variants + pitch jitter, synth fallback. Per-ability sounds (AB_SFX), monster growls on aggro/attack (growlFor).
- DONE: Home town — Player.home persisted; Waystone option "Make X my home town"; death respawn + Stuck use home_zone(). Item instances support `lvl` override (equip check + client inst/cantUse).
- Note: no Whirlwind ability exists (only Spin Attack).
- DONE (untested): Loot filter (Settings→Loot Filter, LootFilter.jsx, server Game.loot_wanted), dim/hide unwanted ground loot, server-side auto-loot (p.autoloot, 1.8m), loot despawn 60s. Legendary drop: golden light pillar + "legendary" chime. Background music (public/music town/wild/dungeon.mp3 via fal elevenlabs/music, scripts/gen_music.py), crossfaded by area, Music volume slider in Settings→Audio.
- DONE (untested in-game): World is now an island continent — world.py authors content in LOCAL coords then `_globalize()` pastes onto a 1920x920 grid (OX=OZ=160, overworld OH=720, dungeon band below). `coast(u,v)` (mirrored in world3d Terrain.coast) defines wavy rounded shoreline; ocean blocked, beaches, ocean plane, extra wild land + vegetation + spawns on outer lands. All module coords (SAFE_ZONES, PORTALS, REGIONS, rooms, DUNGEONS, LAKES, NPCS pos) translated once (_SHIFTED). DB characters/marks migrated (db.meta world_shift). New coords: Titus ≈ (250,360). Use world.to_global() when adding new hardcoded local coords.

## Update — Saltmere Harbor, Offshore Isles, Cave Entrances, Surf (Jun 2026)
- World grid now 1920 x 1160 (GOH=960 overworld incl. 400-unit southern sea; dungeons below). One-time DB migration `meta.map_south_sea` shifted dungeon characters by +240 z.
- Saltmere Harbor (5th town, global 1080,582): palisade, harbor houses, docks/piers, boats, ferry, fish racks, Fishmonger Marta (harbor_fish shop: grilled trout, smoked eel, salted cod, potions), healer, trunk, waystone.
- Offshore Isles (Isle of Thorns, Wrecker's Atoll, Drowned Spire, linked by sandbars): Ferryman Odo charges 1000 gold; Bosun Kell returns free. Lv 27-35 isle monsters (reef_crawler, drowned_corsair, tidecursed_wraith, coral_colossus, boss captain_blackbrine), 3 treasure chests (15-min per-player cooldown), pearls loot.
- Dungeon entrances render as rocky torch-lit cave mouths (portal.face); exits are daylight stair tunnels.
- Sea shader with foam waves rolling to every shore + positional surf.mp3 ambience.
- Stuck button moved into the Exit/logout popup. World map: dungeons hidden by default (click "Show dungeons"), aspect-correct marker placement.
- Fixed inland low terrain being flooded by the sea plane.
- /gallery?set=world&x=&z=&d= — isolated 3D world preview (no login) for verification; /gallery?set=isles for new models.

## Update — Elemental gear, admin gifts (Jun 2026)
- Mana Steal: monsters have hidden mana pool (200+20*lvl, x3 boss/champion); each hit steals mana_steal% x enemy max mana until drained.
- Elemental per-hit stats: fire_dmg, frost_dmg (30% slow move+attack 3s, icy aura), lightning_dmg (arcs to 2 enemies within 7m for 50%). Colored numbers, bursts, sfx; elemental arrows glow with ember/ice/spark trails.
- Admin "Keeper's Gift" popup (Gift icon in menubar, ws msg t=give) — only for ADMIN_EMAILS in backend/.env (sgarrison1977@gmail.com). Gives to online or offline characters by name, custom stats + custom name.
- Custom gifts to Gribb: Hawkeye Cap, Emberstrike bow (item emberstrike_bow), Heart of the Wilds amulet.
- Keeper's Gift popup: category tabs (Weapons, Off-hand, Helms, Chest, Limbs, Rings & Amulets, Potions & Food, Materials) + search + icon grid. Preview: /gallery?set=give
- New spells (lvl 8, learn with skill points): Wizard Glacies Nova (8m frost AoE, 30% slow 3s), Warlock Fulmen Catena (lightning bolt chaining to 4 more enemies, -20% per jump).
- Titus Barrows entrance moved to the northern shore NE of Titus (local 190,-22 / global 350,138) with a dirt trail from Silkfield; cave-site clearing + rock collision now done post-globalize in World._cave_sites().
- Monster camps (World._monster_camps): scattered 3-packs removed; 52 themed camps (20-30 mobs, mixed band types + leader, family props: tents/campfire/totem/banner/obelisk/grave/web/bones/brazier/pillars), ~155 lone wanderers; TARGET_MONSTERS=1500 total. Camps shown on world map as red markers with name + level.
- Titus Gravefields (World._graveyard, global 285,582, 72x50): iron-fenced graveyard with gate, 150 headstones, 2 mausoleums, dead trees, braziers; trail from Titus south gate; 100 skeletons lv 2-15 (restless_bones 2, skeleton 5, grave_warden 9, crypt_knight 13, boss sexton_of_bones 15) — tougher toward the south; all base=skeleton (counts for skeleton quests).
- XP bar doubled (24px). Rising Dead: graveyard spawns have rise=True → 1.3s emerge (no AI), snapshot field 11, client dirt burst + sink-in rise anim. Quest q_sexton (kind 'crypt'): Gravekeeper Morrow in Titus; Sexton drops sexton_key while active; crypt_w/crypt_e door NPCs unlock one-time chest (rare+ lv<=15 gear w/ props + 1500 gold); turn-in 4000 XP; once per character.
- Quest q_barrowking (requires q_sexton): Morrow → slay Morvath the Barrow King (Titus Barrows) — grave_iron_crown drops straight to bag (quest 'drop' flag); reward 8000 XP, 2500 gold + guaranteed epic lv<=15 class gear with props (reward.gear). Kill matching now accepts exact monster type as well as base.
- Game renamed to Velandria (Jun 2026).
- Perf (Jun 2026): static structure meshes merged per material+64m chunk (structures.js mergeStatic) — graveyard view 1796→129 draw calls; static PointLights harvested into an 8-light pool reassigned to nearest anchors (lightpool.js) — scene light count was 47. Server tick ~2.7ms with 1500 monsters (not the bottleneck).
- Graveyard shrunk to 52x36 with 50 skeletons; crypt doors at (270/300, 586.4). Town outskirts: 7 low-level (lv1-4) packs of 3-4 at 82-118m around each of the 5 towns. TARGET_MONSTERS raised to 1800 (≈310 lone wanderers + 52 camps).

## 2026-06 Updates
- Ocean/river/lake water moved to a lightweight custom ShaderMaterial (no PBR/shadow/point-light cost); foam/swash/fog/cave dimming kept (`world3d.js` waterMaterial, `waterLight` uniform set in engine.js).
- Admin panel: "Admin Login" button at bottom of title screen -> /admin. Separate admin creds (ADMIN_USERNAME/ADMIN_PASSWORD env, griblin). Lists accounts (email, created, char count), characters (name, class, level, gold, gear score, online), search, reset password (bcrypt, plaintext never stored), edit level/gold, delete character/account (blocked while character is in world). Lockout 5 fails/15min by X-Forwarded-For IP. Tested iteration_2 (100%).
- Removed ocean swash + wave crest foam from the sea shader (user: laggy). Shore tint kept.
- Admin live tools: live edit level/gold for online players (refills HP/MP, adjusts attr/skill points), kick (WS close 4002 + reason), ban 1/7/30 days or permanent + reason (blocks login 403, invalidates tokens, kicks online), unban, server broadcast (gold banner 8s + chat), activity stats (last_login, play_seconds per account/character). Tested iteration_3; fixes applied for UTF-8 close-reason bug, empty online edit, level-lowering points, linkdead play time.
- 2026-06: Drag any inventory item onto the 3D world to drop it (anyone can pick up immediately, despawns after 5 min). 6 new world bosses (Grubnak lv15, Old Greymaw lv22, Ixra lv28, Hierophant Malzeth lv40, Iron Revenant lv55, Pyrrhax lv70) with custom models, special AoE attacks (stomp/howl/venom/frost nova/soul drain/hellfire), enrage, guaranteed rare+ drops, 10-min respawn. Bounty Boards in Titus, Elderglen, Ironhold, Sunhollow, Saltmere Harbor: 9 daily boss bounties (party kills count) -> gold + XP + Bounty Tokens; Token Shop with 11 exclusive items; waypoint tracking. Tested iteration_4 (backend 100%).
- 2026-06: Bounty Board shows live boss respawn countdown ("Alive" / "Returns in m:ss") and a weekly Rankings tab (top 10 + own rank, bounty_claims collection, GET /api/leaderboard/bounties, resets Monday 00:00 UTC).
- Tree/bush appearance complaint: user cancelled the task (no changes made).
- 2026-06: Boss Kill Feed — world boss kills show a gold 'World Boss Slain' banner to all online players naming the whole party (killer + nearby party members), plus chat line.
- USER RULE: Do NOT run any tests (testing agent, screenshots of game, WS tests) until the user explicitly says so, and do not ask permission to test.
- 2026-06: Camps reduced 52→36, each camp a single monster type (14-20 mobs); more lone wanderers (TARGET_MONSTERS 2000). Open-air Castle Vexmoor in far NE (global x1680-1782, z170-226): 8 walled rooms snaking from the south gate (Barbarians 65, Battlemages 67, Necromancers 69, Gargoyles 71, Hellhounds 73, Assassins 75, Sentinels 77, Throne: Royal Guards 78 + Lord Vexmoor boss lv80, on bounty boards). Terrain flattened under castle. Monster nameplates show "Name · Lv X" colored by level difference.
- 2026-06: Skill points removed — spells auto-granted at their level (on level-up and on login), Skills panel is a read-only list. Fog of war removed from world map. Castle Vexmoor expanded to 16 rooms (4x4 snake, lv 65-80, 16 distinct monster types; x1680-1782, z160-258) with world-map castle icon + inset listing halls/levels. Regalia of Vexmoor 6-piece set (castle-only 4% drop; 2pc +8% dmg, 4pc +10% HP +5% crit, 6pc 15% DR) with set tooltip. Room clear: all monsters in a room dead → each participant (hit in last 4 min) gets a personal Vexmoor Coffer (2 min), opened by Use → gold, potions, rare+ gear or 25% set piece. 2-min room cooldown. NOT TESTED (user rule).
- 2026-06: Vexmoor phase 2 (<50% HP: heals 10% once, summons 6 Royal Guards (add_of, removed on death/reset), Usurper's Wrath slam every 5s r13 shadow, attacks 20% faster). Full 6pc Vexmoor set → faint gold particle shimmer (eq string suffix "|vx"). Castle runs: timer from entering castle bounds (party-shared), all 16 rooms cleared + Vexmoor slain → castle_runs collection, server announce, GET /api/leaderboard/castle, "Castle" tab on Bounty Board; 2 min outside cancels. Castle furniture (rugs, tables, weapon racks, armor stands, bookshelves, candelabras, barrels/crates/anvil/bones) per room via World._castle_furniture. NOT TESTED (user rule).
- 2026-06: Castle layout/walls/inset removed from world map (only castle icon + "Lv 65–80" label remain). Player trading: right-click player → Trade → request popup (30s) → TradeWindow.jsx (12-slot offers, drag/click items, gold, Lock/Unlock, Confirm; any change unlocks both; 12m to start, 15m max, no trade within 6s of combat; server-validated swap in game.py trade_* handlers, cancelled on disconnect). Sleek modern HUD restyle appended to App.css (glass panels, Cinzel/Inter, rounded buttons/tabs/tooltips/context menu/toasts, panel open animations) per /app/design_guidelines.json. NOT TESTED (user rule).
- 2026-06: UI restyle redo cancelled by user (kept sleek modern). Draggable windows: Panel title bar drag (ui.jsx useWindowPos), positions saved per window in localStorage sx_win_pos, Settings → Graphics 'Reset window positions'. NOT TESTED (user rule).
- 2026-06: Town fixes: gates placed where roads actually cross each town wall (World._road_gates), wall segments skipped over roads, buildings auto-nudged off roads/gates/each other (World._place_building; Ironhold west house dropped), door 'face' computed toward nearest road (frontend uses b.face), road cells inside towns unblocked; bridges centered on crossing and rotated to road direction with length scaled for oblique crossings (b.len). Bounty boards no longer spin (face south). NOT TESTED (user rule).
- 2026-06: Market stalls: World._market places up to 4 striped-awning stalls per walled town beside the main roads (facing road, off road cells, away from gates/NPCs) with crates/barrels beside them. NOT TESTED (user rule).
- 2026-06: Removed monster growl/roar sfx on aggro and on monster attacks (engine.js). Town crowds: 20 'stroll' ambient villagers (5 per walled town, game_data NPCS stroll*) walk between market stalls client-side (engine.stroll), pause at stalls, show speech-bubble chatter lines on their nameplate. NOT TESTED (user rule).
- 2026-06: Villager gossip: strollers' chatter ~40% are hints built from data.bounties (boss name/where/level/gold) + castle secrets (engine.gossip). NOT TESTED (user rule).
- 2026-06: Portals restyled: structures.js standingPortal() oval stone frame + glowing rune rim + animated swirl (canvas texture) + light; dungeon exits use it, cave entrances get a smaller amber portal inside the mouth; mage gate spell uses oval swirl. Talkative villagers: left-click an ambient villager within 14m → they stop, face you and say a rumor (gossip) or gameplay tip for 7s (engine.villagerTalk). NOT TESTED (user rule).
- 2026-06: Nameplates enlarged (name 17px, sub 13px, hp bar 72x7); speech lines no longer Title-Cased (is-say class).
- 2026-06: Nameplates bumped again: name 20px, sub-line 15px bold white with heavy outline, hp bar 80x8.
- 2026-06: Nameplate size slider (Settings→Graphics, 70–180%, localStorage sx_np → CSS --np). Villager speech text 18px wrapped. Portal hum: synthesized WebAudio drone (audio.portalHum) scaled by distance (<20m) to portals and mage gates. Villager favors: 8 daily-repeatable 'collect' quests on ambient villagers v1–v8 (QUESTS fav_*; kind collect; repeat=True with day stamp; Game.repeat_ok); clicking favor villagers opens dialog. NOT TESTED (user rule).
- 2026-06: Bot players (backend/bots.py): 4 always-online server-side characters (Thorgar warrior, Sylvara ranger, Myrrdin wizard, Vexa warlock; account_id '__bots__', ws=None, p.bot=True). AI: hunts monsters level-4..+1 (no bosses/dungeons), casts class spells, potions, loots, allocates attributes, equips upgrades, returns to town to sell junk/buy potions, rests, unstuck, respawns. Bots auto-decline party/trade. Admin toggle: GET/PUT /api/admin/bots (db.meta bots.enabled), BotsControl on /admin. Verified via DB that bots gain XP; no in-game test (user rule).
- 2026-06: Bots v2: admin count 0–12 (12 named bots cycling classes, bot_slot field), bot chat toggle (occasional lines every 4–12 min), bot pairs (every 60s 30% chance pair bots within 3 levels into a party for 10–25 min; leader hunts level-1..+3, follower assists/follows). meta bots {enabled,count,chat}. Monster death sound removed. NOT TESTED in-game (user rule).

## 2026-06 — Bot admin controls & castle raids
- Admin Bots panel: per-bot "Teleport to Town" (online bots) and "Reset to Lv 1" (fresh starter character; keeps name/look/slot). Endpoints: POST /api/admin/bots/{id}/teleport, POST /api/admin/bots/{id}/reset
- Bot castle raids (bots.py): two free bots at level 60+ (RAID_LEVEL) occasionally party up, walk to Castle Vexmoor, clear halls together (follower assists leader target); clears record to castle_runs rankings. Raid ends on wipe/finish/40-min timeout, 30–60 min cooldown before retrying. Bots now auto-open Vexmoor Coffers and path toward out-of-range targets.
- Verified via isolated simulation (lv70 bots cleared 7/16 halls then wiped → respawn in town).

## 2026-06 — Multi Vis Nex rework
- Multi Vis Nex: Wizard + Warlock, unlocks Lv 11, 24 MP, hits up to 8 enemies within 14m (12 + 110% Int each), no target needed. Visual = red Lunae Lumen Nex-style beam to every target, beam sound (played once per cast), red icon.
- grant_spells now removes spells above the character's level (wizards Lv 4–10 lose Multi Vis Nex until Lv 11).
