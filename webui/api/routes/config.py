"""Config routes: agent settings and gateway config."""

from __future__ import annotations

import datetime
import io
import shutil
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from webui.api.deps import get_services, require_admin
from webui.api.gateway import ServiceContainer
from webui.api.models import (
    AgentSettingsRequest,
    AgentSettingsResponse,
    GatewayConfigRequest,
    GatewayConfigResponse,
    HeartbeatConfigModel,
)

router = APIRouter()

# Workspace markdown files that are allowed to be read/written via the API
_WORKSPACE_FILES = {"AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "HEARTBEAT.md"}


def _mask(value: str) -> str:
    """Mask an API key, showing only the last 4 characters."""
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    return f"••••{value[-4:]}"


@router.get("/agent", response_model=AgentSettingsResponse)
async def get_agent_settings(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> AgentSettingsResponse:
    d = svc.config.agents.defaults
    t = svc.config.tools
    ch = svc.config.channels
    return AgentSettingsResponse(
        model=d.model,
        provider=d.provider,
        max_tokens=d.max_tokens,
        temperature=d.temperature,
        max_iterations=d.max_tool_iterations,
        memory_window=d.memory_window,
        reasoning_effort=d.reasoning_effort,
        workspace=d.workspace,
        restrict_to_workspace=t.restrict_to_workspace,
        exec_timeout=t.exec.timeout,
        path_append=t.exec.path_append,
        web_search_api_key=_mask(t.web.search.api_key),
        web_proxy=t.web.proxy,
        send_progress=ch.send_progress,
        send_tool_hints=ch.send_tool_hints,
    )


@router.patch("/agent", response_model=AgentSettingsResponse)
async def update_agent_settings(
    body: AgentSettingsRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> AgentSettingsResponse:
    from nanobot.config.loader import save_config

    d = svc.config.agents.defaults
    t = svc.config.tools
    ch = svc.config.channels

    if body.model is not None:
        d.model = body.model
    if body.provider is not None:
        d.provider = body.provider
    if body.max_tokens is not None:
        d.max_tokens = body.max_tokens
    if body.temperature is not None:
        d.temperature = body.temperature
    if body.max_iterations is not None:
        d.max_tool_iterations = body.max_iterations
    if body.memory_window is not None:
        d.memory_window = body.memory_window
    if body.reasoning_effort is not None:
        d.reasoning_effort = body.reasoning_effort
    if body.workspace is not None:
        d.workspace = body.workspace
    if body.restrict_to_workspace is not None:
        t.restrict_to_workspace = body.restrict_to_workspace
    if body.exec_timeout is not None:
        t.exec.timeout = body.exec_timeout
    if body.path_append is not None:
        t.exec.path_append = body.path_append
    if body.web_search_api_key is not None:
        t.web.search.api_key = body.web_search_api_key
    if body.web_proxy is not None:
        t.web.proxy = body.web_proxy or None
    if body.send_progress is not None:
        ch.send_progress = body.send_progress
    if body.send_tool_hints is not None:
        ch.send_tool_hints = body.send_tool_hints

    save_config(svc.config)
    svc.reload_provider()
    return await get_agent_settings(_admin, svc)


@router.get("/gateway", response_model=GatewayConfigResponse)
async def get_gateway_config(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> GatewayConfigResponse:
    g = svc.config.gateway
    return GatewayConfigResponse(
        host=g.host,
        port=g.port,
        heartbeat=HeartbeatConfigModel(
            enabled=g.heartbeat.enabled,
            interval_s=g.heartbeat.interval_s,
        ),
    )


@router.patch("/gateway", response_model=GatewayConfigResponse)
async def update_gateway_config(
    body: GatewayConfigRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> GatewayConfigResponse:
    from nanobot.config.loader import save_config

    g = svc.config.gateway
    if body.host is not None:
        g.host = body.host
    if body.port is not None:
        g.port = body.port
    if body.heartbeat_enabled is not None:
        g.heartbeat.enabled = body.heartbeat_enabled
    if body.heartbeat_interval_s is not None:
        g.heartbeat.interval_s = body.heartbeat_interval_s

    save_config(svc.config)
    return await get_gateway_config(_admin, svc)


@router.get("/workspace-file/{name}")
async def get_workspace_file(
    name: str,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> dict:
    if name not in _WORKSPACE_FILES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"File '{name}' not allowed")
    workspace = Path(svc.config.agents.defaults.workspace).expanduser()
    path = workspace / name
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    return {"name": name, "content": content}


@router.put("/workspace-file/{name}")
async def put_workspace_file(
    name: str,
    body: dict,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> dict:
    if name not in _WORKSPACE_FILES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"File '{name}' not allowed")
    content: str = body.get("content", "")
    workspace = Path(svc.config.agents.defaults.workspace).expanduser()
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / name).write_text(content, encoding="utf-8")
    return {"name": name, "content": content}


@router.get("/workspace/export")
async def export_workspace(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> StreamingResponse:
    """Package the entire .nanobot directory as a ZIP for download."""
    from nanobot.config.loader import get_config_path

    nanobot_dir = get_config_path().parent
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if nanobot_dir.exists():
            for f in sorted(nanobot_dir.rglob("*")):
                if f.is_file():
                    zf.write(f, f.relative_to(nanobot_dir))
    buf.seek(0)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"nanobot_backup_{ts}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/workspace/import")
async def import_workspace(
    file: Annotated[UploadFile, File()],
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> dict:
    """Import a .nanobot backup ZIP. Auto-backs up the current .nanobot dir first."""
    from nanobot.config.loader import get_config_path

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .zip files are accepted")

    nanobot_dir = get_config_path().parent
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path: str | None = None

    # Back up the current .nanobot directory before overwriting
    if nanobot_dir.exists() and any(nanobot_dir.iterdir()):
        backup_dir = nanobot_dir.parent / f".nanobot_backup_{ts}"
        shutil.copytree(nanobot_dir, backup_dir)
        backup_path = str(backup_dir)

    # Extract the uploaded zip
    data = await file.read()
    buf = io.BytesIO(data)
    nanobot_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(buf, "r") as zf:
        # Security: reject paths that escape the target directory
        for member in zf.namelist():
            target = (nanobot_dir / member).resolve()
            if not str(target).startswith(str(nanobot_dir.resolve())):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Invalid path in archive: {member}",
                )
        zf.extractall(nanobot_dir)

    return {"ok": True, "backup": backup_path}
