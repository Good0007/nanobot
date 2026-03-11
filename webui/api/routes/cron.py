"""Cron jobs routes (CRUD)."""

from __future__ import annotations

import time
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from webui.api.deps import get_services, require_admin
from webui.api.gateway import ServiceContainer
from webui.api.models import CronJobInfo, CronJobRequest, CronScheduleModel, CronStateModel, CronPayloadModel

router = APIRouter()


def _to_info(job) -> CronJobInfo:
    return CronJobInfo(
        id=job.id,
        name=job.name,
        enabled=job.enabled,
        schedule=CronScheduleModel(
            kind=job.schedule.kind,
            at_ms=job.schedule.at_ms,
            every_ms=job.schedule.every_ms,
            expr=job.schedule.expr,
            tz=job.schedule.tz,
        ),
        payload=CronPayloadModel(
            message=job.payload.message,
            deliver=job.payload.deliver,
            channel=job.payload.channel,
            to=job.payload.to,
        ),
        state=CronStateModel(
            next_run_at_ms=job.state.next_run_at_ms,
            last_run_at_ms=job.state.last_run_at_ms,
            last_status=job.state.last_status,
            last_error=job.state.last_error,
        ),
        delete_after_run=job.delete_after_run,
        created_at_ms=job.created_at_ms,
        updated_at_ms=job.updated_at_ms,
    )


@router.get("/jobs", response_model=list[CronJobInfo])
async def list_jobs(
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> list[CronJobInfo]:
    return [_to_info(j) for j in svc.cron.list_jobs(include_disabled=True)]


@router.post("/jobs", response_model=CronJobInfo, status_code=201)
async def create_job(
    body: CronJobRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> CronJobInfo:
    from nanobot.cron.types import CronSchedule

    try:
        job = svc.cron.add_job(
            name=body.name,
            schedule=CronSchedule(
                kind=body.schedule.kind,
                at_ms=body.schedule.at_ms,
                every_ms=body.schedule.every_ms,
                expr=body.schedule.expr,
                tz=body.schedule.tz,
            ),
            message=body.payload.message,
            deliver=body.payload.deliver,
            channel=body.payload.channel,
            to=body.payload.to,
            delete_after_run=body.delete_after_run,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    if not body.enabled:
        svc.cron.enable_job(job.id, False)
        job = next((j for j in svc.cron.list_jobs(include_disabled=True) if j.id == job.id), job)

    return _to_info(job)


@router.put("/jobs/{job_id}", response_model=CronJobInfo)
async def update_job(
    job_id: str,
    body: CronJobRequest,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> CronJobInfo:
    """Update a job by replacing schedule/payload in-place via store access."""
    from nanobot.cron.types import CronPayload, CronSchedule

    store = svc.cron._load_store()
    job = next((j for j in store.jobs if j.id == job_id), None)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{job_id}' not found")

    job.name = body.name
    job.enabled = body.enabled
    job.delete_after_run = body.delete_after_run
    job.schedule = CronSchedule(
        kind=body.schedule.kind,
        at_ms=body.schedule.at_ms,
        every_ms=body.schedule.every_ms,
        expr=body.schedule.expr,
        tz=body.schedule.tz,
    )
    job.payload = CronPayload(
        kind="agent_turn",
        message=body.payload.message,
        deliver=body.payload.deliver,
        channel=body.payload.channel,
        to=body.payload.to,
    )
    job.updated_at_ms = int(time.time() * 1000)

    # Recompute next run
    from nanobot.cron.service import _compute_next_run
    if job.enabled:
        job.state.next_run_at_ms = _compute_next_run(job.schedule, int(time.time() * 1000))
    else:
        job.state.next_run_at_ms = None

    svc.cron._save_store()
    svc.cron._arm_timer()
    return _to_info(job)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    _admin: Annotated[dict, Depends(require_admin)],
    svc: Annotated[ServiceContainer, Depends(get_services)],
) -> None:
    removed = svc.cron.remove_job(job_id)
    if not removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job '{job_id}' not found")
