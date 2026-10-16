from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

import os, re, json, logging, asyncio, uuid
from datetime import datetime, timezone, timedelta
import bcrypt, jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import Response
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from game import Game, new_character_doc
from game_data import public_data, CLASSES, clean_look

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("server")
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_ALG = "HS256"
app = FastAPI()
api = APIRouter(prefix="/api")
game: Game = None
_world_json = None


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
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})


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
    return {"game": "Titus Realms", "online": len(game.players) if game else 0}


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
    p = await game.attach(doc, ws)
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
    await db.meta.update_one({"_id": "schema"}, {"$set": {"version": 1}}, upsert=True)
    game = Game(db)
    _world_json = json.dumps(game.world.client_payload(), separators=(",", ":"))
    game.start()
    log.info("Titus Realms world ready: %d monsters, %d trees", len(game.monsters), len(game.world.trees))


@app.on_event("shutdown")
async def shutdown():
    for p in list(game.players.values()):
        await game.save(p)
    client.close()


app.include_router(api)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])
