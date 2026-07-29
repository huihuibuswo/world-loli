# NPC 地图巡游与移动贴图接入 - Implementation Plan

## 1. Preserve and Import Assets

- [ ] 将 6 张任务源图复制到 `game-client/art-source/generated/npc-walk/`，使用稳定语义文件名。
- [ ] 新增 `game-client/scripts/import_npc_walk_assets.py`，实现尺寸校验、四区切帧、边缘连通洋红抠除、共享缩放和统一脚底基线。
- [ ] 生成 6 张 `npc-*-walk-sheet.png` 到运行时 sprites 目录。
- [ ] 校验每张输出为 `1024x256` RGBA、每帧非空、存在透明背景。
- [ ] 生成或保留便于人工检查的输出图，不覆盖现有静态/战斗资源。

Rollback point：此阶段只新增源图、脚本和生成资源；删除新增文件即可恢复。

## 2. Register Walk Resources

- [ ] 修改 `game-client/src/game/scenes/PreloadScene.ts`，集中维护 NPC texture key 列表，避免 walk/combat 注册列表继续分叉。
- [ ] 加载 6 张行走 spritesheet，按存在性注册 4 帧循环动画。
- [ ] 保留单个资源加载失败时的静态回退行为。

## 3. Implement NPC Wander State

- [ ] 修改 `game-client/src/game/entities/NPC.ts`，从静态体改为动态、不可推动、无重力实体。
- [ ] 保存出生锚点、巡游半径、随机目标、停留时间和卡住检测状态。
- [ ] 实现 `idle/moving/returning/paused` 状态转换。
- [ ] 实现四方向 walk texture 切换、停止时保留最后朝向帧、静态回退、标签跟随、深度更新和范围投影。
- [ ] 提供 WorldScene 可调用的暂停/更新接口，保持位置状态只由 NPC 实体拥有。

Rollback point：静态 texture 保持不变；可单独恢复 NPC 类并删除 WorldScene 调用。

## 4. Integrate World Scene

- [ ] 在当前未提交版本上增量修改 `WorldScene.ts`，保留 `WORLD_INPUT_LOCK_KEY` 初始化逻辑。
- [ ] 保存障碍物静态组并增加 NPC-障碍、NPC-NPC、玩家-NPC 碰撞。
- [ ] 在场景 update 中驱动随机漫步，接近玩家或世界锁定时暂停。
- [ ] 将小地图 NPC 标记改为实体到标记的映射，并每帧同步位置。
- [ ] 验证最近 NPC、交互提示和 `npc:interact` 使用移动后的实时坐标。

## 5. Verification

### Four-direction extension

- [ ] 保存并语义化命名 24 张 `up/left/right` 源图，不修改用户原图。
- [ ] 扩展导入脚本，一次生成玩家和 NPC 的 24 张透明 `1024x256` 方向 spritesheet。
- [ ] 在 `PreloadScene` 集中注册四方向资源和动画，保留旧资源回退。
- [ ] 玩家和 NPC 根据移动主轴选择 `down/up/left/right`，不再依赖水平镜像。
- [ ] 露娜右向使用临时翻转源图并保持独立资源 key，记录后续可替换性。

### Asset checks

```powershell
python game-client/scripts/import_npc_walk_assets.py
```

- [ ] 自动校验 6 张输出尺寸、RGBA、透明像素和四帧内容。
- [ ] 人工查看合成表，确认无明显洋红底、边缘污染、跳帧缩放和脚底漂移。

### Static checks

```powershell
cd game-client
npm run typecheck
npm run build
```

- [ ] TypeScript 类型检查通过。
- [ ] Vite 生产构建通过。

### Manual behavior checks

- [ ] 在晨曦村观察至少 2 分钟：5 名 NPC 均会移动和停留，且不超出出生点约 `140px`。
- [ ] 进入微光森林验证森林 NPC 和露娜的动画、范围与静态回退。
- [ ] 验证 NPC 不穿建筑/树木、不越界、不被玩家推动；碰撞卡住后会重新选择目标。
- [ ] 验证接近、打开对话、切换互动页和关闭对话时的暂停/恢复。
- [ ] 验证名称标签和小地图标记持续跟随。
- [ ] 验证 NPC 对话、职业服务、战斗、植物采集和地图传送无回归。
- [ ] 在桌面视口截图检查精灵尺寸、背景透明、标签遮挡和小地图定位。
- [ ] 手动验证玩家与至少 2 名 NPC 四方向移动，确认向上显示背面、左右显示对应侧面、向下显示正面。

## 6. Adversarial Review Gate

- [ ] 资源缺失/损坏不会阻止地图加载。
- [ ] 帧图尺寸错误会在导入阶段失败，而不是运行时静默错位。
- [ ] 长时间运行不会让 NPC 漂出出生圆。
- [ ] 世界输入锁定时 NPC 不会继续移动或逃离交互范围。
- [ ] 动态碰撞不会推走玩家、造成持续抖动或把 NPC 挤入障碍物。
- [ ] 场景重启后没有重复事件监听、残留标签或重复小地图标记。

## 7. Files Expected to Change

- `game-client/scripts/import_npc_walk_assets.py`
- `game-client/art-source/generated/npc-walk/*.png`
- `game-client/public/assets/generated/sprites/npc-*-walk-sheet.png`
- `game-client/src/game/scenes/PreloadScene.ts`
- `game-client/src/game/entities/NPC.ts`
- `game-client/src/game/scenes/WorldScene.ts`

No backend or database file is expected to change.
