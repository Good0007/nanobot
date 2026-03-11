"""FastAPI application factory."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from webui.api.gateway import ServiceContainer
from webui.api.middleware import setup_cors
from webui.api.users import UserStore


def create_app(container: ServiceContainer | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="nanobot WebUI",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # Attach shared state
    app.state.services = container
    app.state.user_store = UserStore()

    # Middleware
    setup_cors(app)

    # Routes
    from webui.api.routes import (
        auth,
        channels,
        config,
        cron,
        mcp,
        providers,
        sessions,
        skills,
        users,
        ws,
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(config.router, prefix="/api/config", tags=["config"])
    app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
    app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
    app.include_router(mcp.router, prefix="/api/mcp", tags=["mcp"])
    app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
    app.include_router(cron.router, prefix="/api/cron", tags=["cron"])
    app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
    app.include_router(users.router, prefix="/api/users", tags=["users"])
    app.include_router(ws.router, tags=["ws"])

    # Serve built React frontend (optional — only when `pnpm build` has been run)
    web_dist = Path(__file__).parent.parent / "web" / "dist"
    if web_dist.exists():
        assets_dir = web_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        index_html = web_dist / "index.html"

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str):  # noqa: ARG001
            if index_html.exists():
                return FileResponse(str(index_html))
            return {"message": "Frontend not built. Run `pnpm build` in webui/web/"}

    return app
