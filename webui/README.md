# Nanobot WebUI

Web management panel for [Nanobot](../) — a multi-channel AI agent framework.

## Features

- **Dashboard** — channel status, session/skill/cron stats at a glance
- **Chat** — direct conversation with the agent via WebSocket
- **Providers** — configure API keys for OpenAI, Anthropic, DeepSeek, etc.
- **Channels** — view and configure all messaging channels (Telegram, Discord, etc.)
- **MCP Servers** — manage Model Context Protocol tool servers
- **Skills** — view and edit agent skills (workspace skills are editable)
- **Cron Jobs** — create / edit / toggle scheduled tasks
- **Agent Settings** — defaults for model, temperature, token limits, workspace, etc.
- **Users** — multi-user management with admin / user roles

## Quick Start

### Development

**Prerequisites**: Python ≥ 3.11, [Bun](https://bun.sh) ≥ 1.0

```bash
# Backend (from repo root)
pip install -e ".[full]"
pip install fastapi "uvicorn[standard]" "PyJWT>=2.8.0" bcrypt python-multipart

python -m webui          # starts on :8080
# or specify host/port:
python -m webui --host 0.0.0.0 --port 8080

# Frontend (separate terminal)
cd webui/web
bun install
bash scripts/install-shadcn.sh   # install shadcn/ui components (first time only)
bun dev                           # starts on :5173, proxies /api → :8080
```

Open http://localhost:5173 — default credentials: `admin / nanobot`

### Production

```bash
# Build frontend
cd webui/web
bun run build          # outputs to dist/

# Run backend (serves dist/ as static files)
python -m webui --host 0.0.0.0 --port 8080
```

### Docker

```bash
cd webui
docker compose up --build
```

Open http://localhost:8080

## Architecture

```
webui/
├── api/                  # FastAPI backend (zero-invasion — no nanobot source changes)
│   ├── auth.py           # JWT + bcrypt helpers
│   ├── users.py          # UserStore (~/.nanobot/webui_users.json)
│   ├── deps.py           # FastAPI dependency injection
│   ├── gateway.py        # ServiceContainer + server lifecycle
│   ├── server.py         # FastAPI app factory
│   ├── channel_ext.py    # ExtendedChannelManager (subclass, non-invasive)
│   └── routes/           # One file per domain (auth, config, channels, …)
├── web/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/        # One page per route
│   │   ├── components/   # Shared components + layout + chat
│   │   ├── hooks/        # TanStack Query hooks
│   │   ├── stores/       # Zustand state (auth, chat)
│   │   ├── lib/          # axios instance, WebSocket manager, utils
│   │   └── i18n/         # zh / en translations
│   └── nginx.conf        # Production nginx config
├── __main__.py           # Entry point: python -m webui
└── pyproject.toml        # webui package metadata
```

## Authentication

- First launch auto-creates `admin / nanobot` — **change immediately**
- Credentials stored in `~/.nanobot/webui_users.json` (bcrypt hashed)
- JWT tokens expire after 7 days
- JWT secret rotates on each restart (stored in `~/.nanobot/webui_secret.key`)

## Environment

All configuration is inherited from nanobot's standard config at `~/.nanobot/config.yaml`.  
No additional env vars are required.

## Tech Stack

| Layer | Library |
|-------|---------|
| Backend | FastAPI + Uvicorn + PyJWT + bcrypt |
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand + TanStack Query v5 |
| i18n | react-i18next (zh / en) |
| Theme | next-themes (light / dark / system) |
| Real-time | WebSocket (`/ws/chat`) |
