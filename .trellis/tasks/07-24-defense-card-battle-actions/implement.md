# Implementation Plan

1. 生成并验证防御卡面、男女玩家 defense sheet、6 名敌人 combat sheet。
2. 将最终资源复制到 `public/assets/generated/`，源图放入 `art-source/generated/`。
3. 扩展 `events.ts` 的 typed visual sequence contract。
4. 在 `BattlePanel.vue` 中集中投影玩家和敌方公开结果，切换防御卡面。
5. 在 `PreloadScene.ts` 加载资源并注册 defense/敌人五组动画。
6. 扩展 `CardSpirit.ts` 的 attack、defense、hit、death、victory 与静态回退。
7. 在 `BattleScene.ts` 实现可取消的串行动作队列。
8. 运行 `npm run typecheck` 和 `npm run build`。
9. 启动开发服务器，通过桌面/移动视口检查资源加载、卡面裁切和无遮挡。

## Review Gates

- 不以 damage=0 推断 defense。
- 不在动画回调中修改服务端状态。
- 不重排敌方 cards。
- shutdown 后无旧回调残留。
- 缺图不阻断战斗。

## Rollback

代码可回退为旧 `battle:action` 事件；新增资源为旁路文件，不覆盖现有攻击卡或玩家 combat sheet。
