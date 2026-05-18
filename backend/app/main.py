from __future__ import annotations

import logging
import os
import subprocess
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.rate_limit import limiter
from app.api.routes.chokepoints import router as chokepoints_router
from app.api.routes.health import router as health_router
from app.api.routes.indices import router as indices_router
from app.api.routes.insights import router as insights_router
from app.api.routes.ports import router as ports_router
from app.api.routes.stats import router as stats_router
from app.api.routes.story import router as story_router
from app.api.routes.vessels import router as vessels_router

logger = logging.getLogger(__name__)

STARTUP_MAKE_ENV = "GSW_RUN_STARTUP_MAKE"
STARTUP_MAKE_TIMEOUT_SECONDS = 300
STARTUP_MAKE_TARGETS = ("up", "migrate", "collect-all", "seed")
STARTUP_FALLBACK_COMMANDS = (
    ("migrate", ("alembic", "upgrade", "head")),
    ("collect-all", ("celery", "-A", "app.tasks.celery_app", "call", "collect_all")),
    ("seed", ("python", "-m", "app.scripts.seed_reference_data")),
)


def _repo_root() -> Path | None:
    """Return the repository root when the backend can see the root Makefile."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "Makefile").is_file():
            return parent
    return None


def _startup_make_enabled() -> bool:
    """Return whether startup Make targets should run for this process."""
    return os.getenv(STARTUP_MAKE_ENV, "true").lower() in {"1", "true", "yes", "on"}


def _run_startup_make_targets() -> None:
    """Run local bootstrap Make targets when the API process starts."""
    if not _startup_make_enabled():
        logger.info("Startup Make targets disabled by %s", STARTUP_MAKE_ENV)
        return

    root = _repo_root()
    if root is None:
        logger.warning("Repository Makefile is not visible; running in-container startup commands")
        cwd = Path.cwd()
        env = os.environ.copy()
        env[STARTUP_MAKE_ENV] = "false"
        for target, command in STARTUP_FALLBACK_COMMANDS:
            _run_startup_command(target, command, cwd, env)
        return

    env = os.environ.copy()
    env[STARTUP_MAKE_ENV] = "false"
    for target in STARTUP_MAKE_TARGETS:
        _run_startup_command(target, ("make", target), root, env)


def _run_startup_command(
    target: str, command: tuple[str, ...], cwd: Path, env: dict[str, str]
) -> None:
    """Run one startup command and fail startup if it exits unsuccessfully."""
    logger.info("Running startup target %s: %s", target, " ".join(command))
    completed = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=STARTUP_MAKE_TIMEOUT_SECONDS,
    )
    if completed.stdout:
        logger.info("Startup target %s stdout:\n%s", target, completed.stdout.strip())
    if completed.stderr:
        logger.warning("Startup target %s stderr:\n%s", target, completed.stderr.strip())
    if completed.returncode != 0:
        msg = f"Startup target failed: {target} exited {completed.returncode}"
        raise RuntimeError(msg)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Run bootstrap Make targets before serving API traffic."""
    _run_startup_make_targets()
    yield


app = FastAPI(
    title="GlobalSupplyWatch API",
    description="Local supply-chain monitoring API.",
    version="0.1.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "health", "description": "Service liveness checks."},
        {"name": "indices", "description": "Freight and macro index time series."},
        {"name": "vessels", "description": "AIS vessel snapshots and tracks."},
        {"name": "ports", "description": "Port reference and congestion data."},
        {"name": "chokepoints", "description": "Chokepoint reference and risk timelines."},
        {"name": "insights", "description": "Anomalies, correlations, and narratives."},
        {"name": "story", "description": "LLM-assisted two-entity relationship analysis."},
        {"name": "stats", "description": "Dashboard overview metrics."},
    ],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(indices_router, prefix="/api")
app.include_router(vessels_router, prefix="/api")
app.include_router(ports_router, prefix="/api")
app.include_router(chokepoints_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(story_router, prefix="/api")
app.include_router(stats_router, prefix="/api")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a consistent JSON error envelope for unexpected failures."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Unexpected server error", "path": str(request.url.path)},
    )
