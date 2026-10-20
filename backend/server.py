from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

import os, re, json, logging, asyncio, uuid, hmac
from datetime import datetime, timezone, timedelta
import bcrypt, jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from game import Game, new_character_doc, ATTR_POINTS_PER_LEVEL
from game_data import public_data, CLASSES, clean_look, gear_score, MAX_LEVEL, XP_TABLE

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("server")
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_ALG = "HS256"
app = FastAPI()
api = APIRouter(prefix="/api")
game: Game = None
_world_json = None
ADMIN_EMAILS = {e.strip().lower() for e in os.environ["ADMIN_EMAILS"].split(",") if e.strip()}


def hash_pw(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p, h):
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid, email):
    return jwt.encode({"sub": uid, "email": email, "type": "access", "exp": datetime.now(timezone.utc) + timedelta(days=7)},
                      os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def user_from_token(token):
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    return None if u and ban_text(u) else u


def ban_text(u):
    b = u.get("ban")
    if not b:
        return None
    if b.get("until") and datetime.fromisoformat(b["until"]) <= datetime.now(timezone.utc):
        return None
    when = f"until {datetime.fromisoformat(b['until']).strftime('%b %d, %Y %H:%M UTC')}" if b.get("until") else "permanently"
    return f"This account is banned {when}." + (f" Reason: {b['reason']}" if b.get("reason") else "")


async def current_user(request: Request):
    h = request.headers.get("Authorization", "")
    token = h[7:] if h.startswith("Bearer ") else None
    u = await user_from_token(token) if token else None
    if not u:
        raise HTTPException(401, "Not authenticated")
    return u


class AuthIn(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=128)


class CharIn(BaseModel):
    name: str
    cls: str
    look: dict | None = None


class LookIn(BaseModel):
    look: dict


def public_char(c):
    return {k: c[k] for k in ("id", "name", "cls", "level", "xp", "gold", "equipment")} | {"look": c.get("look")}


@api.get("/")
async def root():
    return {"game": "Velandria", "online": len(game.players) if game else 0}


@api.post("/auth/register")
async def register(body: AuthIn):
    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Invalid email address")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with that email already exists")
    u = dict(id=uuid.uuid4().hex, email=email, password_hash=hash_pw(body.password), created_at=datetime.now(timezone.utc).isoformat())
    await db.users.insert_one(u)
    return {"token": make_token(u["id"], email), "user": {"id": u["id"], "email": email}}


@api.post("/auth/login")
async def login(body: AuthIn, request: Request):
    email = body.email.strip().lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and datetime.fromisoformat(att["until"]) > datetime.now(timezone.utc):
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    u = await db.users.find_one({"email": email})
    if not u or not check_pw(body.password, u["password_hash"]):
        cnt = (att or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": cnt, "until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_many({"identifier": ident})
    if ban_text(u):
        raise HTTPException(403, ban_text(u))
    await db.users.update_one({"id": u["id"]}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    return {"token": make_token(u["id"], email), "user": {"id": u["id"], "email": email}}


@api.get("/auth/me")
async def me(u=Depends(current_user)):
    return u


@api.get("/characters")
async def list_chars(u=Depends(current_user)):
    chars = await db.characters.find({"account_id": u["id"]}, {"_id": 0}).to_list(10)
    return [public_char(c) for c in chars]


@api.post("/characters")
async def create_char(body: CharIn, u=Depends(current_user)):
    name = body.name.strip()
    if not re.match(r"^[A-Za-z][A-Za-z']{2,15}$", name):
        raise HTTPException(400, "Name must be 3-16 letters (apostrophes allowed), starting with a letter")
    if body.cls not in CLASSES:
        raise HTTPException(400, "Invalid class")
    if await db.characters.count_documents({"account_id": u["id"]}) >= 5:
        raise HTTPException(400, "Maximum of 5 characters per account")
    if await db.characters.find_one({"name_lower": name.lower()}):
        raise HTTPException(400, "That name is already taken")
    doc = new_character_doc(u["id"], name[0].upper() + name[1:], body.cls)
    if body.look is not None:
        doc["look"] = clean_look(body.look)
        if not doc["look"]:
            raise HTTPException(400, "Invalid appearance")
    try:
        await db.characters.insert_one(dict(doc))
    except Exception:
        raise HTTPException(400, "That name is already taken")
    return public_char(doc)


@api.get("/leaderboard/gear")
async def gear_leaderboard(u=Depends(current_user)):
    rows = []
    async for c in db.characters.find({}, {"_id": 0, "id": 1, "name": 1, "cls": 1, "level": 1, "equipment": 1}):
        live = game.players.get(c["id"])
        eq = live.equipment if live else c.get("equipment")
        rows.append(dict(id=c["id"], name=c["name"], cls=c["cls"], level=live.level if live else c["level"], score=gear_score(eq), online=bool(live)))
    rows.sort(key=lambda r: -r["score"])
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    mine = [r for r in rows if r["id"] in {c["id"] async for c in db.characters.find({"account_id": u["id"]}, {"id": 1})}]
    return {"top": rows[:10], "mine": mine, "total": len(rows)}


@api.get("/leaderboard/bounties")
async def bounty_leaderboard(u=Depends(current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=today.weekday())
    rows = await db.bounty_claims.aggregate([
        {"$match": {"ts": {"$gte": start}}},
        {"$group": {"_id": "$char_id", "count": {"$sum": 1}, "name": {"$last": "$name"}, "cls": {"$last": "$cls"}, "last": {"$max": "$ts"}}},
        {"$sort": {"count": -1, "last": 1}},
    ]).to_list(5000)
    out = [dict(id=r["_id"], name=r["name"], cls=r["cls"], count=r["count"], rank=i + 1) for i, r in enumerate(rows)]
    mine_ids = {c["id"] async for c in db.characters.find({"account_id": u["id"]}, {"id": 1})}
    return {"top": out[:10], "mine": [r for r in out if r["id"] in mine_ids], "total": len(out),
            "resets_at": (start + timedelta(days=7)).isoformat()}


@api.get("/leaderboard/castle")
async def castle_leaderboard(u=Depends(current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=today.weekday())
    q = {"ts": {"$gte": start}}
    top = await db.castle_runs.find(q, {"_id": 0}).sort("secs", 1).to_list(10)
    mine_ids = [c["id"] async for c in db.characters.find({"account_id": u["id"]}, {"id": 1})]
    best = await db.castle_runs.find(q | {"members.id": {"$in": mine_ids}}, {"_id": 0}).sort("secs", 1).to_list(1)
    rank = (await db.castle_runs.count_documents(q | {"secs": {"$lt": best[0]["secs"]}}) + 1) if best else None
    fix = lambda r: dict(secs=r["secs"], members=r["members"], ts=r["ts"].isoformat())
    return {"top": [fix(r) | {"rank": i + 1} for i, r in enumerate(top)], "mine": fix(best[0]) | {"rank": rank} if best else None,
            "resets_at": (start + timedelta(days=7)).isoformat()}


@api.put("/characters/{cid}/look")
async def set_look(cid: str, body: LookIn, u=Depends(current_user)):
    look = clean_look(body.look)
    if not look:
        raise HTTPException(400, "Invalid appearance")
    if cid in game.players:
        raise HTTPException(400, "Leave the world before changing your appearance")
    r = await db.characters.update_one({"id": cid, "account_id": u["id"]}, {"$set": {"look": look}})
    if not r.matched_count:
        raise HTTPException(404, "Character not found")
    return {"ok": True, "look": look}


@api.delete("/characters/{cid}")
async def delete_char(cid: str, u=Depends(current_user)):
    if cid in game.players:
        raise HTTPException(400, "Character is currently in the world")
    r = await db.characters.delete_one({"id": cid, "account_id": u["id"]})
    if not r.deleted_count:
        raise HTTPException(404, "Character not found")
    return {"ok": True}


class AdminLoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class AdminPwIn(BaseModel):
    password: str = Field(min_length=6, max_length=128)


class AdminCharIn(BaseModel):
    level: int | None = Field(None, ge=1, le=MAX_LEVEL)
    gold: int | None = Field(None, ge=0, le=1_000_000_000)


class AdminBanIn(BaseModel):
    days: int | None = Field(None, ge=1, le=3650)
    reason: str = Field("", max_length=200)


class AdminTextIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)


async def current_admin(request: Request):
    h = request.headers.get("Authorization", "")
    try:
        payload = jwt.decode(h[7:], os.environ["JWT_SECRET"], algorithms=[JWT_ALG]) if h.startswith("Bearer ") else {}
    except jwt.PyJWTError:
        payload = {}
    if payload.get("type") != "admin" or payload.get("sub") != os.environ["ADMIN_USERNAME"]:
        raise HTTPException(401, "Admin authentication required")
    return payload["sub"]


@api.post("/admin/login")
async def admin_login(body: AdminLoginIn, request: Request):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "x")
    ident = f"admin:{ip}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and datetime.fromisoformat(att["until"]) > datetime.now(timezone.utc):
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    ok_u = hmac.compare_digest(body.username.strip().lower().encode(), os.environ["ADMIN_USERNAME"].strip().lower().encode())
    if not (hmac.compare_digest(body.password.strip().encode(), os.environ["ADMIN_PASSWORD"].strip().encode()) and ok_u):
        cnt = (att or {}).get("count", 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": cnt, "until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(401, "Invalid admin username or password")
    await db.login_attempts.delete_many({"identifier": ident})
    token = jwt.encode({"sub": body.username, "type": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, os.environ["JWT_SECRET"], algorithm=JWT_ALG)
    return {"token": token}


def admin_char(c):
    live = game.players.get(c["id"])
    eq = live.equipment if live else c.get("equipment")
    return dict(id=c["id"], name=c["name"], cls=c["cls"], level=live.level if live else c["level"], gold=live.gold if live else c.get("gold", 0),
                score=gear_score(eq), online=bool(live), play_seconds=c.get("play_seconds", 0))


@api.get("/admin/accounts")
async def admin_accounts(_=Depends(current_admin)):
    chars = {}
    async for c in db.characters.find({}, {"_id": 0, "id": 1, "account_id": 1, "name": 1, "cls": 1, "level": 1, "gold": 1, "equipment": 1, "play_seconds": 1}):
        chars.setdefault(c["account_id"], []).append(admin_char(c))
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(5000)
    return [dict(id=u["id"], email=u["email"], created_at=u.get("created_at"), admin=u["email"] in ADMIN_EMAILS,
                 last_login=u.get("last_login"), play_seconds=u.get("play_seconds", 0), ban=u.get("ban") if ban_text(u) else None,
                 characters=sorted(chars.get(u["id"], []), key=lambda c: -c["level"])) for u in users]


@api.put("/admin/accounts/{uid}/password")
async def admin_reset_pw(uid: str, body: AdminPwIn, _=Depends(current_admin)):
    r = await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_pw(body.password)}})
    if not r.matched_count:
        raise HTTPException(404, "Account not found")
    return {"ok": True}


@api.delete("/admin/accounts/{uid}")
async def admin_delete_account(uid: str, _=Depends(current_admin)):
    ids = [c["id"] async for c in db.characters.find({"account_id": uid}, {"id": 1})]
    if any(i in game.players for i in ids):
        raise HTTPException(400, "A character on this account is currently in the world")
    r = await db.users.delete_one({"id": uid})
    if not r.deleted_count:
        raise HTTPException(404, "Account not found")
    await db.characters.delete_many({"account_id": uid})
    return {"ok": True}


@api.put("/admin/accounts/{uid}/ban")
async def admin_ban(uid: str, body: AdminBanIn, _=Depends(current_admin)):
    until = (datetime.now(timezone.utc) + timedelta(days=body.days)).isoformat() if body.days else None
    r = await db.users.update_one({"id": uid}, {"$set": {"ban": {"until": until, "reason": body.reason.strip()}}})
    if not r.matched_count:
        raise HTTPException(404, "Account not found")
    msg = ban_text(await db.users.find_one({"id": uid}))
    for p in [p for p in game.players.values() if p.account_id == uid]:
        await game.kick(p, msg)
    return {"ok": True, "message": msg}


@api.delete("/admin/accounts/{uid}/ban")
async def admin_unban(uid: str, _=Depends(current_admin)):
    r = await db.users.update_one({"id": uid}, {"$unset": {"ban": ""}})
    if not r.matched_count:
        raise HTTPException(404, "Account not found")
    return {"ok": True}


@api.post("/admin/characters/{cid}/kick")
async def admin_kick(cid: str, body: AdminTextIn | None = None, _=Depends(current_admin)):
    p = game.players.get(cid)
    if not p:
        raise HTTPException(400, "Character is not in the world")
    await game.kick(p, "You were kicked by an admin." + (f" Reason: {body.text}" if body else ""))
    return {"ok": True}


@api.get("/admin/bots")
async def admin_bots(_=Depends(current_admin)):
    import bots
    chars = await db.characters.find({"account_id": bots.BOT_ACCOUNT}, {"_id": 0, "id": 1, "name": 1, "cls": 1, "level": 1, "bot_slot": 1}).to_list(20)
    chars.sort(key=lambda c: c.get("bot_slot", 99))
    return {"enabled": getattr(game, "bots_enabled", True), "count": getattr(game, "bot_count", 4), "chat": getattr(game, "bot_chat", False),
            "bots": [admin_char(c) for c in chars]}


class AdminBotsIn(BaseModel):
    enabled: bool | None = None
    count: int | None = Field(None, ge=0, le=12)
    chat: bool | None = None


@api.put("/admin/bots")
async def admin_set_bots(body: AdminBotsIn, _=Depends(current_admin)):
    import bots
    await bots.save_cfg(game, db, **{k: v for k, v in body.model_dump().items() if v is not None})
    return {"enabled": game.bots_enabled, "count": game.bot_count, "chat": game.bot_chat}


@api.post("/admin/bots/{cid}/reset")
async def admin_bot_reset(cid: str, _=Depends(current_admin)):
    import bots
    if not await bots.reset_bot(game, db, cid):
        raise HTTPException(404, "Bot not found")
    return {"ok": True}


@api.post("/admin/bots/{cid}/teleport")
async def admin_bot_teleport(cid: str, _=Depends(current_admin)):
    import bots
    b = next((b for b in getattr(game, "bot_list", []) if b.p.id == cid and game.players.get(cid) is b.p), None)
    if not b:
        raise HTTPException(400, "Bot is not in the world")
    if b.p.dead_until:
        raise HTTPException(400, "Bot is dead — it will respawn in town shortly")
    if b.raid:
        b.end_raid("teleported by admin")
    game.teleport(b.p, *bots.town_spot(b.p))
    b.state = "rest"
    return {"ok": True}


@api.post("/admin/broadcast")
async def admin_broadcast(body: AdminTextIn, _=Depends(current_admin)):
    game.announce(body.text.strip())
    return {"ok": True, "online": len(game.players)}


def live_edit(p, level, gold):
    if level is not None and level != p.level:
        p.attr_points = max(0, p.attr_points + ATTR_POINTS_PER_LEVEL * (level - p.level))
        p.level, p.xp = level, XP_TABLE[level]
        p.recalc()
        p.hp, p.mp = p.max_hp, p.max_mp
        game.grant_spells(p)
    if gold is not None:
        p.gold = gold
    p.dirty = True
    p.send({"t": "sys", "msg": "An admin has adjusted your character.", "kind": "info"})


@api.put("/admin/characters/{cid}")
async def admin_edit_char(cid: str, body: AdminCharIn, _=Depends(current_admin)):
    live = game.players.get(cid)
    if body.level is None and body.gold is None:
        raise HTTPException(400, "Nothing to update")
    if live:
        live_edit(live, body.level, body.gold)
        await game.save(live)
        return admin_char(await db.characters.find_one({"id": cid}, {"_id": 0}))
    old = await db.characters.find_one({"id": cid}, {"_id": 0, "level": 1, "attr_points": 1, "skill_points": 1})
    if not old:
        raise HTTPException(404, "Character not found")
    upd, inc = {}, {}
    if body.level is not None and body.level != old["level"]:
        upd |= {"level": body.level, "xp": XP_TABLE[body.level]}
        d = body.level - old["level"]
        upd |= {"attr_points": max(0, old.get("attr_points", 0) + ATTR_POINTS_PER_LEVEL * d)}
    if body.level is not None:
        upd |= {"level": body.level, "xp": XP_TABLE[body.level]}
    if body.gold is not None:
        upd["gold"] = body.gold
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.characters.update_one({"id": cid}, {"$set": upd} | ({"$inc": inc} if inc else {}))
    return admin_char(await db.characters.find_one({"id": cid}, {"_id": 0}))


@api.delete("/admin/characters/{cid}")
async def admin_delete_char(cid: str, _=Depends(current_admin)):
    if cid in game.players:
        raise HTTPException(400, "Character is currently in the world")
    r = await db.characters.delete_one({"id": cid})
    if not r.deleted_count:
        raise HTTPException(404, "Character not found")
    return {"ok": True}


@api.get("/game/data")
async def game_data():
    return public_data()


@api.get("/game/world")
async def world_data():
    return Response(_world_json, media_type="application/json")


@api.get("/game/status")
async def status():
    return {"online": len(game.players), "monsters": len(game.monsters), "loot": len(game.loot), "tick_ms": round(game.tick_ms, 2)}


@api.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    token, cid = ws.query_params.get("token"), ws.query_params.get("char")
    u = await user_from_token(token) if token else None
    doc = await db.characters.find_one({"id": cid, "account_id": u["id"]}, {"_id": 0}) if u else None
    await ws.accept()
    if not doc:
        await ws.close(code=4401 if not u else 4403)
        return
    await db.users.update_one({"id": u["id"]}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    p = await game.attach(doc, ws, admin=u["email"].lower() in ADMIN_EMAILS)
    queue = p.queue

    async def writer():
        while True:
            msg = await queue.get()
            await ws.send_text(json.dumps(msg, separators=(",", ":")))

    wtask = asyncio.create_task(writer())
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > 4000:
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if isinstance(msg, dict) and await game.handle(p, msg) == "logout":
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws error")
    finally:
        wtask.cancel()
        game.detach(p, ws)
        try:
            await ws.close()
        except Exception:
            pass


@app.on_event("startup")
async def startup():
    global game, _world_json
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.characters.create_index("id", unique=True)
    await db.characters.create_index("name_lower", unique=True)
    await db.characters.create_index("account_id")
    await db.login_attempts.create_index("identifier")
    await db.chat.create_index("ts")
    await db.bounty_claims.create_index("ts")
    await db.castle_runs.create_index([("ts", 1), ("secs", 1)])
    await db.meta.update_one({"_id": "schema"}, {"$set": {"version": 1}}, upsert=True)
    from world import GOH, OLD_GOH
    if not await db.meta.find_one({"_id": "map_south_sea"}):
        r = await db.characters.update_many({"z": {"$gt": OLD_GOH}}, {"$inc": {"z": GOH - OLD_GOH}})
        await db.meta.update_one({"_id": "map_south_sea"}, {"$set": {"shift": GOH - OLD_GOH, "moved": r.modified_count}}, upsert=True)
        log.info("Map south-sea migration: moved %d dungeon characters", r.modified_count)
    game = Game(db)
    _world_json = json.dumps(game.world.client_payload(), separators=(",", ":"))
    game.start()
    import bots
    asyncio.ensure_future(bots.run_bots(game, db))
    log.info("Velandria world ready: %d monsters, %d trees", len(game.monsters), len(game.world.trees))


@app.on_event("shutdown")
async def shutdown():
    for p in list(game.players.values()):
        await game.save(p)
    client.close()


app.include_router(api)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])
