# 防御卡面与战斗防御动作

## Goal

为通用防御卡提供独立卡面，并让玩家与现有战斗敌人在攻击、防御、受击、战败和胜利时播放语义正确的动作。所有动画只消费服务端权威结算结果，不改变战斗数值。

## Confirmed Facts

- `BattlePanel.vue` 当前让非卡灵牌统一显示 `basic-attack.webp`，防御牌没有独立卡面。
- 玩家 combat sheet 只有 attack、hit、death、victory，没有 defense。
- 现有敌人使用静态 NPC 贴图，没有帧动画。
- 当前 `battle:action` 不包含卡牌类型和连续动作序列，防御会被错误播放为攻击。
- 服务端现有公开结果已包含驱动表现所需的 type、damage、blocked、shield 和卡牌顺序。

## Requirements

- 新增通用防御卡面 `basic-defense.webp`。
- 新增男女玩家各 4 帧 defense 动作表。
- 为村长、杂货商、苏娜、森林向导、训练教官、露娜生成 attack、defense、hit、death、victory 五行动作表。
- 将客户端战斗视觉事件改为按服务端结果顺序播放的 typed steps。
- attack 和 defense 必须按卡牌 type 区分，不能用 damage 是否为零推断。
- 动画期间禁止重复操作；场景关闭时清理队列。
- 动作资源缺失时回退到静态贴图和通用 Tween，不阻塞战斗。
- 不修改战斗数值、卡组、AI 决策和数据库结构。

## Acceptance Criteria

- [ ] “防御姿态”显示独立防御卡面。
- [ ] 男女玩家使用防御牌时原地播放 defense，敌人不播放 hit。
- [ ] 6 名现有敌人使用攻击、防御、受击、战败和胜利动作。
- [ ] 敌人连续出牌严格按 `last_action.cards` 顺序播放。
- [ ] 被完全格挡的攻击仍播放 attack 和格挡反馈。
- [ ] 客户端动画不修改 HP、护盾、能量或胜负。
- [ ] 缺失动作资源时战斗仍能继续。
- [ ] 前端 typecheck 和 build 通过。

## Out Of Scope

- 每张卡牌的数据库卡图字段。
- 骨骼动画、换装系统、粒子编辑器、音效和高级镜头。
- 未来怪物资源；新增怪物时按本任务规格补齐。

## Source Design

- `doc/防御卡面与战斗防御动作设计.md`
