# 斗萝大陆（World Loli）

一款基于 Vue 3、Phaser 3 与 FastAPI 构建，以世界探索、NPC 互动、回合制卡牌战斗和卡灵养成为核心的 Web RPG Demo。

当前仓库已经打通从注册登录、角色创建、序章演出和地图探索，到 NPC 对话、卡牌战斗、植物采集、卡灵赠礼与存档恢复的完整前后端流程。

## 功能概览

- 用户注册、登录与 JWT 身份认证
- 男/女角色选择、四方向移动、地图碰撞与位置同步
- S0「月痕」开场视频、村长剧情与初始任务交付
- 晨曦村、微光森林地图探索、传送与区域化视觉表现
- NPC 四方向行走、出生点附近巡游、对话、服务与战斗
- 可存档的游戏内昼夜循环、环境光、时间 HUD 与 NPC 作息
- 回合制卡牌战斗、卡组与战斗奖励
- 植物采集、背包管理与刷新限制
- 卡灵图鉴、升级、好感度、赠礼、碎片收集与合成
- 任务、存档和玩家位置同步
- 可选的 AI NPC 动态对话与敌方战斗决策
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
│  ├─ art-source/        # 可追溯的源素材与生成资产
│  ├─ scripts/           # 资源导入和处理脚本
│  ├─ src/api/           # API 客户端与类型
│  ├─ src/components/    # Vue 界面组件
│  ├─ src/game/          # Phaser 场景、实体与配置
│  ├─ src/stores/        # Pinia 状态管理
│  └─ tests/             # 客户端纯逻辑测试
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
pnpm test:time  # 昼夜时间、阶段边界和跨午夜规则测试
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
- 序章状态流、S0 结束处理与初始任务交付
- NPC 数据、服务、好感度与独立卡组
- 完整卡牌战斗、平衡规则、AI 回退与首次胜利奖励
- 植物采集、库存、每日赠礼限制与卡灵碎片合成
- 游戏时间默认值、范围校验、保存恢复与旧存档兼容

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

### AI NPC 配置

AI 对话与战斗决策默认关闭。服务端通过 OpenAI-compatible API 接入模型：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `AI_ENABLED` | AI 总开关 | `false` |
| `AI_DIALOGUE_ENABLED` | NPC 动态对话开关 | `false` |
| `AI_BATTLE_ENABLED` | 敌方战斗决策开关 | `false` |
| `AI_BASE_URL` | OpenAI-compatible API 根地址 | `https://api.openai.com/v1` |
| `AI_API_KEY` | 服务端模型密钥 | 空 |
| `AI_MODEL` | 模型名称 | 空 |
| `AI_DIALOGUE_TIMEOUT_SECONDS` | 对话超时秒数 | `8` |
| `AI_BATTLE_TIMEOUT_SECONDS` | 战斗决策超时秒数 | `2` |
| `AI_MAX_INPUT_CHARS` | 玩家单次输入上限 | `500` |
| `AI_MEMORY_RECENT_TURNS` | 每个玩家与 NPC 保留的近期轮次 | `8` |
| `AI_MEMORY_RETENTION_DAYS` | 对话记忆保留天数 | `90` |

启用示例：

```dotenv
AI_ENABLED=true
AI_DIALOGUE_ENABLED=true
AI_BATTLE_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=replace-with-server-side-key
AI_MODEL=replace-with-compatible-model
```

API 密钥不得出现在客户端代码、日志或提交记录中。模型不可用、超时或输出非法时，
游戏会自动回退到静态对白、固定快捷回复和服务端确定性连续出牌。每个可战斗 NPC/怪物
使用独立卡组，客户端只看到敌方卡牌数量和已实际打出的牌，不会获得隐藏手牌或抽牌顺序。

新角色使用 75 点基础生命和 12 张起始套牌（基础攻击 6、防御姿态 6）。
战斗创建时服务端按内部 seed 对双方牌堆进行可复现洗牌；seed 与洗牌次数不会返回客户端。
不同 NPC 通过独立牌组和伤害/护盾权重形成难度差异，错误出牌或忽略防御时允许正常败北。

NPC 在 80 点好感进入 5 级时获得对应卡灵；怪物胜利固定掉落 1/2/3 枚卡灵碎片，集齐
30 枚后可在图鉴中合成。露娜序章首胜是剧情直招例外：直接获得完整露娜卡灵与
《月牙撕裂》×2，并将签名卡加入启用套牌。完整设计见
[`doc/ai/AI对战与对话接入设计.md`](doc/ai/AI对战与对话接入设计.md)。

## 数据库迁移

迁移脚本位于 `server/database/`，并按三位数字前缀顺序执行。`docker compose up` 会在 API 启动前自动运行这些脚本。

新增迁移时请：

1. 使用下一个连续编号，例如 `012_feature_name.sql`。
2. 保持迁移可重复执行，或显式处理对象已存在的情况。
3. 同步更新 `server/database/tests/verify_schema.sql`（如涉及结构约束）。
4. 运行后端测试验证已有 Demo 流程未被破坏。

## 设计文档

- [AI 对战与对话接入设计](doc/ai/AI对战与对话接入设计.md)
- [游戏昼夜系统设计](doc/docs/游戏昼夜系统设计.md)
- [晨曦村布局与贴图优化方案](doc/docs/晨曦村布局与贴图优化方案.md)
- [微光森林地图与内部贴图优化规范](doc/剧情设计/开局/微光森林地图与内部贴图优化规范_V1.0.md)
- [可采集植物与卡灵赠礼好感度系统设计](doc/好感度/可采集植物与卡灵赠礼好感度系统设计.md)
- [防御卡面与战斗防御动作设计](doc/战斗/防御卡面与战斗防御动作设计.md)

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

本项目目前是可本地联调的游戏 Demo，重点验证序章引导、世界探索、动态 NPC、昼夜变化、卡牌战斗和卡灵养成之间的数据闭环。S0 开场演出与晨曦村初始任务链已接入，统一游戏时间可在探索中推进，并在对话、战斗、菜单和页面失焦期间暂停。

项目仍处于开发阶段，内容规模、美术一致性、移动端体验与更多剧情场次会继续迭代；当前已实现能力和设计资料以仓库代码、测试及 `doc/` 文档为准。
