import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import auth, devices, events
from .seed import seed_roles_and_admin
from .services.ingest import start_tcp_server

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("voltage")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Redis (pub/sub + ulashilgan klient)
    app.state.redis = aioredis.from_url(settings.redis_url)

    # Rollar + bootstrap admin (jadvallar Alembic orqali yaratilgan bo'lishi kerak)
    try:
        await seed_roles_and_admin()
    except Exception:  # noqa: BLE001
        log.exception(
            "Seed bajarilmadi — avval 'alembic upgrade head' ishga tushiring"
        )

    # ESP32 uchun xom TCP listener (port band bo'lsa ham API ishlayversin)
    server = None
    try:
        server = await start_tcp_server(app.state.redis)
        app.state.tcp_server = server
    except OSError:
        log.exception("TCP listener (:%d) ishga tushmadi", settings.tcp_port)

    try:
        yield
    finally:
        if server is not None:
            server.close()
            await server.wait_closed()
        await app.state.redis.aclose()


app = FastAPI(title="Voltage Monitoring API", version="1.0.0", lifespan=lifespan)

# Eslatma: brauzer "*" origin + credentials kombinatsiyasini rad etadi.
# Auth Bearer token (localStorage) orqali — cookie ishlatilmaydi —
# shuning uchun "*" bo'lsa credentials'siz ruxsat beramiz.
_allow_all = settings.cors_list == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routerlar (static mountdan oldin — ustuvorlik uchun)
app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(events.router)


@app.get("/healthz", tags=["meta"])
async def healthz():
    return {"status": "ok"}


# React (Vite SPA) build natijasini berish + client-route fallback
_dist = settings.frontend_dist
_index = _dist / "index.html"

if (_dist / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

# Yuklangan qurilma rasmlari
settings.media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(settings.media_dir)), name="media")


@app.get("/{full_path:path}", tags=["meta"])
async def spa(full_path: str):
    # API yo'llari yuqorida ro'yxatdan o'tgan — bu yerga faqat frontend so'rovlari keladi
    if not _index.exists():
        return {
            "detail": "Frontend build topilmadi. VoltageFronend ichida "
            "'npm run build' ishga tushiring."
        }
    if full_path:
        candidate = (_dist / full_path).resolve()
        # Path traversal himoyasi: faqat dist ichidagi fayllar
        if candidate.is_file() and candidate.is_relative_to(_dist.resolve()):
            return FileResponse(candidate)
    # Noma'lum yo'l (masalan /admin, /login) -> SPA index.html
    return FileResponse(_index)
