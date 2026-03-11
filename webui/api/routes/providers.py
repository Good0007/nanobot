"""Providers routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from webui.api.deps import get_services, require_admin
from webui.api.gateway import ServiceContainer
from webui.api.models import ProviderInfo, UpdateProviderRequest

router = APIRouter()

# All provider field names that exist on ProvidersConfig
_PROVIDER_NAMES = [
    "anthropic", "openai", "openrouter", "deepseek", "groq", "zhipu",
    "dashscope", "vllm", "gemini", "moonshot", "minimax", "aihubmix",
    "siliconflow", "volcengine", "azure_openai", "custom",
    "openai_codex", "github_copilot",
]


def _mask(value: str) -> str:
    if not value:
        return ""
    return f"••••{value[-4:]}" if len(value) > 4 else "••••"


@router.get("", response_model=list[ProviderInfo])
async def list_providers(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> list[ProviderInfo]:
    result = []
    for name in _PROVIDER_NAMES:
        p = getattr(svc.config.providers, name, None)
        if p is None:
            continue
        result.append(
            ProviderInfo(
                name=name,
                api_key_masked=_mask(p.api_key),
                api_base=p.api_base,
                has_key=bool(p.api_key),
            )
        )
    return result


@router.patch("/{name}", response_model=ProviderInfo)
async def update_provider(
    name: str,
    body: UpdateProviderRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> ProviderInfo:
    from nanobot.config.loader import save_config

    p = getattr(svc.config.providers, name, None)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Provider '{name}' not found")

    if body.api_key is not None:
        p.api_key = body.api_key
    if body.api_base is not None:
        p.api_base = body.api_base or None

    save_config(svc.config)
    svc.reload_provider()
    return ProviderInfo(
        name=name,
        api_key_masked=_mask(p.api_key),
        api_base=p.api_base,
        has_key=bool(p.api_key),
    )
