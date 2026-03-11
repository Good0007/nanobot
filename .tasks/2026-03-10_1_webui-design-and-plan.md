# 背景

文件名：2026-03-10_1
创建于：2026-03-10_20:14:00
创建者：kangkang
主分支：main
任务分支：task/webui-design-and-plan_2026-03-10_1
Yolo 模式：Off

---

# 任务描述

为 nanobot 项目开发对应的 Web 管理页面，对项目的配置、MCP、Skills、接入渠道等进行管理，实现热更新。同时提供 Web 端的对话 UI 界面。

**约束条件**：
- 后端：Python FastAPI，与现有 asyncio 运行时同进程集成
- 前端：React + TypeScript + shadcn/ui
- 多用户隔离：JWT 鉴权，用户独立 session
- 热更新：支持单渠道热重载 + 全量重载
- 部署：前后端分离，独立 `webui/` 目录，安装为 optional dependency

---

# 项目概览

nanobot 是一个超轻量级个人 AI 助手，~4000 行核心代码。架构关键点：

| 组件 | 说明 |
|------|------|
| `AgentLoop` | ReAct 主循环，`process_direct()` 支持多 session |
| `ChannelManager` | 管理 10 个 IM 渠道，各渠道为独立 asyncio Task |
| `Config` (Pydantic) | `load_config()`/`save_config()` 读写 `~/.nanobot/config.json` |
| `CronService` | 定时任务，监听 `jobs.json` mtime 实现外部热更新 |
| `SessionManager` | JSONL append-only，session key = `channel:chat_id` |
| `MessageBus` | pub/sub，新 WebChannel 可直接接入 |
| `SkillsLoader` | 双层优先级（workspace > builtin）|

**数据路径**：
- Config：`~/.nanobot/config.json`
- Sessions：`{workspace}/sessions/{channel}:{chat_id}.jsonl`
- Memory：`{workspace}/MEMORY.md`, `HISTORY.md`
- Cron：`~/.nanobot/cron/jobs.json`
- Skills：`nanobot/skills/`（内置）、`{workspace}/skills/`（自定义）

---

⚠️ 警告：永远不要修改此部分 ⚠️

**RIPER-5 核心协议规则**：
1. 未经明确许可，不能在模式之间转换
2. 必须在每个响应开头声明当前模式 `[MODE: MODE_NAME]`
3. EXECUTE 模式下必须 100% 忠实遵循计划中的清单
4. REVIEW 模式下必须标记即使最小的偏差
5. EXECUTE 模式只有在明确的 "ENTER EXECUTE MODE" 命令后才能进入
6. 默认对话开始处于 RESEARCH 模式

⚠️ 警告：永远不要修改此部分 ⚠️

---

# 分析

## 核心架构观察

### 1. FastAPI 集成点
`cli/commands.py` 的 `gateway()` 函数内有 `asyncio.gather(agent.run(), channels.start_all())`，只需在此处加入 `uvicorn.Server.serve()` 协程即可同进程集成 FastAPI。

### 2. 热更新基础设施
`ChannelManager._init_channels()` 在启动时一次性初始化所有渠道。需要重构，提取 `_init_single_channel(name)` 并新增 `reload_channel(name)` / `reload_all()`。`CronService` 已有 mtime 监听模式可作参考。

### 3. 多用户隔离
`AgentLoop.process_direct(message, session_key, ...)` 已支持任意 session key。Web 用户使用 `web:{user_id}` 格式，session 完全隔离，无需改动 AgentLoop 核心。

### 4. WebSocket 渠道
WebSocket 对话端点可以作为虚拟渠道，通过 `MessageBus` 与 `AgentLoop` 通信，和 Telegram/Slack 地位对等，但实际实现上直接调用 `process_direct()` 更简洁。

### 5. 配置写入安全
`save_config()` 直接覆盖写入，热更新 API 需要先验证新配置（Pydantic model_validate），再写入磁盘，再触发渠道重载。

### 6. 侵入性评估（审查修订）

原计划 Phase 3 包含两个「修改」操作，均违反零侵入约束：

| 原计划 | 问题 | 修订方案 |
|--------|------|----------|
| 修改 `nanobot/channels/manager.py`，新增 reload 方法 | 直接改动 nanobot 核心代码 | 在 `webui/api/channel_ext.py` 创建 `ExtendedChannelManager(ChannelManager)` 子类，通过继承实现扩展 |
| 修改 `nanobot/cli/commands.py`，新增 `--web` 参数 | 修改 nanobot 官方 CLI | 在 `webui/__main__.py` 提供独立启动入口，复用 nanobot 内部类，`python -m webui` 代替 `nanobot gateway` |

另：`ChannelManager.get_status()` **已存在**（审查发现），计划中 `get_channel_status()` 为冗余设计，直接使用已有方法。

`ExtendedChannelManager` 扩展策略：
- `update_config(new_config)` → 更新 `self.config` 引用
- `reload_channel(name)` → stop 对应渠道 + 重走同名渠道初始化逻辑 + 重新 create_task 启动
- `reload_all(new_config)` → `update_config()` + `stop_all()` + `_init_channels()` + `start_all()`

### 7. 流式输出限制（审查修订）

`AgentLoop.process_direct()` 的 `on_progress` 回调**仅在工具调用执行期间触发**（工具提示 + 思考内容），不支持最终回复的逐 token 流式输出。

`{"type": "token"}` WebSocket 事件类型**无法实现**，应从协议中删除。当前真实能力：
- 实时推送工具调用进度（`progress`，`tool_hint: true`）
- 实时推送思考内容（`progress`，`tool_hint: false`）
- 最终回复**整体一次性**推送（`done`）

逐 token 流式输出需后续对 AgentLoop 进行扩展（超出当前任务范围）。

---

# 提议的解决方案

## 目录结构

```
nanobot/
└── webui/
    ├── __init__.py
    ├── __main__.py                   # python -m webui 启动入口（零侵入 gateway）
    ├── pyproject.toml                # webui 独立包配置（nanobot-webui）
    ├── api/                          # FastAPI 后端
    │   ├── __init__.py
    │   ├── channel_ext.py            # ExtendedChannelManager 子类（热重载扩展）
    │   ├── gateway.py                # ServiceContainer dataclass + start_api_server 协程
    │   ├── server.py                 # FastAPI app 工厂（路由注册 + 中间件）
    │   ├── auth.py                   # JWT(HS256/PyJWT) + bcrypt 密码工具
    │   ├── users.py                  # UserStore (users.json CRUD)
    │   ├── deps.py                   # get_services, get_current_user, require_admin
    │   ├── models.py                 # 全部 Pydantic request/response schema
    │   ├── middleware.py             # CORS
    │   └── routes/
    │       ├── __init__.py
    │       ├── auth.py               # POST /auth/login, GET /auth/me, PUT /auth/password
    │       ├── config.py             # GET/PATCH /config/agent, /config/gateway
    │       ├── channels.py           # GET /channels, PATCH /channels/{name}, POST /channels/{name}/reload, POST /channels/reload-all
    │       ├── providers.py          # GET /providers, PATCH /providers/{name}
    │       ├── mcp.py                # CRUD /mcp/servers
    │       ├── skills.py             # GET/POST/PUT/DELETE /skills
    │       ├── cron.py               # CRUD /cron/jobs
    │       ├── sessions.py           # GET/DELETE /sessions, GET /sessions/{key}/memory
    │       └── ws.py                 # WS /ws/chat
    └── web/                          # React 前端
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── tailwind.config.ts
        ├── components.json
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── i18n/
            │   ├── index.ts
            │   └── locales/
            │       ├── zh.json
            │       └── en.json
            ├── theme/
            │   └── ThemeProvider.tsx
            ├── stores/
            │   ├── authStore.ts
            │   └── chatStore.ts
            ├── lib/
            │   ├── api.ts
            │   ├── ws.ts
            │   └── utils.ts
            ├── hooks/
            │   ├── useConfig.ts
            │   ├── useChannels.ts
            │   ├── useProviders.ts
            │   ├── useMCP.ts
            │   ├── useSkills.ts
            │   ├── useCron.ts
            │   └── useSessions.ts
            ├── components/
            │   ├── ui/               # shadcn/ui 组件
            │   ├── layout/
            │   │   ├── AppLayout.tsx
            │   │   ├── Sidebar.tsx
            │   │   └── Header.tsx
            │   ├── chat/
            │   │   ├── ChatWindow.tsx
            │   │   ├── MessageBubble.tsx
            │   │   ├── ToolCallCard.tsx
            │   │   ├── ThinkingBlock.tsx
            │   │   └── ChatInput.tsx
            │   └── shared/
            │       ├── StatusBadge.tsx
            │       ├── ConfirmDialog.tsx
            │       └── SecretInput.tsx
            └── pages/
                ├── Login.tsx
                ├── Dashboard.tsx
                ├── Chat.tsx
                ├── Providers.tsx
                ├── Channels.tsx
                ├── MCPServers.tsx
                ├── Skills.tsx
                ├── CronJobs.tsx
                ├── AgentSettings.tsx
                └── Users.tsx
```

## 技术栈

### 后端
| 库 | 版本 | 用途 |
|---|---|---|
| fastapi | >=0.115 | Web 框架 |
| uvicorn[standard] | >=0.30 | ASGI 服务器 |
| PyJWT | >=2.8.0 | JWT 签发/验证（`python-jose` 有 CVE-2024-33664，弃用） |
| bcrypt | >=4.1 | 密码哈希 |
| python-multipart | >=0.0.9 | 表单解析 |

### 前端
| 库 | 版本 | 用途 |
|---|---|---|
| react + react-dom | ^18.3 | UI 框架 |
| react-router-dom | ^6.x | 路由 |
| @tanstack/react-query | ^5.x | 服务端状态管理 |
| zustand | ^4.x | 客户端状态 |
| axios | ^1.x | HTTP 客户端 |
| react-i18next + i18next | ^14/^23 | 国际化 |
| next-themes | ^0.3 | 主题切换 |
| react-markdown + rehype-highlight | ^9/^7 | Markdown 渲染 |
| sonner | ^1.x | Toast 通知 |
| shadcn/ui + tailwindcss | latest/^3 | UI 组件库 |

## API 路由总表

| 路由 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/auth/login` | POST | 公开 | JWT 登录 |
| `/auth/me` | GET | 用户 | 当前用户信息 |
| `/auth/password` | PUT | 用户 | 修改密码 |
| `/config/agent` | GET/PATCH | admin | Agent 参数 |
| `/config/gateway` | GET/PATCH | admin | Gateway 配置 |
| `/channels` | GET | admin | 渠道列表+状态 |
| `/channels/{name}` | PATCH | admin | 更新渠道配置 |
| `/channels/{name}/reload` | POST | admin | 单渠道热重载 |
| `/channels/reload-all` | POST | admin | 全量重载 |
| `/providers` | GET | admin | Provider 列表 |
| `/providers/{name}` | PATCH | admin | 更新 API Key |
| `/mcp/servers` | GET/POST | admin | MCP 列表/新增 |
| `/mcp/servers/{name}` | PUT/DELETE | admin | 更新/删除 |
| `/skills` | GET | 用户 | 技能列表 |
| `/skills/{name}` | GET/PUT/DELETE | 用户/admin | 读取/写入/删除 |
| `/cron/jobs` | GET/POST | admin | 定时任务 |
| `/cron/jobs/{id}` | PUT/DELETE | admin | 更新/删除 |
| `/sessions` | GET | 用户 | 会话列表 |
| `/sessions/{key}` | DELETE | 用户 | 清空会话 |
| `/sessions/{key}/messages` | GET | 用户 | 获取会话消息历史（Chat 页回显） |
| `/sessions/{key}/memory` | GET | 用户 | 读取记忆文件（MEMORY.md） |
| `/users` | GET/POST | admin | 用户管理 |
| `/users/{id}` | DELETE | admin | 删除用户 |
| `/ws/chat` | WS | 用户 | 实时对话 |

## WebSocket 消息协议

**客户端 → 服务端**：
```json
{"type": "message", "content": "用户输入"}
{"type": "cancel"}
{"type": "new_session"}
```

**服务端 → 客户端**：
```json
{"type": "session_info", "session_key": "web:uuid4"}
{"type": "progress", "content": "web_search(\"query\")", "tool_hint": true}
{"type": "progress", "content": "LLM 思考内容...", "tool_hint": false}
{"type": "done", "content": "完整最终回复（整体一次性推送）"}
{"type": "error", "content": "错误信息 / cancelled"}
```

> **注意（审查修订）**：`AgentLoop.process_direct()` 的 `on_progress` 回调仅在工具调用期间触发，**不支持逐 token 流式输出**。最终回复通过 `done` 事件整体推送，不存在 `token` 事件类型。如需逐 token 流式，需后续扩展 AgentLoop。

## 热更新流程

```
PATCH /channels/{name}
  ↓
验证新配置 (Pydantic model_validate)
  ↓
save_config() 写入 config.json
  ↓
ExtendedChannelManager.update_config(new_config)   ← webui 子类方法
  ↓
POST /channels/{name}/reload
  ↓
ExtendedChannelManager.reload_channel(name):
  await channels[name].stop()
  del channels[name]
  重走对应渠道初始化逻辑（子类内部实现，不依赖 nanobot 源码改动）
  asyncio.create_task(_start_channel(name, channels[name]))
```

> **MCP 热更新限制**：`AgentLoop._mcp_servers` 是启动时固化的内部状态，v1 中 **MCP 配置变更需要重启 webui 服务生效**，页面中以 inline Alert 提示用户。

## 用户存储格式

文件：`~/.nanobot/webui_users.json`
```json
{
  "users": [
    {
      "id": "uuid4",
      "username": "admin",
      "password_hash": "$2b$12$...",
      "role": "admin",
      "created_at": "2026-03-10T00:00:00"
    }
  ]
}
```
首次启动若文件不存在，自动创建 `admin/nanobot` 默认账户。

## UI 设计规范

### 1. 设计系统

#### 色彩体系（Tailwind CSS v3，`class` 深色模式策略）

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| bg-base | slate-50 `#F8FAFC` | slate-950 `#020617` | 页面背景 |
| bg-surface | white `#FFFFFF` | slate-900 `#0F172A` | 卡片/面板 |
| bg-elevated | white + shadow | slate-800 `#1E293B` | 弹窗/下拉 |
| border | slate-200 `#E2E8F0` | slate-700 `#334155` | 分隔线/边框 |
| text-primary | slate-900 `#0F172A` | slate-50 `#F8FAFC` | 正文 |
| text-secondary | slate-500 `#64748B` | slate-400 `#94A3B8` | 次要文字 |
| text-muted | slate-400 `#94A3B8` | slate-500 `#64748B` | 占位符/提示 |
| primary | sky-500 `#0EA5E9` | sky-400 `#38BDF8` | 主操作色 |
| primary-hover | sky-600 `#0284C7` | sky-300 `#7DD3FC` | 主操作悬停 |
| destructive | red-500 `#EF4444` | red-400 `#F87171` | 危险/删除 |
| success | emerald-500 `#10B981` | emerald-400 `#34D399` | 已连接/成功 |
| warning | amber-500 `#F59E0B` | amber-400 `#FBBF24` | 警告/注意 |

#### 字体

```
正文字体:  Inter（@fontsource/inter）
代码字体:  JetBrains Mono（@fontsource/jetbrains-mono）

字号规格:
  xs:   12px / 1.5  — badge、tag、辅助说明
  sm:   13px / 1.5  — 次要文字、表格内容
  base: 14px / 1.6  — 默认正文
  lg:   16px / 1.5  — 小标题、卡片标题
  xl:   20px / 1.4  — 页面副标题
  2xl:  24px / 1.3  — 页面主标题

字重: 400 / 500 / 600 / 700
```

#### 间距 & 圆角 & 阴影

```
间距基数: 4px，常用: 8 12 16 20 24 32 40 48px

圆角:
  rounded-sm   4px   — badge、tag
  rounded      6px   — button、input
  rounded-md   8px   — card、dropdown
  rounded-lg   12px  — dialog、sheet
  rounded-full       — 头像、状态圆点

阴影:
  shadow-xs: 0 1px 2px   rgb(0 0 0 / 0.05)  — 卡片
  shadow-sm: 0 1px 3px   rgb(0 0 0 / 0.10)  — 下拉
  shadow-md: 0 4px 12px  rgb(0 0 0 / 0.10)  — Dialog
  shadow-lg: 0 8px 24px  rgb(0 0 0 / 0.12)  — Sheet
```

---

### 2. 布局规范

```
Sidebar 宽度: 240px（展开）/ 64px（折叠）
Header 高度: 56px
最小视口:    1024px（桌面优先，不面向移动端）
内容最大宽: 1280px

z-index: sidebar 10 / header 20 / dropdown 30 / sheet 40 / dialog 50 / toast 60
```

整体线框：
```
┌─ Sidebar (240px) ──┬──── Header (56px) ────────────────────────┐
│ 🐈 nanobot v0.1.x │ [Page Title]              [User Menu ▾]   │
├────────────────────┼───────────────────────────────────────────┤
│ ● Chat             │                                           │
│   Dashboard        │          Page Content Area                │
│   Providers        │          (padding 24px, overflow-y auto)  │
│   Channels         │                                           │
│   MCP Servers      │                                           │
│   Skills           │                                           │
│   Cron Jobs        │                                           │
│   Agent Settings   │                                           │
│   ─ ─ ─ ─ ─ ─ ─   │                                           │
│   Users (admin)    │                                           │
│                    │                                           │
│ ────────────────── │                                           │
│ [🌐 Lang] [☀ Mode] │                                           │
│ [Avatar] [Username]│                                           │
└────────────────────┴───────────────────────────────────────────┘
```

---

### 3. 交互规范

**组件状态**：
- Loading：首次加载用 Skeleton 骨架屏；操作中用 Button Spinner
- Empty：居中图标 + 说明文字 + 主操作按钮
- Error：红色 Alert 横幅 + 错误摘要 + 重试按钮
- Hover：背景色加深一档（slate-50 → slate-100）
- Focus：2px `primary` 色 outline-ring

**Toast 通知**（sonner，右下角）：
- 成功：✓ green，3s 自动消失
- 失败：✗ red，5s，可手动关闭
- 热重载中：⟳ loading toast，完成后替换为成功/失败

**确认 Dialog**（危险操作必须二次确认）：
- 场景：删除用户/Cron/MCP Server/Skill、清空会话
- 格式：标题 `确认删除 {name}？` + 影响描述 + [取消] [删除（destructive）]

---

### 4. 页面详细规范

#### 4.1 登录页 `/login`

```
全屏背景: 深色渐变 slate-950→slate-900 / 浅色纯白
右上角: [ZH/EN] [☀/🌙]

中央卡片（宽 400px, rounded-xl, shadow-xl）:
  ┌──────────────────────────────────────┐
  │  🐈 nanobot                          │
  │  Personal AI Assistant               │
  │  ────────────────────────────────    │
  │  Username                            │
  │  [________________________]          │
  │  Password                            │
  │  [__________________] [👁]           │
  │                                      │
  │  [        Sign In        ]           │
  │                                      │
  │  ⓘ Default: admin / nanobot         │
  └──────────────────────────────────────┘

状态:
  Loading: 按钮 Spinner，输入框 disabled
  Error:   border-destructive + 下方 "用户名或密码错误"
```

#### 4.2 Dashboard `/dashboard`

```
Row 1 — Stats Cards (grid-cols-3):
  [当前模型 claude-opus-4-5]  [启用渠道 5/10]  [今日会话 12]

Row 2 — Channels Status (grid-cols-5):
  每格: [图标] [名称] [● connected / ○ disabled]

Row 3 — 最近会话 Table:
  Session Key | 最近消息预览 | 更新时间 | 操作[→ Chat]
```

#### 4.3 Chat 页 `/chat`

```
┌─ Sessions (280px) ─┬──── Chat Area ─────────────────────────────────┐
│ [+ New Chat]       │  TopBar: [Session ID]    [model ▾]  [🗑 清空]  │
│ [🔍 Search...]     │  ─────────────────────────────────────────────  │
│ ──────────────     │                                                  │
│ Today              │  [ThinkingBlock - 默认折叠]                     │
│ > ● Session1      │  ┌─────────────────────────────────────────┐    │
│   Session2        │  │ 🧠 Thinking...  ▸  (italic, text-muted)│    │
│ Yesterday          │  └─────────────────────────────────────────┘    │
│   Session3        │                                                  │
│                    │  [User 气泡 - 右对齐]                           │
│                    │  bg-sky-50/primary-10, border-primary/20        │
│                    │                                                  │
│                    │  [Bot 气泡 - 左对齐]                            │
│                    │  bg-surface shadow-xs, Markdown 渲染            │
│                    │  代码块: bg-slate-900, 右上角复制按钮            │
│                    │                                                  │
│                    │  [ToolCallCard - 默认折叠]                      │
│                    │  ⚙ web_search("query") · 234ms  ▾              │
│                    │  > 展开：JSON 参数 + 返回结果                    │
│                    │  bg-slate-50/900 border-dashed rounded-md        │
│                    │                                                  │
│                    │  [等待回复: 三点跳动动画]                        │
│                    │  ─────────────────────────────────────────────  │
│                    │  [Textarea - auto-grow max 6行] [Send ▶] [✕]   │
│                    │  Shift+Enter 换行  ✕=中止(仅等待时)             │
└────────────────────┴────────────────────────────────────────────────┘
```

#### 4.4 Providers `/providers`

```
Title: LLM Providers

Table:
Provider     | API Key           | API Base | 操作
───────────────────────────────────────────────────
anthropic    | sk-ant-••••1234   | —        | [Edit]
openai       | — (未配置)        | —        | [Edit]
deepseek     | sk-••••5678       | —        | [Edit]

点击 [Edit] → 内联 Popover（非全屏）:
  ┌────────────────────────────────┐
  │ Edit anthropic                 │
  │ API Key:  [___________] [👁]  │
  │ API Base: [___________]        │
  │ Headers:  [+ Add]             │
  │            [Cancel]  [Save]   │
  └────────────────────────────────┘
```

#### 4.5 Channels `/channels`

```
Title: Channels          操作区: [↺ Reload All]

卡片网格 (grid-cols-3, gap-4):
┌─────────────────────────┐
│  [图标 32px] Telegram   │
│  ─────────────────────  │
│  ● Connected            │  ← StatusBadge
│  [OFF ─────────● ON]   │  ← Switch
│  [Configure  ▶]         │
└─────────────────────────┘

点击 [Configure] → 右侧 Sheet (宽 480px):
  Header: [图标] Configure {Name}
  Body: 配置表单（各渠道字段不同）
    通用: enabled toggle, allow_from (tag input)
    Telegram: token, proxy, group_policy select ...
    Email: IMAP/SMTP 分组 (Collapsible)
  Footer (sticky 56px):
    [Cancel]  [Save Only]  [Save & Reload ↺]

渠道品牌色:
  Telegram #2AABEE / WhatsApp #25D366 / Discord #5865F2
  Feishu #386CF5 / Slack #4A154B / Email #EA4335
  DingTalk #1677FF / QQ #1AABFF / Matrix #0DBD8B
```

#### 4.6 MCP Servers `/mcp`

```
Title: MCP Servers          操作区: [+ Add Server]

列表卡片:
┌──────────────────────────────────────────────────────┐
│ ◆ filesystem                         [Edit] [Delete] │
│ stdio · npx @mcp/server-fs · timeout 30s             │
│ ● Connected · 12 tools                               │
└──────────────────────────────────────────────────────┘

Add/Edit Dialog (宽 520px):
  Server Name: [__________]
  Type: [Auto-detect ▼]

  [stdio]: Command [npx] Args [@mcp/server-fs][×][+ Add]
           Env: [KEY]=[VALUE] [×] [+ Add]

  [sse/http]: URL [https://...] Headers [K]=[V][×][+ Add]

  Timeout: [30] seconds

  ⚠ MCP 配置变更需重启服务生效

  [Cancel]  [Save]
```

#### 4.7 Skills `/skills`

```
Title: Skills               操作区: [+ New Custom Skill]

Tabs: [Built-in (7)] [Custom (2)]

内置技能卡片（只读）:
┌─────────────────────────────────────────────┐
│ github                  ✓ Available   [View] │
│ Interact with GitHub using gh CLI            │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ tmux              ✗ Not available            │
│ Requires: bin `tmux` not found in PATH       │
└─────────────────────────────────────────────┘

自定义技能（可编辑）:
┌─────────────────────────────────────────────┐
│ my-skill                ✓ Available          │
│ workspace/skills/my-skill/SKILL.md           │
│                         [Edit]  [Delete]     │
└─────────────────────────────────────────────┘

[View]/[Edit] → 右侧 Sheet (宽 600px):
  Tabs: [Preview (Markdown)] [Edit (font-mono)]
  Footer: [Cancel] [Save] (仅 Edit tab 可见)
```

#### 4.8 Cron Jobs `/cron`

```
Title: Scheduled Tasks       操作区: [+ New Task]

Table:
Name          | Type  | Schedule         | Next Run     | Status  | Actions
──────────────────────────────────────────────────────────────────────────────
Daily Report  | cron  | 0 9 * * * (UTC) | Tomorrow 09:00| ✓ ok  | [ON ●][Edit][×]
Hourly Check  | every | 1 hour          | in 32 min    | ✓ ok    | [ON ●][Edit][×]

Add/Edit Dialog (宽 500px):
  Name: [________________]

  Schedule Type:
    ( ) At specific time  → DateTime picker
    (●) Repeat every      → [30] [minutes ▼]
    ( ) Cron expression   → [0 9 * * *]  Timezone [UTC ▼]
                            Preview: "Every day at 09:00 UTC"

  Task Message:
  [Textarea: 描述 Agent 应执行的任务...]

  Deliver response: [OFF] → [channel ▼] [Recipient ID]
  Delete after run: [OFF]

  [Cancel]  [Save]
```

#### 4.9 Agent Settings `/settings`

```
Title: Agent Settings

分组 Card 布局（间距 16px）:

┌── Model Configuration ───────────────────────────────────────┐
│ Model:           [anthropic/claude-opus-4-5        ▼]        │
│ Provider:        [auto                             ▼]        │
│ Max Tokens:      [──────────────●──────────] 8192            │
│ Temperature:     [●───────────────────────] 0.1              │
│ Max Iterations:  [40   ]                                     │
│ Memory Window:   [100  ]                                     │
│ Reasoning Effort:[None                             ▼]        │
└──────────────────────────────────────────────────────────────┘

┌── Workspace ─────────────────────────────────────────────────┐
│ Path: [~/.nanobot/workspace                    ] [Browse]    │
│ ⚠ 修改工作区路径需重启服务生效                               │
└──────────────────────────────────────────────────────────────┘

┌── Tools ─────────────────────────────────────────────────────┐
│ Restrict to Workspace: [OFF ─────●]                          │
│ Shell Exec Timeout:    [60] seconds                          │
│ PATH Append:           [/usr/local/bin:...]                  │
│ Web Search API Key:    [____________________] [👁]            │
│ Web Proxy:             [http://127.0.0.1:7890]               │
└──────────────────────────────────────────────────────────────┘

┌── Progress Streaming ────────────────────────────────────────┐
│ Send Progress:   [ON  ●────] 向 IM 渠道推送工具调用进度      │
│ Send Tool Hints: [OFF ─────] 向 IM 渠道推送工具调用名称      │
└──────────────────────────────────────────────────────────────┘

底部 sticky: [Save Changes]（有改动时 primary，无改动时 disabled）
```

#### 4.10 Users `/users`（Admin 专属）

```
Title: Users                 操作区: [+ Add User]

Table:
Username   | Role   | Created    | Actions
──────────────────────────────────────────────────────
admin      | admin  | 2026-03-10 | [Change Password]
alice      | user   | 2026-03-10 | [Change Password] [Delete]

Add User Dialog:
  Username / Password [👁] / Role [user ▼]
  [Cancel]  [Create]

Change Password Dialog:
  New Password [👁] / Confirm [👁]
  [Cancel]  [Update]

限制: 不能删除当前登录账号 · 至少保留 1 个 admin
```

---

### 5. 组件规范补充

**StatusBadge variants**：
```
connected  → bg-emerald-500/10 text-emerald-700  dot: emerald-500（pulse 动画）
disabled   → bg-slate-100 text-slate-500          dot: slate-400
error      → bg-red-500/10 text-red-700           dot: red-500
loading    → spinner 替代 dot（旋转动画）
```

**SecretInput**：
```
默认: type=password，•••••••• 显示
右侧: 👁 切换明文/密文
已有值脱敏展示: sk-ant-••••{末4位}
```

**Sidebar 导航项**：
```
展开态(240px): [Icon 20px] [Label]  active: 左侧主色 2px 竖条 + bg-primary/10 + text-primary font-medium
折叠态(64px):  [Icon 24px 居中]     hover: Tooltip 显示 Label
```

---

### 6. 动效规范

```
页面切换:     fade 100ms ease-in-out
Sidebar 折叠: width transition 200ms ease
Sheet 展开:   slide-in-from-right 200ms ease-out
Dialog 出现:  scale(0.95→1) + fade 150ms ease-out
Toast 出现:   slide-in-from-bottom 200ms ease
Skeleton:     pulse 1.5s infinite
按钮 Loading: spin 1s linear infinite（内嵌 16px Spinner）
```

---

### 7. 响应式注意事项

```
设计基准: 1280px 桌面
< 1280px: Sidebar 自动折叠为图标模式（64px）
< 1024px: 提示建议使用桌面浏览器
Grid 降级: 3列 → 2列（channels、stats cards）
```

## 依赖隔离

```toml
# pyproject.toml 新增
[project.optional-dependencies]
web = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "python-jose[cryptography]>=3.3",
  "bcrypt>=4.1",
  "python-multipart>=0.0.9",
]
```

安装：`pip install nanobot-ai[web]`

---

# 当前执行步骤："待启动"

等待用户输入 `ENTER EXECUTE MODE` 后开始按清单执行。

---

# 任务进度

_（执行阶段开始后在此追加变更记录）_

---

# 实施清单

## Phase 1：后端基础设施

- [ ] 1. 创建 `webui/` 目录结构（所有空目录和 `__init__.py`）
- [ ] 2. 创建 `webui/api/auth.py`（JWT + bcrypt 工具函数）
- [ ] 3. 创建 `webui/api/users.py`（UserStore 类，users.json CRUD）
- [ ] 4. 创建 `webui/api/models.py`（全部 Pydantic request/response schema）
- [ ] 5. 创建 `webui/api/deps.py`（get_services, get_current_user, require_admin）
- [ ] 6. 创建 `webui/api/middleware.py`（CORS 配置）
- [ ] 7. 创建 `webui/api/server.py`（ServiceContainer, create_app, start_api_server）

## Phase 2：后端路由

- [ ] 8.  创建 `webui/api/routes/auth.py`（login, me, password）
- [ ] 9.  创建 `webui/api/routes/config.py`（agent settings, gateway GET/PATCH）
- [ ] 10. 创建 `webui/api/routes/channels.py`（列表, 更新, reload 单个, reload-all）
- [ ] 11. 创建 `webui/api/routes/providers.py`（列表, 更新）
- [ ] 12. 创建 `webui/api/routes/mcp.py`（CRUD）
- [ ] 13. 创建 `webui/api/routes/skills.py`（列表, 读取, 写入, 删除）
- [ ] 14. 创建 `webui/api/routes/cron.py`（CRUD）
- [ ] 15. 创建 `webui/api/routes/sessions.py`（列表, 删除, 读取 memory）
- [ ] 16. 创建 `webui/api/routes/ws.py`（WebSocket /ws/chat 含流式输出）

## Phase 3：webui 独立入口（零侵入 nanobot 核心）

- [ ] 17.  创建 `webui/__main__.py`：复制 `nanobot gateway` 启动逻辑，用 `ExtendedChannelManager` 代替 `ChannelManager`，通过 `asyncio.gather()` 同时启动渠道服务和 FastAPI 服务
- [ ] 17b. 创建 `webui/api/channel_ext.py`：`ExtendedChannelManager(ChannelManager)` 子类，新增 `reload_channel(name)`, `reload_all(new_config)`, `update_config(new_config)` 方法（不修改任何 nanobot 源码）
- [ ] 17c. 创建 `webui/api/gateway.py`：`ServiceContainer` 数据类（持有 `config`、`channel_manager`、`agent_loop` 等引用）+ `start_api_server(container, port)` 协程

## Phase 4：前端工程初始化

- [ ] 19. 创建 `webui/web/package.json`（完整依赖列表）
- [ ] 20. 创建 `webui/web/vite.config.ts`（dev 代理 `/api` → 后端）
- [ ] 21. 创建 `webui/web/tsconfig.json`
- [ ] 22. 创建 `webui/web/tailwind.config.ts`（主题色 + 暗色模式 class 策略）
- [ ] 23. 创建 `webui/web/components.json`（shadcn/ui 配置）
- [ ] 24. 创建 `webui/web/index.html`

## Phase 5：前端核心设施

- [ ] 25. 创建 `src/main.tsx`（ReactDOM + QueryClient + ThemeProvider + i18n）
- [ ] 26. 创建 `src/App.tsx`（路由配置 + PrivateRoute 守卫）
- [ ] 27. 创建 `src/i18n/index.ts` + `locales/zh.json` + `locales/en.json`
- [ ] 28. 创建 `src/theme/ThemeProvider.tsx`（next-themes 集成）
- [ ] 29. 创建 `src/lib/api.ts`（axios 实例 + 401 拦截器）
- [ ] 30. 创建 `src/lib/ws.ts`（WebSocket 连接管理器，重连，消息分发）
- [ ] 31. 创建 `src/lib/utils.ts`（cn(), formatDate(), maskSecret()）
- [ ] 32. 创建 `src/stores/authStore.ts`（Zustand）
- [ ] 33. 创建 `src/stores/chatStore.ts`（Zustand）

## Phase 6：TanStack Query Hooks

- [ ] 34. 创建 `src/hooks/useConfig.ts`
- [ ] 35. 创建 `src/hooks/useChannels.ts`（含 useReloadChannel mutation）
- [ ] 36. 创建 `src/hooks/useProviders.ts`
- [ ] 37. 创建 `src/hooks/useMCP.ts`
- [ ] 38. 创建 `src/hooks/useSkills.ts`
- [ ] 39. 创建 `src/hooks/useCron.ts`
- [ ] 40. 创建 `src/hooks/useSessions.ts`

## Phase 7：前端共享组件 & 布局

- [ ] 41. 创建 `webui/web/scripts/install-shadcn.sh`（批量安装 shadcn 组件）
- [ ] 42. 创建 `src/components/shared/StatusBadge.tsx`
- [ ] 43. 创建 `src/components/shared/ConfirmDialog.tsx`
- [ ] 44. 创建 `src/components/shared/SecretInput.tsx`
- [ ] 45. 创建 `src/components/layout/Sidebar.tsx`（折叠导航 + 语言/主题切换）
- [ ] 46. 创建 `src/components/layout/Header.tsx`（面包屑 + 用户菜单）
- [ ] 47. 创建 `src/components/layout/AppLayout.tsx`

## Phase 8：Chat 组件

- [ ] 48. 创建 `src/components/chat/ChatWindow.tsx`（消息列表 + 滚动到底部）
- [ ] 49. 创建 `src/components/chat/MessageBubble.tsx`（Markdown + 代码高亮）
- [ ] 50. 创建 `src/components/chat/ToolCallCard.tsx`（可折叠工具调用卡片）
- [ ] 51. 创建 `src/components/chat/ThinkingBlock.tsx`（可折叠思考过程）
- [ ] 52. 创建 `src/components/chat/ChatInput.tsx`（Textarea + 发送 + 取消）

## Phase 9：前端页面

- [ ] 53. 创建 `src/pages/Login.tsx`（登录表单 + 主题/语言切换）
- [ ] 54. 创建 `src/pages/Dashboard.tsx`（系统状态 + 渠道状态 + 近期会话）
- [ ] 55. 创建 `src/pages/Chat.tsx`（Sessions 侧边栏 + ChatWindow + WebSocket）
- [ ] 56. 创建 `src/pages/Providers.tsx`（表格 + SecretInput）
- [ ] 57. 创建 `src/pages/Channels.tsx`（卡片网格 + Sheet 配置 + 重载按钮）
- [ ] 58. 创建 `src/pages/MCPServers.tsx`（列表 + Dialog 编辑）
- [ ] 59. 创建 `src/pages/Skills.tsx`（内置/自定义分组 + Markdown 预览 + 编辑）
- [ ] 60. 创建 `src/pages/CronJobs.tsx`（数据表格 + 调度表单 Dialog）
- [ ] 61. 创建 `src/pages/AgentSettings.tsx`（模型/参数/工作区/工具限制表单）
- [ ] 62. 创建 `src/pages/Users.tsx`（用户表格 + 新增 Dialog，admin 专属）

## Phase 10：工程配置

- [ ] 63. 创建 `webui/pyproject.toml`：声明独立包 `nanobot-webui`（依赖 `nanobot-ai`，包含 fastapi / uvicorn / PyJWT / bcrypt / python-multipart 等 web 依赖）
- [ ] 64. 更新 `docker-compose.yml`：新增 webui 前端 build + nginx 服务
- [ ] 65. 创建 `webui/web/nginx.conf`（静态文件 + /api 反向代理）
- [ ] 66. 创建 `webui/README.md`（安装、启动、开发说明）

---

# 最终审查

_（所有实施完成并用户确认后在此总结）_
