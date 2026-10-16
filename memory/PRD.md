# Realms of Velanthra (formerly Suminex / Eryndovar) — PRD

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
