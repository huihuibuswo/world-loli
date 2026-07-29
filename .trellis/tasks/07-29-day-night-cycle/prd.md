# 昼夜系统实现

## Goal

为《斗萝大陆》实现统一、可存档、可复现的游戏内昼夜循环，使世界探索、HUD、战斗背景和基础 NPC 作息共享同一时间状态，并且任何时段都不阻断核心流程。

## Background

- 权威产品设计位于 `doc/docs/游戏昼夜系统设计.md`。
- `game-client/src/game/scenes/BattleScene.ts` 当前使用浏览器 `Date` 判断晨曦村战斗背景，世界探索没有时间状态。
- 玩家持久化数据由 `server/app/models.py::Player` 承载，`server/app/api/deps.py::player_data()` 是资料与存档快照的共享序列化入口。
- `POST /api/v1/save` 当前无请求体，仅提交现有数据库事务并返回快照。
- `game-client/src/stores/game.ts` 是客户端全局业务状态 owner，`WorldGame` 使用 Phaser registry 向场景提供地图和玩家资料。
- `GameShell.vue` 已统一管理对话、战斗、抽屉、加载和世界输入锁，适合作为时间暂停状态的协调入口。

## Requirements

### R1 Unified game clock

- Use `day_index` and `minute_of_day` as persisted values.
- New and legacy saves default to day 1 at `08:00` (`minute_of_day = 480`).
- One real second advances one game minute while world exploration is active.
- Derive `dawn`, `day`, `dusk`, and `night` from one shared pure function.
- Do not read the device clock for day/night gameplay or visuals.

### R2 Pause behavior

- Advance time only while the player can control the world scene.
- Pause during battle, NPC/story dialogue, collection drawer, map loading, input-locked overlays, hidden browser tabs, and unfocused windows.
- Do not compensate for hidden or offline elapsed time when play resumes.

### R3 Persistence and compatibility

- Add append-only migration `022` for `players.day_index` and `players.minute_of_day` with database constraints and defaults.
- Return time fields through existing player/profile and save snapshot payloads.
- Extend `POST /save` to accept validated optional time values while keeping an empty request compatible.
- Persist time during manual save; existing position autosave behavior remains unchanged.
- Invalid values must be rejected by server validation and never render as invalid client time.

### R4 HUD

- Add a compact day/time/phase indicator to the existing world HUD using Lucide icons.
- Keep the control readable on desktop and mobile without covering existing HUD actions.
- Update the visible clock at game-minute resolution without causing layout shift.

### R5 World visual state

- Apply a camera-fixed, non-interactive environment overlay in `WorldScene` below UI and above world content.
- Provide distinct dawn/day/dusk/night palettes with continuous interpolation at dawn and dusk.
- Preserve path, NPC, collectible, portal, label, and interaction readability at night.
- Keep the micro-light forest's cold cyan visual identity in every phase.

### R6 Battle consistency

- `BattleScene` must select the Dawn Village day/night background from the shared game-time phase snapshot.
- Lock the phase for the duration of a battle.
- Remove browser `Date` based phase selection.

### R7 Basic NPC schedules

- Support optional `available_from`, `available_until`, and `schedule_critical` fields on map NPC objects.
- Schedule ranges must support crossing midnight.
- Non-critical scheduled NPCs become inactive and hidden outside their range; map markers and interaction state follow visibility.
- Main-story and critical NPCs remain available at all times.
- Seed schedules only for the merchant, blacksmith, and trainer; do not add route simulation or indoor movement.

## Out of Scope

- Weather, seasons, moon phases, temperature, sleep/skip-time actions, offline progression, multiplayer clock synchronization.
- Full NPC home/work pathfinding, indoor maps, daily economy simulation, crop growth, nocturnal encounter tables.
- New environment art generation; use tint, overlay, existing battle backgrounds, and lightweight programmatic lights.
- Broad refactoring of the game store, scene architecture, or save system.

## Acceptance Criteria

- [x] A new player starts at day 1 `08:00`; an existing player missing client time data loads the same default.
- [x] During active world control, 60 real seconds advance approximately 60 game minutes; `23:59` rolls to the next day at `00:00`.
- [x] Dialogue, battle, drawer, loading, input lock, hidden tab, and window blur pause progression without later catch-up.
- [x] HUD, world lighting, NPC schedules, and battle background use the same phase calculation.
- [x] Dawn Village visually distinguishes all four phases; night remains navigable and readable.
- [x] Micro-light Forest remains cold and readable rather than becoming a dark black overlay.
- [x] Dawn Village battle uses the phase at battle entry and never reads the device clock.
- [x] Merchant, blacksmith, and trainer follow configured hours, including correct midnight-range utility behavior; critical NPCs remain available.
- [x] `POST /save` stores validated time and an empty body remains compatible.
- [x] Backend tests cover defaults, valid save, invalid ranges, persistence, and profile/snapshot serialization.
- [x] Frontend pure time utilities cover phase boundaries, rollover, formatting, interpolation inputs, and midnight schedules.
- [x] Frontend typecheck/build and relevant backend tests pass.
- [x] Desktop and mobile screenshots verify HUD fit and daytime/nighttime readability.

## Technical Notes

- `phase` is derived and is not stored in PostgreSQL.
- The Pinia store owns the current clock. Phaser receives snapshots through registry/events; no second timer is allowed inside Vue or scenes.
- The implementation may add a small dependency-free time module and event payloads but must not introduce a new framework or service.
- Blocking open questions: none.
