from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import auth, battle, catalog, decks, player, quests, save, world
from app.core.config import settings
from app.db import SessionLocal


@asynccontextmanager
async def lifespan(_: FastAPI):
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": str(exc.detail), "data": None},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "请求参数无效", "data": exc.errors()},
    )


@app.get("/health/live", tags=["health"])
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def ready() -> dict:
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}


for router in (
    auth.router,
    player.router,
    world.router,
    catalog.router,
    decks.router,
    battle.router,
    quests.router,
    save.router,
):
    app.include_router(router, prefix="/api/v1")
