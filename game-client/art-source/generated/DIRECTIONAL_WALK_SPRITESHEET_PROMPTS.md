# 角色上、左、右方向行走贴图生成提示词

## 目标

为玩家角色和 NPC 补充向上、向左、向右移动时使用的独立行走动画。

- `up` 方向必须显示角色背部，角色正在远离视口。
- `left` 方向必须显示角色左侧面，角色向画面左侧移动。
- `right` 方向必须显示角色右侧面，角色向画面右侧移动。
- 左右方向分别生成，不使用水平镜像代替，保留服装、发型、武器和配饰的非对称细节。
- 每名角色、每个方向单独生成一张 `1024x1024` PNG 源图。
- 一张图包含从左到右排列的 4 个行走动作帧。
- 不要求生成透明背景，统一使用纯洋红色 `#FF00FF`，后续由项目脚本抠图。
- 本轮生成 `up/left/right` 三个方向，不重新生成已有正面行走帧，也不生成战斗动作或场景背景。

## 使用方法

1. 每次只上传一张对应角色的正面模型图作为参考。
2. 根据目标方向选择“向上”“向左”或“向右”提示词，并将 `[角色名称]` 替换为实际名称。
3. 如果工具支持负面提示词，同时粘贴对应方向的负面提示词。
4. 下载原始 PNG，不要截图、压缩或手动裁切。
5. 按文末文件名保存生成结果。

参考图只用于锁定角色身份、服装、发型、配色和画风。生成结果必须改变观察角度，不能继续输出正面角色。

## 向上行走主提示词

```text
请严格参考我上传的角色模型图，为角色“[角色名称]”生成一张 2D 游戏行走动画源图。

画面规格：
- 1024x1024 正方形 PNG。
- 整张图从左到右平均分成 4 个等宽的竖直动作区域。
- 每个区域只能出现 1 个完整角色，共 4 个角色动作帧。
- 四帧按从左到右的顺序排列，角色之间保持明显空隙，身体、头发、披风、武器和配饰都不能跨入相邻区域。
- 四帧角色大小完全一致、头顶高度接近、脚底位于同一条水平基线上。
- 角色完整入画，头顶、耳朵、头发、披风、手、脚和随身物品都不能被裁切。

观察方向和动作：
- 四帧全部是严格的背面视角，角色背对观众，正在向画面上方走，也就是远离视口。
- 必须清楚看到后脑、背部、披风或服装背面和鞋后跟。
- 不能看到眼睛、正脸、嘴巴或胸前服装主体，不能回头，不能使用正面或侧面视角。
- 使用自然循环的四步行走动作：第 1 帧右腿向前，第 2 帧双腿交错经过，第 3 帧左腿向前，第 4 帧双腿交错经过。
- 四帧只改变四肢、衣摆、头发和配饰的轻微运动，角色身份、服装结构、身体比例、镜头角度和光照保持一致。
- 动作幅度清晰但不过度夸张，播放循环时应连贯，不跳跃、不奔跑、不转身。

角色一致性：
- 高度还原参考图中的发型、发色、兽耳、头饰、服装、披风、鞋子、武器、包袋和标志性配饰。
- 根据参考图合理推导服装背面结构，不擅自更换服装，不增加新装备，不删除标志性元素。
- 保持参考图的日系 Q 版奇幻 RPG 游戏角色风格、精细描边、柔和赛璐璐上色和清晰轮廓。
- 四帧必须像同一个角色的连续动画，不能发生脸型、发型、服装、颜色、年龄或身高变化。

背景和输出：
- 背景必须是完全均匀、单一、无纹理的纯洋红色 #FF00FF。
- 背景不得出现渐变、噪点、阴影、光晕、地面、倒影、环境、装饰或透明棋盘格。
- 角色脚下不要投影，不要接触阴影。
- 不要添加网格线、分隔线、边框、文字、编号、水印或 UI。
- 输出干净、锐利、适合后续色键抠图和制作 spritesheet。
```

## 向上行走负面提示词

```text
front view, face visible, eyes visible, looking back, looking over shoulder,
side view, three-quarter front view, profile view, walking toward camera,
running, jumping, fighting pose, idle pose, duplicated limbs, missing limbs,
different character in each frame, inconsistent costume, inconsistent scale,
cropped head, cropped ears, cropped feet, overlapping characters,
character crossing frame boundary, merged accessories, extra character,
perspective scene, floor, ground shadow, cast shadow, scenery, props,
gradient background, textured background, uneven magenta, purple lighting,
transparent checkerboard, grid lines, borders, captions, numbers, watermark
```

## 向左行走主提示词

```text
请严格参考我上传的角色模型图，为角色“[角色名称]”生成一张 2D 游戏向左行走动画源图。

画面规格：
- 1024x1024 正方形 PNG。
- 整张图从左到右平均分成 4 个等宽的竖直动作区域。
- 每个区域只能出现 1 个完整角色，共 4 个角色动作帧。
- 四帧按从左到右的顺序排列，角色之间保持明显空隙，身体、头发、披风、武器和配饰都不能跨入相邻区域。
- 四帧角色大小完全一致、头顶高度接近、脚底位于同一条水平基线上。
- 角色完整入画，头顶、耳朵、头发、披风、手、脚和随身物品都不能被裁切。

观察方向和动作：
- 四帧全部是严格的左侧面视角，角色头部、胸口、膝盖和脚尖朝向画面左侧，正在向左行走。
- 必须看到角色的左侧轮廓；只允许出现符合侧面视角的少量面部轮廓，不能转向观众。
- 不能使用正面、背面、右侧面或三分之四正面视角，不能倒退走路，不能回头看观众。
- 使用自然循环的四步行走动作：第 1 帧右腿跨步，第 2 帧双腿交错经过，第 3 帧左腿跨步，第 4 帧双腿交错经过。
- 四帧只改变四肢、衣摆、头发和配饰的轻微运动，角色身份、服装结构、身体比例、镜头角度和光照保持一致。
- 动作幅度清晰但不过度夸张，播放循环时应连贯，不跳跃、不奔跑、不滑步。

角色一致性：
- 高度还原参考图中的发型、发色、兽耳、头饰、服装、披风、鞋子、武器、包袋和标志性配饰。
- 根据参考图合理推导左侧结构，严格保持配饰实际所在一侧，不要为了美观擅自镜像、换边或复制配饰。
- 保持参考图的日系 Q 版奇幻 RPG 游戏角色风格、精细描边、柔和赛璐璐上色和清晰轮廓。
- 四帧必须像同一个角色的连续动画，不能发生脸型、发型、服装、颜色、年龄或身高变化。

背景和输出：
- 背景必须是完全均匀、单一、无纹理的纯洋红色 #FF00FF。
- 背景不得出现渐变、噪点、阴影、光晕、地面、倒影、环境、装饰或透明棋盘格。
- 角色脚下不要投影，不要接触阴影。
- 不要添加网格线、分隔线、边框、文字、编号、水印或 UI。
- 输出干净、锐利、适合后续色键抠图和制作 spritesheet。
```

## 向左行走负面提示词

```text
front view, rear view, right-facing character, walking right, walking backward,
looking at camera, looking back, three-quarter front view, inconsistent angle,
running, jumping, fighting pose, idle pose, sliding feet, duplicated limbs,
missing limbs, different character in each frame, inconsistent costume,
mirrored accessories, accessories changing sides, inconsistent scale,
cropped head, cropped ears, cropped feet, overlapping characters,
character crossing frame boundary, merged accessories, extra character,
perspective scene, floor, ground shadow, cast shadow, scenery, props,
gradient background, textured background, uneven magenta, purple lighting,
transparent checkerboard, grid lines, borders, captions, numbers, watermark
```

## 向右行走主提示词

```text
请严格参考我上传的角色模型图，为角色“[角色名称]”生成一张 2D 游戏向右行走动画源图。

画面规格：
- 1024x1024 正方形 PNG。
- 整张图从左到右平均分成 4 个等宽的竖直动作区域。
- 每个区域只能出现 1 个完整角色，共 4 个角色动作帧。
- 四帧按从左到右的顺序排列，角色之间保持明显空隙，身体、头发、披风、武器和配饰都不能跨入相邻区域。
- 四帧角色大小完全一致、头顶高度接近、脚底位于同一条水平基线上。
- 角色完整入画，头顶、耳朵、头发、披风、手、脚和随身物品都不能被裁切。

观察方向和动作：
- 四帧全部是严格的右侧面视角，角色头部、胸口、膝盖和脚尖朝向画面右侧，正在向右行走。
- 必须看到角色的右侧轮廓；只允许出现符合侧面视角的少量面部轮廓，不能转向观众。
- 不能使用正面、背面、左侧面或三分之四正面视角，不能倒退走路，不能回头看观众。
- 使用自然循环的四步行走动作：第 1 帧左腿跨步，第 2 帧双腿交错经过，第 3 帧右腿跨步，第 4 帧双腿交错经过。
- 四帧只改变四肢、衣摆、头发和配饰的轻微运动，角色身份、服装结构、身体比例、镜头角度和光照保持一致。
- 动作幅度清晰但不过度夸张，播放循环时应连贯，不跳跃、不奔跑、不滑步。

角色一致性：
- 高度还原参考图中的发型、发色、兽耳、头饰、服装、披风、鞋子、武器、包袋和标志性配饰。
- 根据参考图合理推导右侧结构，严格保持配饰实际所在一侧，不要为了美观擅自镜像、换边或复制配饰。
- 保持参考图的日系 Q 版奇幻 RPG 游戏角色风格、精细描边、柔和赛璐璐上色和清晰轮廓。
- 四帧必须像同一个角色的连续动画，不能发生脸型、发型、服装、颜色、年龄或身高变化。

背景和输出：
- 背景必须是完全均匀、单一、无纹理的纯洋红色 #FF00FF。
- 背景不得出现渐变、噪点、阴影、光晕、地面、倒影、环境、装饰或透明棋盘格。
- 角色脚下不要投影，不要接触阴影。
- 不要添加网格线、分隔线、边框、文字、编号、水印或 UI。
- 输出干净、锐利、适合后续色键抠图和制作 spritesheet。
```

## 向右行走负面提示词

```text
front view, rear view, left-facing character, walking left, walking backward,
looking at camera, looking back, three-quarter front view, inconsistent angle,
running, jumping, fighting pose, idle pose, sliding feet, duplicated limbs,
missing limbs, different character in each frame, inconsistent costume,
mirrored accessories, accessories changing sides, inconsistent scale,
cropped head, cropped ears, cropped feet, overlapping characters,
character crossing frame boundary, merged accessories, extra character,
perspective scene, floor, ground shadow, cast shadow, scenery, props,
gradient background, textured background, uneven magenta, purple lighting,
transparent checkerboard, grid lines, borders, captions, numbers, watermark
```

## 参考图与输出文件名

每个角色分别生成一次，不要在同一次生成中上传多个角色参考图。

| 角色 Key | 上传的参考图 | 向上源图 | 向左源图 | 向右源图 |
| --- | --- | --- | --- | --- |
| `adventurer-female` | `game-client/public/assets/generated/sprites/adventurer-female.png` | `adventurer-female-walk-up-source.png` | `adventurer-female-walk-left-source.png` | `adventurer-female-walk-right-source.png` |
| `adventurer-male` | `game-client/public/assets/generated/sprites/adventurer-male.png` | `adventurer-male-walk-up-source.png` | `adventurer-male-walk-left-source.png` | `adventurer-male-walk-right-source.png` |
| `npc-village-chief` | `game-client/public/assets/generated/sprites/npc-village-chief.png` | `npc-village-chief-walk-up-source.png` | `npc-village-chief-walk-left-source.png` | `npc-village-chief-walk-right-source.png` |
| `npc-shopkeeper` | `game-client/public/assets/generated/sprites/npc-shopkeeper.png` | `npc-shopkeeper-walk-up-source.png` | `npc-shopkeeper-walk-left-source.png` | `npc-shopkeeper-walk-right-source.png` |
| `npc-suna` | `game-client/public/assets/generated/sprites/npc-suna.png` | `npc-suna-walk-up-source.png` | `npc-suna-walk-left-source.png` | `npc-suna-walk-right-source.png` |
| `npc-forest-guide` | `game-client/public/assets/generated/sprites/npc-forest-guide.png` | `npc-forest-guide-walk-up-source.png` | `npc-forest-guide-walk-left-source.png` | `npc-forest-guide-walk-right-source.png` |
| `npc-trainer` | `game-client/public/assets/generated/sprites/npc-trainer.png` | `npc-trainer-walk-up-source.png` | `npc-trainer-walk-left-source.png` | `npc-trainer-walk-right-source.png` |
| `npc-luna` | `game-client/public/assets/generated/sprites/npc-luna.png` | `npc-luna-walk-up-source.png` | `npc-luna-walk-left-source.png` | `npc-luna-walk-right-source.png` |

建议将生成源图放入：

```text
game-client/art-source/generated/directional-walk/
```

## 生成结果验收

每张图至少满足以下条件后再接收：

- [ ] 图片尺寸为 `1024x1024`，格式为 PNG。
- [ ] 从左到右正好 4 帧，每个竖直区域正好 1 个完整角色。
- [ ] `up` 四帧全部严格背对视口，没有任何一帧露出正脸或回头。
- [ ] `left` 四帧全部朝向并移动到画面左侧，没有混入正面、背面或右侧面。
- [ ] `right` 四帧全部朝向并移动到画面右侧，没有混入正面、背面或左侧面。
- [ ] 左右图分别生成，不是同一张图的简单水平翻转；非对称配饰位置符合角色设定。
- [ ] 角色身份、画风、服装、发型、配色和参考图一致。
- [ ] 四帧角色大小一致，脚底基线一致，没有明显忽大忽小或上下跳动。
- [ ] 左右腿动作交替，首尾可以形成自然循环。
- [ ] 角色及配饰没有裁切、重叠、串帧、缺肢或多肢。
- [ ] 背景为均匀纯色 `#FF00FF`，没有阴影、渐变、纹理或场景元素。
- [ ] 没有文字、编号、边框、网格线、水印或额外角色。

## 常见错误的追加修正词

### 仍然生成正脸或回头

```text
重新生成。四个动作帧都必须是 180-degree strict rear view。角色始终背对观众，脸部完全不可见，不回头，不露出眼睛、鼻子或嘴巴。
```

### 左右方向生成成三分之四正面

```text
重新生成严格侧面行走图。头部、胸口、膝盖和脚尖必须朝向目标移动方向，只显示该侧轮廓，不要转向观众，不要使用 three-quarter front view。
```

### 左右方向被简单镜像或配饰换边

```text
这是一张独立方向设计图，不是另一方向的水平镜像。请依据参考图保持发饰、包袋、武器、披风扣和其他非对称配饰的真实左右位置，四帧之间也不能换边。
```

### 四帧角色大小不一致

```text
保持四帧使用完全相同的角色模型、相同缩放比例、相同镜头距离和相同脚底基线，只允许腿、手臂、衣摆和头发产生行走动作变化。
```

### 角色互相重叠或没有按四区排列

```text
将 1024x1024 画布严格划分为四个等宽竖直区域。每个区域只能放置一个完整角色，角色水平居中，任何身体、头发、披风和配饰都不得跨越区域边界。
```

### 背景不纯或出现阴影

```text
删除所有环境、地面、阴影、光晕、纹理和渐变。整张画布除角色外只能使用完全均匀的纯色背景 RGB(255, 0, 255)，即 #FF00FF。
```
