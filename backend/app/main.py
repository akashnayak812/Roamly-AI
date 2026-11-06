"""
Roamly AI — FastAPI Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import time
import uuid
import structlog

from app.core.config import settings
from app.db.database import engine, Base
import app.models.models  # noqa: F401 - register tables for Base.metadata

# Import all routers
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.destinations import router as destinations_router
from app.api.trips import router as trips_router
from app.api.chat import router as chat_router
from app.api.saved import router as saved_router
from app.api.search import router as search_router
from app.api.maps import router as maps_router
from app.api.weather import router as weather_router
from app.api.recommendations import router as recommendations_router
from app.api.voice import router as voice_router
from app.api.places import router as places_router
from app.api.hotels import router as hotels_router
from app.api.events import router as events_router
from app.api.admin import router as admin_router
from app.api.health import router as health_router
from app.api.user_documents import router as user_documents_router
from app.api.documents import router as documents_router

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    log.info("Starting Roamly AI backend", version=settings.APP_VERSION)
    try:
        async with engine.begin() as conn:
            await conn.execute(__import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
        log.info("Database initialized")
    except Exception as e:
        log.warning("Database connection deferred or running without local pgvector instance", error=str(e))
    yield
    log.info("Shutting down Roamly AI backend")
    try:
        await engine.dispose()
    except Exception:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Driven Smart Tourism Recommendation and Travel Planning Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Add X-Request-ID to every request."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    log.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
        request_id=request_id,
    )
    return response


# ── Exception handlers ────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )


# ── Routers ───────────────────────────────────────────────────────────────

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(destinations_router, prefix="/api/destinations", tags=["Destinations"])
app.include_router(trips_router, prefix="/api/trips", tags=["Trips"])
app.include_router(chat_router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(voice_router, prefix="/api/voice", tags=["Voice"])
app.include_router(saved_router, prefix="/api/saved", tags=["Saved"])
app.include_router(search_router, prefix="/api/search", tags=["Search"])
app.include_router(maps_router, prefix="/api/maps", tags=["Maps"])
app.include_router(weather_router, prefix="/api/weather", tags=["Weather"])
app.include_router(recommendations_router, prefix="/api/recommendations", tags=["Recommendations"])
app.include_router(places_router, prefix="/api/places", tags=["Places"])
app.include_router(hotels_router, prefix="/api/hotels", tags=["Hotels"])
app.include_router(events_router, prefix="/api/events", tags=["Events"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(user_documents_router, prefix="/api/user/documents", tags=["User Documents"])
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
