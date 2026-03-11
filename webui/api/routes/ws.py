"""WebSocket /ws/chat endpoint."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

router = APIRouter()


async def _auth_websocket(websocket: WebSocket) -> dict | None:
    """Validate the JWT token sent as query param ``token=...``."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return None

    from webui.api.auth import decode_access_token
    from webui.api.users import UserStore
    import jwt

    user_store = websocket.app.state.user_store
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return None

    user = user_store.get_by_id(payload["sub"])
    if not user:
        await websocket.close(code=4001, reason="User not found")
        return None

    return user


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket) -> None:
    """
    WebSocket chat endpoint.

    Query params:
      token=<jwt>              — required for authentication
      session=<session_key>    — optional; if omitted a new ``web:<uid>:<uuid>`` key is created

    Client → Server frames (JSON):
      {"type": "message", "content": "..."}
      {"type": "cancel"}
      {"type": "new_session"}

    Server → Client frames (JSON):
      {"type": "session_info", "session_key": "web:..."}
      {"type": "progress",     "content": "...", "tool_hint": bool}
      {"type": "done",         "content": "..."}
      {"type": "error",        "content": "..."}
    """
    user = await _auth_websocket(websocket)
    if user is None:
        return

    await websocket.accept()
    container = websocket.app.state.services

    if container is None:
        await websocket.send_json({"type": "error", "content": "Services not initialised"})
        await websocket.close()
        return

    # Determine or create session key
    requested_key: str | None = websocket.query_params.get("session")
    session_key = (
        requested_key
        if requested_key and requested_key.startswith(f"web:{user['id']}")
        else f"web:{user['id']}:{uuid.uuid4().hex[:8]}"
    )

    await websocket.send_json({"type": "session_info", "session_key": session_key})

    current_task: asyncio.Task | None = None

    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")

            if msg_type == "cancel":
                if current_task and not current_task.done():
                    current_task.cancel()
                    await websocket.send_json({"type": "error", "content": "cancelled"})

            elif msg_type == "new_session":
                session_key = f"web:{user['id']}:{uuid.uuid4().hex[:8]}"
                await websocket.send_json({"type": "session_info", "session_key": session_key})

            elif msg_type == "message":
                content = raw.get("content", "")
                if not content:
                    continue

                if current_task and not current_task.done():
                    await websocket.send_json({
                        "type": "error",
                        "content": "Previous message still processing",
                    })
                    continue

                async def _on_progress(text: str, *, tool_hint: bool = False) -> None:
                    try:
                        await websocket.send_json({
                            "type": "progress",
                            "content": text,
                            "tool_hint": tool_hint,
                        })
                    except Exception:
                        pass

                async def _run_agent(msg: str, sess: str) -> None:
                    try:
                        response = await container.agent.process_direct(
                            msg,
                            session_key=sess,
                            channel="web",
                            chat_id=user["id"],
                            on_progress=_on_progress,
                        )
                        await websocket.send_json({"type": "done", "content": response})
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:
                        logger.error("WebSocket agent error: {}", exc)
                        try:
                            await websocket.send_json({"type": "error", "content": str(exc)})
                        except Exception:
                            pass

                current_task = asyncio.create_task(_run_agent(content, session_key))

    except WebSocketDisconnect:
        if current_task and not current_task.done():
            current_task.cancel()
    except Exception as exc:
        logger.error("WebSocket error: {}", exc)
        try:
            await websocket.send_json({"type": "error", "content": str(exc)})
        except Exception:
            pass
