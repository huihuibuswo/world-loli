# NPC 地图巡游与移动贴图接入 - Technical Design

## 1. Boundaries

本功能限定在 `game-client`：

- 构建期资产处理：将玩家与 NPC 的洋红底四帧方向源图转换成透明 spritesheet。
- 资源预加载：加载 NPC 行走表并注册循环动画。
- NPC 实体：维护出生锚点、巡游状态、物理体、名称标签和动画切换。
- 世界场景：驱动 NPC 更新、障碍碰撞、交互暂停和小地图标记跟随。

不修改服务端 API、数据库结构、已有 SQL 迁移或玩家/NPC 持久化状态。

## 2. Asset Pipeline

### 2.1 Source and Output Contract

- 规范源图目录：`game-client/art-source/generated/npc-walk/`。
- 源图命名：`npc-<name>-walk-source.png`。
- 输入：方形 RGB/RGBA PNG，横向四个动作区域，洋红背景；现有输入为 `1024x1024`，新增方向图为 `1254x1254`。
- 输出：`game-client/public/assets/generated/sprites/npc-<name>-walk-sheet.png`。
- 输出格式：透明 RGBA PNG，`1024x256`，横向 4 帧，每帧 `256x256`。

四方向扩展使用 `game-client/art-source/generated/directional-walk/`：

- 角色 key：`adventurer-female`、`adventurer-male` 和 6 个 `npc-*` key。
- 新增源图：`<key>-walk-up-source.png`、`<key>-walk-left-source.png`、`<key>-walk-right-source.png`。
- 新增输出：`<key>-walk-up-sheet.png`、`<key>-walk-left-sheet.png`、`<key>-walk-right-sheet.png`。
- `down` 继续使用现有玩家/NPC 正面行走表，不重复生成。
- 露娜右向源图由独立候选图水平翻转后导入，作为可直接替换的临时资源。

任务目录中的 `research/assets` 是用户输入备份；实施时复制到规范源图目录，不让运行脚本依赖会被归档的 Trellis 任务路径。

### 2.2 Chroma Removal and Frame Normalization

新增 `game-client/scripts/import_npc_walk_assets.py`，复用项目已有 Pillow/NumPy 资产脚本风格：

1. 校验输入为边长不小于 `1024px` 的方形图片和预期文件名集合。
2. 根据实际宽度在四个名义分区附近寻找透明分隔带，兼容不能被 4 整除的尺寸。
3. 将高红、高蓝、低绿的像素识别为洋红候选，只删除与区域边缘连通的候选背景，避免误删角色内部颜色。
4. 对透明边缘做轻量羽化/去洋红污染，透明像素 RGB 清零。
5. 获取每帧 alpha 包围盒；使用四帧共享缩放比例，避免动作间角色忽大忽小。
6. 将角色按水平中心和统一脚底基线排入 `256x256` 帧，再横向拼接。
7. 校验输出尺寸、透明通道和每帧非空内容后写入运行时目录。

脚本必须可重复执行；异常输入直接失败并指出角色文件，不生成部分损坏的对应输出。

## 3. Runtime Animation

`PreloadScene` 对玩家和 6 个 NPC key 加载方向 spritesheet，帧尺寸为 `256x256`。资源存在时注册 `${key}-walk-<direction>-cycle`，使用帧 `[0, 1, 2, 3]`、约 `8-9fps`、无限循环。现有无方向 walk key 作为 `down` 和资源缺失回退。

玩家与 NPC 共用同一条主轴方向判定：`abs(x) > abs(y)` 时选择左右，否则选择上下。移动时切换到对应方向 texture 和动画；停止时保留最后一帧朝向，交互暂停仍停止动画。方向资源缺失时回退到现有 walk texture 或静态 texture。

加载失败采用现有静态资源回退，不能阻止 `WorldScene` 创建。

## 4. NPC Entity State Machine

NPC 从静态物理体改为动态但不可推动的 Arcade Sprite，关闭重力并限制在世界边界内。实体保存：

- `spawn`: 出生锚点。
- `wanderRadius`: 默认 `140px`。
- `speed`: 约 `45px/s`，显著低于玩家的 `220px/s`。
- `state`: `idle | moving | returning | paused`。
- `target`: 当前范围内目标点。
- `nextDecisionAt`: 下一次移动/停留决策时间。
- `lastPosition/lastProgressAt`: 卡住检测。
- `nameLabel`: 随实体移动的名称文本。

状态规则：

1. `idle`：随机停留约 1.2 到 3.2 秒，然后在出生圆内选择目标。
2. `moving`：朝目标匀速移动；到达目标后进入 `idle`。
3. `returning`：超出半径或接近边界时以出生点为目标，回到范围内后进入 `idle`。
4. `paused`：玩家处于交互范围、世界输入锁定或对话打开时速度归零，停止动画并保留最后朝向帧；行走资源不可用时显示静态图。
5. 移动中持续一段时间没有有效位移，视为被障碍物卡住，停止并延迟后重新选点。
6. 每帧更新深度、标签位置和碰撞体关联；必要时将位置投影回出生圆内，保证无累计漂移。

不使用 A* 或导航网格。随机目标可能不可直达时由碰撞和卡住重选机制恢复。

## 5. WorldScene Integration

- 保留 `obstacles` 静态组引用，为每个 NPC 添加 NPC-障碍物碰撞。
- 保留玩家-NPC 碰撞，并设置 NPC 不可推动。
- NPC 之间添加碰撞，避免长期重叠。
- `update()` 在最近交互检测前驱动 NPC；当玩家到某 NPC 的距离不大于交互范围时，仅暂停该 NPC。
- `onInputLock` 同时记录 NPC 全局暂停状态；锁定时所有 NPC 停止。
- 小地图使用 `Map<NPC, Phaser.GameObjects.Arc>` 保存标记关系，每帧同步标记坐标。
- 最近 NPC 判定继续读取实体实时 `x/y`，不新增第二套位置状态。
- 场景 shutdown 时沿用 Phaser 对场景对象的销毁，并清理现有事件监听。

## 6. Compatibility and Rollback

- 当前工作区已修改 `WorldScene.ts` 的序章输入锁初始化；实现必须在该版本上增量编辑，不覆盖用户变更。
- 静态 NPC 图片继续保留，既用于 idle，也作为 walk 资源失败的回退。
- 回滚只需移除新增 walk 资源/导入脚本，并恢复 NPC/Preload/WorldScene 的巡游接入；无数据迁移需要逆转。

## 7. Risks

- 洋红底并非严格单色，可能产生边缘色污染：通过边缘连通容差、轻量羽化和输出预览控制。
- 四帧角色在原图中的尺寸不同：使用共享缩放比例和统一基线，避免动画跳动。
- 随机目标可能位于建筑另一侧：不增加寻路，依赖碰撞、卡住检测和重新选点；这是 MVP 可接受限制。
- 动态 NPC 可能在玩家点击前离开：进入交互范围立即暂停。
- 名称文本或小地图标记可能与精灵脱节：位置只以 NPC 实体为真源，每帧同步附属对象。
