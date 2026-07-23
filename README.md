# 斗萝大陆（World Loli）

一款以世界探索、NPC 互动、卡牌战斗和卡灵养成为核心的 Web 游戏 Demo。

当前仓库已经打通从注册登录、角色创建、地图探索，到 NPC 对话、卡牌战斗、植物采集与卡灵赠礼的完整前后端流程。

## 功能概览

- 用户注册、登录与 JWT 身份认证
- 男/女角色选择、地图移动与碰撞
- 晨曦村、微光森林地图探索与传送
- NPC 对话、交互和战斗
- 回合制卡牌战斗、卡组与战斗奖励
- 植物采集、背包管理与刷新限制
- 卡灵图鉴、升级、好感度与赠礼
- 任务、存档和玩家位置同步
- OpenAPI 接口文档与后端端到端测试

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 游戏客户端 | Vue 3、TypeScript、Phaser 3、Pinia、Vite |
| API 服务 | Python、FastAPI、SQLAlchemy |
| 数据库 | PostgreSQL 17 |
| 部署与开发环境 | Docker Compose |
| 测试 | Pytest、FastAPI TestClient |

## 项目结构

```text
world-loli/
├─ game-client/          # Vue + Phaser 游戏客户端
│  ├─ public/assets/     # 游戏运行时美术资源
│  ├─ src/api/           # API 客户端与类型
│  ├─ src/components/    # Vue 界面组件
│  ├─ src/game/          # Phaser 场景、实体与配置
│  └─ src/stores/        # Pinia 状态管理
├─ server/               # FastAPI 服务端
│  ├─ app/api/           # HTTP API 路由
│  ├─ app/core/          # 配置、安全与响应结构
│  ├─ app/services/      # 核心业务逻辑
│  ├─ database/          # 数据库迁移与 Demo 数据
│  └─ tests/             # API 流程测试
└─ doc/                  # 游戏设计与技术设计文档
```

## 快速开始

### 1. 环境要求

- Docker Desktop（包含 Docker Compose）
- Node.js 22
- pnpm

### 2. 启动服务端

在 PowerShell 中执行：

```powershell
Set-Location server
Copy-Item .env.example .env
```

打开 `server/.env`，至少替换以下两项：

```dotenv
POSTGRES_PASSWORD=your-local-database-password
DATABASE_URL=postgresql+psycopg://world:your-local-database-password@postgres:5432/world
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
```

然后启动 PostgreSQL、执行数据库迁移并运行 API：

```powershell
docker compose up --build
```

服务启动后可访问：

- API 健康检查：<http://127.0.0.1:8000/health/ready>
- Swagger 接口文档：<http://127.0.0.1:8000/docs>

### 3. 启动游戏客户端

另开一个 PowerShell 窗口：

```powershell
Set-Location game-client
pnpm install
pnpm dev
```

浏览器访问 <http://localhost:5177>。开发服务器会把 `/api` 请求代理到 `http://127.0.0.1:8000`。

首次进入时直接注册账号即可；注册流程会创建初始角色、卡组和存档数据。

## 开发命令

### 客户端

```powershell
Set-Location game-client

pnpm dev        # 启动开发服务器
pnpm typecheck  # TypeScript 类型检查
pnpm build      # 类型检查并构建生产版本
pnpm preview    # 预览生产构建
```

### 服务端测试

测试会连接真实数据库，并创建后清理临时测试用户。先确保 Docker Compose 服务已启动，再执行：

```powershell
Set-Location server
docker compose exec api pytest
```

当前端到端测试覆盖：

- 注册、登录与异常认证
- 角色资料、地图切换与位置一致性
- NPC 数据与卡组数据
- 完整卡牌战斗及首次胜利奖励
- 植物采集、库存与每日赠礼限制

## 配置说明

服务端读取 `server/.env`：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `POSTGRES_DB` | PostgreSQL 数据库名 | `world` |
| `POSTGRES_USER` | PostgreSQL 用户名 | `world` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | 无，必须设置 |
| `DATABASE_URL` | SQLAlchemy 数据库连接地址 | 无，必须设置 |
| `JWT_SECRET` | JWT 签名密钥，至少 32 个字符 | 无，必须设置 |
| `JWT_ALGORITHM` | JWT 签名算法 | `HS256` |
| `ACCESS_TOKEN_MINUTES` | 登录令牌有效期（分钟） | `120` |
| `CORS_ORIGINS` | 允许的浏览器来源，多个值用逗号分隔 | `http://localhost:5173` |

不要提交真实的 `.env`、数据库密码或 JWT 密钥。

## 数据库迁移

迁移脚本位于 `server/database/`，并按三位数字前缀顺序执行。`docker compose up` 会在 API 启动前自动运行这些脚本。

新增迁移时请：

1. 使用下一个连续编号，例如 `012_feature_name.sql`。
2. 保持迁移可重复执行，或显式处理对象已存在的情况。
3. 同步更新 `server/database/tests/verify_schema.sql`（如涉及结构约束）。
4. 运行后端测试验证已有 Demo 流程未被破坏。

## 常见问题

### 客户端提示“无法连接游戏服务器”

确认 `docker compose ps` 中 `postgres` 和 `api` 均处于运行状态，并访问健康检查接口验证数据库连接。

### API 因配置错误无法启动

检查 `server/.env` 是否存在，并确认：

- `POSTGRES_PASSWORD` 与 `DATABASE_URL` 中的密码一致。
- `DATABASE_URL` 在 Docker Compose 中使用主机名 `postgres`，不是 `localhost`。
- `JWT_SECRET` 长度不少于 32 个字符。

### 端口已被占用

项目默认使用：

- `5177`：游戏客户端
- `8000`：API
- `5432`：PostgreSQL（仅绑定本机）

释放对应端口，或同步修改客户端脚本、Vite 代理及服务端 Compose 配置。

## 当前状态

本项目目前是可联调的游戏 Demo，重点验证核心玩法与前后端数据闭环。设计资料位于 `doc/`；其中包含世界观、卡牌战斗、地图、角色、NPC、数据库、API 以及客户端实现设计。
