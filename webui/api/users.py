"""User store backed by ~/.nanobot/webui_users.json."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from webui.api.auth import hash_password

_USERS_PATH = Path.home() / ".nanobot" / "webui_users.json"


class UserStore:
    """Thread-safe (asyncio single-thread) persistent user store."""

    def __init__(self, path: Path | None = None):
        self._path = path or _USERS_PATH
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_default_admin()

    # ------------------------------------------------------------------
    # Internal persistence
    # ------------------------------------------------------------------

    def _load(self) -> list[dict[str, Any]]:
        if self._path.exists():
            try:
                return json.loads(self._path.read_text(encoding="utf-8")).get("users", [])
            except Exception:
                return []
        return []

    def _save(self, users: list[dict[str, Any]]) -> None:
        self._path.write_text(
            json.dumps({"users": users}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _ensure_default_admin(self) -> None:
        users = self._load()
        if not users:
            users.append(
                {
                    "id": str(uuid.uuid4()),
                    "username": "admin",
                    "password_hash": hash_password("nanobot"),
                    "role": "admin",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            self._save(users)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_by_username(self, username: str) -> dict | None:
        return next((u for u in self._load() if u["username"] == username), None)

    def get_by_id(self, user_id: str) -> dict | None:
        return next((u for u in self._load() if u["id"] == user_id), None)

    def list_users(self) -> list[dict]:
        return [{k: v for k, v in u.items() if k != "password_hash"} for u in self._load()]

    def create_user(self, username: str, password: str, role: str = "user") -> dict:
        users = self._load()
        if any(u["username"] == username for u in users):
            raise ValueError(f"Username '{username}' already exists")
        user: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password_hash": hash_password(password),
            "role": role,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        users.append(user)
        self._save(users)
        return {k: v for k, v in user.items() if k != "password_hash"}

    def update_password(self, user_id: str, new_password: str) -> None:
        users = self._load()
        for u in users:
            if u["id"] == user_id:
                u["password_hash"] = hash_password(new_password)
                self._save(users)
                return
        raise ValueError(f"User {user_id} not found")

    def delete_user(self, user_id: str) -> None:
        users = self._load()
        self._save([u for u in users if u["id"] != user_id])

    def admin_count(self) -> int:
        return sum(1 for u in self._load() if u.get("role") == "admin")
