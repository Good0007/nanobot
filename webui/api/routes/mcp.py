"""MCP servers routes (CRUD)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from webui.api.deps import get_services, require_admin
from webui.api.gateway import ServiceContainer
from webui.api.models import MCPServerInfo, MCPServerRequest

router = APIRouter()


def _to_info(name: str, cfg) -> MCPServerInfo:
    return MCPServerInfo(
        name=name,
        type=cfg.type,
        command=cfg.command,
        args=cfg.args,
        env=cfg.env,
        url=cfg.url,
        headers=cfg.headers,
        timeout=cfg.tool_timeout,
    )


@router.get("/servers", response_model=list[MCPServerInfo])
async def list_mcp_servers(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> list[MCPServerInfo]:
    return [_to_info(name, cfg) for name, cfg in svc.config.tools.mcp_servers.items()]


@router.post("/servers/{name}", response_model=MCPServerInfo, status_code=201)
async def create_mcp_server(
    name: str,
    body: MCPServerRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> MCPServerInfo:
    from nanobot.config.loader import save_config
    from nanobot.config.schema import MCPServerConfig

    if name in svc.config.tools.mcp_servers:
        raise HTTPException(status.HTTP_409_CONFLICT, f"MCP server '{name}' already exists")

    cfg = MCPServerConfig(
        type=body.type,
        command=body.command,
        args=body.args,
        env=body.env,
        url=body.url,
        headers=body.headers,
        tool_timeout=body.timeout,
    )
    svc.config.tools.mcp_servers[name] = cfg
    save_config(svc.config)
    return _to_info(name, cfg)


@router.put("/servers/{name}", response_model=MCPServerInfo)
async def update_mcp_server(
    name: str,
    body: MCPServerRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> MCPServerInfo:
    from nanobot.config.loader import save_config
    from nanobot.config.schema import MCPServerConfig

    if name not in svc.config.tools.mcp_servers:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"MCP server '{name}' not found")

    cfg = MCPServerConfig(
        type=body.type,
        command=body.command,
        args=body.args,
        env=body.env,
        url=body.url,
        headers=body.headers,
        tool_timeout=body.timeout,
    )
    svc.config.tools.mcp_servers[name] = cfg
    save_config(svc.config)
    return _to_info(name, cfg)


@router.delete("/servers/{name}", status_code=204)
async def delete_mcp_server(
    name: str,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> None:
    from nanobot.config.loader import save_config

    if name not in svc.config.tools.mcp_servers:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"MCP server '{name}' not found")

    del svc.config.tools.mcp_servers[name]
    save_config(svc.config)
