# 《斗萝大陆》IP 音乐体系与背景音乐提示词 V1.0

> 制作用途：游戏 Demo、剧情过场、角色宣传、PV 与后续 OST 扩写  
> 当前交付重点：建立全 IP 的统一音乐语法，并完成 OST 01《晨曦村》的可制作方案  
> 音乐原则：原创、可记忆、可变奏、可循环；不模仿具体作曲家或现有作品

## 1. 音乐总纲

《斗萝大陆》的核心卖点不是单纯“收集卡牌”，而是“与卡灵建立关系，让伙伴成为力量”。音乐必须同时容纳三种感受：

1. **归处感**：晨曦村代表玩家愿意回来的地方，温暖但不幼稚。
2. **伙伴感**：露娜等卡灵不是战斗工具，角色主题必须具有人格、呼吸与关系变化。
3. **未解感**：月痕、逆流雾和被改写的森林规则构成长线悬念，神秘应克制、古老、可辨认，而不是恐怖片化。

### 1.1 必须成立的音乐不变量

- 所有核心曲目共享同一组“月痕五音动机”，听众即使不知道曲名，也能感到它们来自同一世界。
- 晨曦村使用动机的明亮完整形态；月痕相关曲目使用不完整、错位、半音化或节奏压缩形态。
- 木笛、柔弦、原声拨弦构成“大陆的人情与自然”；毡音钢琴、玻璃泛音、低音弦持续音构成“月痕与未知”。
- 战斗音乐可以紧张，但不使用现代枪战感、重金属吉他墙或纯预告片式铜管轰炸。
- 所有地图与常态探索曲优先支持无缝循环，结尾不得形成过强终止感。

### 1.2 有意暂缓

- 暂不为每个角色建立完整专属乐器库。
- 暂不制作最终母带响度、空间音频和动态音乐中间件配置。
- 暂不生成真实音频成品；Suno/Udio 结果仍需人工筛选、剪辑、重编曲与版权留档。
- 本版只为 OST 01 交付精确旋律、MIDI 与 MusicXML；OST 02-08 先锁定音乐设计和生成提示词。

## 2. 全 IP 的音乐 DNA

### 2.1 月痕五音动机

核心音程轮廓：

```text
主音 → 上行纯五度 → 下行大二度 → 下行小三度 → 上行大二度
```

明亮形态（D 大调）：

```text
D - A - G - E - F#
级数：1 - 5 - 4 - 2 - 3
```

月痕形态（B 小调）：

```text
B - F# - E - C# - D
级数：1 - 5 - 4 - 2 - b3
```

这个轮廓同时具备“抬头看见远方”和“回落到未解问题”的感觉。它可以被拉长为抒情主题，也可以压缩为战斗节奏型。

### 2.2 动机变奏规则

| 场景 | 调式处理 | 节奏处理 | 听感 |
|---|---|---|---|
| 晨曦村 | D 大调，完整五音 | 舒展、弱起或长音 | 安全、有人情味 |
| 晨曦村夜晚 | D 大调混合 B 小调色彩 | 留白增多、音符减半 | 熟悉但安静 |
| 露娜主题 | B 小调与 D 大调交替 | 跳跃、切分、短促呼吸 | 敏捷、忠诚、警觉 |
| 月痕主题 | B 小调，缺失最后一音 | 不规则停顿、延迟落点 | 规则被改写 |
| Boss | B 弗里几亚色彩、半音下压 | 增值与重拍错位 | 古老、压迫、非机械 |
| 战斗 | B 小调/D 多利亚 | 八分音符压缩、分层循环 | 决断、追猎 |
| 主城 | D 大调/Lydian 色彩 | 宽广长线、钟声呼应 | 文明、秩序、历史 |
| Ending | D 大调，补全全部音程 | 极慢、完整终止 | 归来、理解、仍可远行 |

### 2.3 乐器身份

**世界层：**

- 木笛、低音木笛：自然、旅途、村落与角色呼吸。
- 尼龙弦吉他、曼陀林、竖琴：手工感与日常生活。
- 室内弦乐：情感纵深，不做持续煽情。
- 手鼓、框鼓、木质敲击：行动与地域感。

**月痕层：**

- 毡音钢琴：记忆、夜晚、关系中的犹疑。
- 玻璃琴、弓擦金属、极轻钟琴：冷白刻痕与银蓝雾光。
- 低音提琴/大提琴持续音：森林规则被扭曲后的低频牵引。
- 反向气息、颗粒尾音：仅作背景纹理，不盖住旋律。

### 2.4 统一制作约束

- 常态地图音乐建议峰值不过度压缩，保留 8-12 dB 动态空间。
- 循环曲避免最后一拍加入长混响尾巴；尾巴应可跨循环点延续或单独烘焙为 ambience stem。
- 生成平台提示词统一声明 `instrumental, no vocals, no choir, loop-friendly`。
- 避免：史诗预告片、好莱坞铜管墙、现代 EDM drop、摇滚吉他主导、儿歌化、过甜八音盒、恐怖尖叫、明显东方古风五声音阶套版。

## 3. OST 路线图

| 编号 | 曲名 | 建议调性 | BPM/拍号 | 核心功能 | 建议长度 |
|---|---|---:|---:|---|---:|
| OST 01 | 晨曦村 | D 大调 | 92 / 4-4 | 新手村、归处、日常探索 | 1:40-2:10 |
| OST 02 | 晨曦村·夜晚 | D 大调/B 小调 | 66 / 4-4 | 夜间村落、休息、轻剧情 | 1:50-2:30 |
| OST 03 | 露娜主题 | B 小调 → D 大调 | 108 / 6-8 | 角色登场、羁绊、追猎 | 1:45-2:20 |
| OST 04 | 月痕主题 | B 小调 | 58 / 5-4 + 4-4 | 主线谜团、逆流雾、断月纹 | 1:30-2:10 |
| OST 05 | 月痕·Boss | B 弗里几亚色彩 | 132 / 12-8 | 月痕污染核心战 | 2:00-2:40 |
| OST 06 | 月痕·战斗 | B 小调/D 多利亚 | 146 / 4-4 | 常规战斗、追猎与判断 | 1:30-2:00 |
| OST 07 | 月痕·主城 | D 大调/Lydian | 84 / 4-4 | 主城、文明与主线汇聚 | 2:10-3:00 |
| OST 08 | 月痕·Ending | D 大调 | 64 / 4-4 | 结局、伙伴回望、主题补全 | 2:30-3:30 |

## 4. OST 01《晨曦村》制作规格

### 4.1 场景与情绪

晨曦村是玩家第一次获得“这个世界值得留下”的感受。音乐不是热闹庆典，而是清晨炊烟、木屋、村钟、篱笆、暖茶和愿意帮助陌生人的村民。

**情绪关键词：**

```text
温暖、清新、手工感、轻冒险、含蓄期待、可长期聆听
```

**禁止方向：**

```text
幼儿园儿歌、纯田园牧歌、过度凯尔特、酒馆狂欢、宏大史诗、
过甜八音盒、持续高频铃铛、夸张煽情弦乐、明显悲伤
```

### 4.2 基础参数

- 调性：D 大调
- 速度：92 BPM
- 拍号：4/4
- 主题长度：8 小节
- 主奏：木笛
- 和声骨架：尼龙弦吉他/竖琴式拨弦
- 情感支撑：小编制弦乐
- 低频：大提琴或原声贝斯，保持轻盈
- 点缀：极少量钟琴，只在段落开头回应
- 推荐结构：`2 小节环境引子 + A(8) + A'(8) + B(8) + A''(8) + 2 小节循环过门`

### 4.3 8 小节主旋律

记谱说明：`q=四分音符`，`e=八分音符`，`h=二分音符`。中央 C 记作 C4。

| 小节 | 和弦 | 木笛旋律 | 功能 |
|---:|---|---|---|
| 1 | D(add9) | D4(q) F#4(e) G4(e) A4(q) F#4(q) | 以晨光般上行打开空间 |
| 2 | A/C# | E4(q) C#4(q) E4(q) A4(q) | 轻轻离开主和弦，不制造冲突 |
| 3 | Bm7 | B4(q) A4(e) F#4(e) D4(q) F#4(q) | 第一次出现“月痕动机”的远望轮廓 |
| 4 | Gmaj7 | G4(h) F#4(q) E4(q) | 回到村落与土地感 |
| 5 | D/F# | F#4(q) A4(e) B4(e) A4(q) F#4(q) | 主题再抬高一层，形成记忆点 |
| 6 | Em7 → A | E4(q) G4(q) F#4(q) E4(q) | 准备回归，同时保留流动 |
| 7 | G → A | D4(q) B3(q) E4(q) F#4(q) | 低处呼吸后重新向上 |
| 8 | A7sus4 → A7 | A4(q) G4(q) E4(q) C#4(q) | 不完全收束，直接回到第 1 小节 D4 |

### 4.4 ABC 旋律速记

```abc
X:1
T:晨曦村 - 8小节主题
M:4/4
L:1/8
Q:1/4=92
K:D
| D2 F G A2 F2 | E2 C2 E2 A2 |
| B2 A F D2 F2 | G4 F2 E2 |
| F2 A B A2 F2 | E2 G2 F2 E2 |
| D2 B,2 E2 F2 | A2 G2 E2 C2 ||
```

### 4.5 和弦与声部安排

```text
| D(add9) | A/C# | Bm7 | Gmaj7 |
| D/F#    | Em7 A | G A | A7sus4 A7 |
```

**尼龙弦吉他/竖琴：**

- 每拍一个八分音符对，采用 `低音 - 五度 - 三度/九度 - 五度` 的循环型。
- 力度保持 mp，避免持续扫弦。
- 第 6、8 小节和弦切换时只改变必要音，减少跳跃。

**低音：**

```text
D2 | C#2 | B1 | G1 | F#1 | E2-A1 | G1-A1 | A1
```

- 每小节以二分音符或全音符为主。
- 不做行进贝斯，不抢木笛的轻盈感。

### 4.6 弦乐编排

**小提琴 I：**

- 第 1-4 小节以长音 F#4/E4/D4/D4 作为内声部，不与木笛同度持续重叠。
- 第 5-8 小节加入弱起回应，音域控制在 D4-A4。

**小提琴 II/中提琴：**

- 用三度与六度填充和弦，不做完整块状三和弦齐奏。
- 第 4 小节 Gmaj7 保留 F#，制造清澈而不俗套的暖色。

**大提琴：**

- 以根音和转位低音的长音为主。
- 第 8 小节保持 A，不提前落到 D；循环回第 1 小节时完成听觉解决。

**弦乐动态：**

```text
第1-2小节 p → 第3-4小节 mp → 第5小节 mf → 第6-8小节 mp
```

### 4.7 木笛演奏说明

- 音色选择温暖、带轻微气息的木笛，不使用尖锐爱尔兰哨笛音色。
- 每两小节形成一个自然呼吸句；第 4、8 小节末留微小气口。
- 装饰音最多出现在第 5 小节 B4 前，使用非常短的 A4 倚音。
- 不要全程量化到机械网格；旋律起音可落后拍点 5-15 ms。

### 4.8 无缝 Loop 设计

**游戏循环区间：**

```text
Loop Start：第 1 小节第 1 拍
Loop End：第 8 小节第 4 拍结束
总长度：约 20.87 秒（92 BPM，8 小节）
```

**循环成立条件：**

- 第 8 小节使用 A7，不落主和弦。
- 木笛末音 C#4 是 D4 的导向音。
- 大提琴保持 A1，循环后自然解决到 D2。
- 混响尾音不得在 Loop End 被硬截；导出时使用可跨循环的独立 reverb stem，或在中间件中让尾音继续播放。
- 生成平台无法输出精确循环时，先生成 90-120 秒素材，再在 DAW 中按 8/16 小节网格重剪。

### 4.9 Suno Prompt

**主提示词：**

```text
Instrumental cozy fantasy RPG village theme, 92 BPM, D major, 4/4.
Warm breathy wooden flute carries a memorable eight-bar melody over gentle
nylon-string guitar arpeggios, intimate chamber strings, soft cello roots and
very sparse glockenspiel accents. The mood is sunrise over a welcoming village:
fresh air, wooden houses, warm tea, kind townsfolk, quiet anticipation of an
adventure. Melodic, handcrafted, emotionally sincere, light dynamic movement,
clean orchestration, seamless loop-friendly ending on a soft dominant chord.
No vocals, no choir, no epic trailer brass, no heavy drums, no EDM, no rock
guitar, no tavern party, no childish nursery melody, no overly sweet music box.
```

**结构补充：**

```text
Short ambient intro, flute theme A, gentle variation A', a small string-led B
section, return of the flute theme with slightly fuller harmony, then a restrained
loop transition. Keep percussion minimal and organic.
```

### 4.10 Udio Prompt

**Prompt：**

```text
cozy fantasy game soundtrack, instrumental, village exploration music,
D major, 92 bpm, warm wooden flute lead, nylon guitar arpeggio, chamber strings,
soft cello, sparse glockenspiel, pastoral but not childish, intimate handcrafted
acoustic texture, clear memorable leitmotif, gentle adventure undertone,
balanced midrange, restrained dynamics, loopable arrangement, soft dominant
ending, no vocals, no choir
```

**Negative / Avoid：**

```text
epic trailer, cinematic brass blast, bombastic percussion, EDM drop, rock band,
Irish pub dance, comedy music, nursery rhyme, music box lead, sentimental string
swells, overly busy counterpoint, dark horror ambience
```

### 4.11 生成结果筛选标准

满足以下条件才进入二次制作：

- 前 20 秒内出现可哼唱但不过甜的木笛主题。
- 木笛没有被弦乐或钟琴盖住。
- 听感是“可以生活的村落”，不是景区宣传片或酒馆舞曲。
- 结尾能被剪到属和弦或开放和声，适合回到开头。
- 连续播放三轮不出现明显疲劳点。
- 没有平台自动加入的人声、哼唱、口哨或合唱。

## 5. OST 02《晨曦村·夜晚》

### 音乐设计

- 调性：D 大调与 B 小调之间模糊切换
- 速度：66 BPM
- 主奏：毡音钢琴
- 配器：极轻弦乐、低音木笛、夜虫环境、远处村钟
- 变奏：保留 OST 01 的旋律骨架，只演奏每个乐句的首音与终音，让熟悉感像灯火一样断续出现

### Suno Prompt

```text
Instrumental nighttime variation of a cozy fantasy village theme, 66 BPM,
felt piano playing a sparse familiar melody, soft chamber strings, distant low
wood flute, subtle night insects and one far village bell. Warm windows in a
quiet sleeping village, safe but slightly mysterious, intimate and spacious,
long natural pauses, loop-friendly. No vocals, no lullaby cliché, no music box,
no horror, no dramatic climax, no heavy bass.
```

### Udio Prompt

```text
night village game ambience, instrumental, felt piano, sparse chamber strings,
low wooden flute, distant bell, subtle nocturnal field ambience, warm and safe,
slightly mysterious, slow 66 bpm, familiar leitmotif reduced to fragments,
minimal, spacious, seamless loop, no vocals, no music box, no horror
```

## 6. OST 03《露娜主题》

### 音乐设计

- 调性：B 小调起步，关键段落转入 D 大调
- 速度/拍号：108 BPM，6/8
- 主奏：木笛与轻拨弦
- 律动：框鼓、手鼓、低音弦的追猎型附点节奏
- 人格：活泼、忠诚、喜欢冒险；敏锐但不冷酷，负伤时仍把自己放在威胁与守护对象之间
- 变奏：月痕五音动机先以短促跳跃出现，羁绊段补全最后一音并转为大调

### Suno Prompt

```text
Instrumental character theme for Luna, a swift silver-haired wolf guardian in
a fantasy RPG. 108 BPM in 6/8, B minor moving toward D major. Agile wooden flute,
plucked strings, light frame drum, warm chamber strings and a restrained silver
bell color. Playful alertness, loyal courage, love of adventure, a hunter's quick
instinct and a protector's heart. The main five-note moon motif begins cautious
and incomplete, then opens into a warm major-key bond theme. No vocals, no cute
anime pop, no tribal chanting, no aggressive metal, no heroic brass wall.
```

### Udio Prompt

```text
fantasy RPG character leitmotif, agile wolf guardian, instrumental, 6/8,
108 bpm, B minor to D major, wooden flute lead, plucked strings, frame drum,
chamber strings, subtle silver bell, alert playful energy, loyalty, adventure,
protective courage, memorable five-note moon motif, emotional major-key release,
no vocals, no idol pop, no metal, no tribal chant
```

## 7. OST 04《月痕主题》

### 音乐设计

- 调性：B 小调
- 速度/拍号：58 BPM，在 5/4 与 4/4 之间切换
- 主奏：毡音钢琴单音、玻璃泛音
- 底层：低音弦持续音、反向呼吸纹理
- 叙事：风向与雾流相反、断月纹正在追踪露娜、森林规则被人为改写
- 变奏：核心动机缺失最后一个音，或最后一音延迟到下一小节，制造“规则未闭合”

### Suno Prompt

```text
Minimal instrumental mystery theme for an ancient broken moon mark in a fantasy
forest. 58 BPM, mostly B minor, alternating 5/4 and 4/4. Felt piano single notes,
glass harmonics, low cello and bass drones, faint reversed breath textures,
three cold stone-like pulses. A five-note moon motif is always interrupted before
completion. The atmosphere suggests fog flowing against the wind and a natural
law being deliberately altered: restrained, ancient, intelligent, unsettling
but not horror. No vocals, no choir, no jump scares, no full melody, no trailer
hits, no sci-fi machinery.
```

### Udio Prompt

```text
minimal fantasy mystery score, broken moon sigil, B minor, 58 bpm, mixed 5/4
and 4/4, felt piano fragments, glass harmonics, low string drone, reversed air,
cold stone pulses, interrupted five-note leitmotif, forest rules distorted,
ancient and restrained, unsettling not horror, no vocals, no choir, no trailer
impacts, no sci-fi
```

## 8. OST 05《月痕·Boss》

### 音乐设计

- 调性：B 小调加入 b2 的弗里几亚色彩
- 速度/拍号：132 BPM，12/8
- 主奏：低弦与圆号的动机增值，木笛只以破碎短句出现
- 打击：大鼓、框鼓、低音木质敲击；避免现代鼓组
- 叙事：不是“巨大怪兽”，而是被扭曲规则形成的压迫核心
- 变奏：五音动机压缩成重拍型，第四音下移半音，制造污染感

### Suno Prompt

```text
Instrumental fantasy RPG boss battle variation of a broken moon leitmotif,
132 BPM in 12/8, B minor with restrained Phrygian flat-second color. Driving low
strings, dark horns, frame drums, deep wooden percussion, tense ostinato and
shattered wooden-flute fragments. Ancient corrupted natural law, escalating
pressure, tactical danger and tragic weight. Keep the original five-note motif
recognizable beneath the rhythm. No vocals, no choir, no metal guitars, no EDM,
no superhero brass, no horror screams, no generic trailer braams.
```

### Udio Prompt

```text
fantasy boss battle, instrumental, 12/8, 132 bpm, B minor Phrygian color,
low string ostinato, dark restrained horns, frame drum, deep wood percussion,
broken flute fragments, corrupted nature, tactical pressure, tragic ancient
weight, recognizable moon leitmotif, no choir, no metal, no EDM, no braams
```

## 9. OST 06《月痕·战斗》

### 音乐设计

- 调性：B 小调与 D 多利亚交替
- 速度/拍号：146 BPM，4/4
- 配器：拨弦 ostinato、框鼓、弦乐短音、木笛信号句
- 重点：卡牌战斗强调判断、护盾、能量管理，不是无脑冲刺
- 变奏：把五音动机拆为 `1-5-4` 与 `2-b3` 两组，分别由低弦和木笛问答

### Suno Prompt

```text
Instrumental tactical fantasy card-battle music, 146 BPM, 4/4, B minor with
Dorian flashes. Tight plucked-string ostinato, frame drum, crisp chamber-string
staccato, low cello pulse and short wooden-flute signal phrases. Fast but readable,
focused on timing, defense, energy management and pursuit rather than chaos.
Split the moon leitmotif into a low-string call and flute response. Seamless loop,
no vocals, no choir, no metal guitars, no EDM drop, no oversized cinematic brass.
```

### Udio Prompt

```text
tactical card battle soundtrack, instrumental, 146 bpm, B minor Dorian,
plucked ostinato, frame drum, chamber string staccato, cello pulse, wooden flute
signals, fast but controlled, decision-focused, call-and-response moon motif,
loopable, no vocals, no metal, no EDM, no huge brass
```

## 10. OST 07《月痕·主城》

### 音乐设计

- 调性：D 大调加入升四级的 Lydian 光泽
- 速度/拍号：84 BPM，4/4
- 配器：宽广弦乐、木笛合奏、竖琴、低铜管、城市钟声
- 叙事：文明、秩序、历史与主线谜团汇聚；不是王宫凯旋
- 变奏：月痕动机被不同城区声部接力，第一次呈现“个人伤痕也是大陆历史的一部分”

### Suno Prompt

```text
Instrumental grand fantasy capital-city theme, 84 BPM, D major with subtle
Lydian brightness. Broad chamber-orchestral strings, layered wooden flutes,
harp, restrained low brass and resonant civic bells. A living city where trade,
history, card spirits and the broken moon mystery converge. Noble and spacious
without sounding royal or triumphant; the five-note moon motif passes between
district-like instrumental groups. Loop-friendly, no vocals, no choir, no
military march, no trailer bombast, no excessive fanfare.
```

### Udio Prompt

```text
fantasy capital city soundtrack, instrumental, 84 bpm, D major Lydian,
broad strings, layered wood flutes, harp, restrained low brass, civic bells,
living historic city, noble not royal, moon leitmotif passed between ensembles,
spacious loopable orchestration, no choir, no march, no bombast
```

## 11. OST 08《月痕·Ending》

### 音乐设计

- 调性：D 大调
- 速度/拍号：64 BPM，4/4
- 主奏顺序：独奏木笛 → 钢琴 → 室内弦乐 → 全体温柔合流
- 叙事：理解月痕真相、伙伴关系完成一次成长，但世界仍可继续远行
- 变奏：首次完整奏出五音动机并把最后的 `3` 延伸到主和弦，随后引用《晨曦村》第 1 小节
- Ending 不是循环曲，应拥有明确但克制的终止

### Suno Prompt

```text
Instrumental ending theme for a heartfelt fantasy RPG, 64 BPM, D major.
Begin with solo warm wooden flute stating the complete five-note moon leitmotif,
answered by felt piano, then intimate chamber strings and gentle harp. The music
looks back on a broken mystery now understood, loyal companions, the village
that became home, and a road that still continues. Quote the opening contour of
the village theme near the end. Clear restrained final cadence, emotionally
earned, hopeful without triumphalism. No vocals, no choir, no power ballad,
no giant climax, no sentimental excess.
```

### Udio Prompt

```text
fantasy RPG ending theme, instrumental, 64 bpm, D major, solo warm wooden flute,
felt piano, intimate chamber strings, gentle harp, complete moon leitmotif,
earned emotional resolution, companions and home, subtle village-theme reprise,
hopeful restrained final cadence, no choir, no power ballad, no giant climax
```

## 12. 生成与制作工作流

1. 每首先用提示词生成 4-8 个版本，不直接把第一次结果作为成品。
2. 只筛选旋律方向、音色关系和情绪，不要求生成平台一次完成精确结构。
3. 把入选版本导入 DAW，按 BPM 对齐，重建主旋律与和声。
4. 用本文件记录的 8 小节音符、节奏与和弦参数作为 OST 01 的旋律权威来源。
5. 重新录制或替换关键主奏，避免平台生成音频中的旋律漂移和音色伪影。
6. 制作 `Music / Ambience / Reverb Tail` 分轨，地图音乐再设置循环点。
7. 导出前做三轮循环试听、手机扬声器试听、对白叠加试听和战斗音效叠加试听。
8. 保存平台、模型版本、提示词、生成日期、原始文件和人工修改记录，形成版权与制作留档。

## 13. 游戏验收标准

### Launch blocker

- 曲目出现明显人声、哼唱或平台水印式声音。
- 地图循环点有爆音、断尾、节奏错位或和声硬切。
- 音乐遮挡对白、关键 UI 音效或战斗反馈。
- 露娜主题被制作成卖萌偶像风，破坏“敏锐、克制、守护”的角色核心。
- 月痕主题变成通用恐怖配乐，无法听出与其他曲目的动机关系。

### Follow-up

- 为昼夜、战斗前后和剧情状态制作可叠加 stem。
- 为后续卡灵建立各自的副动机与标志乐器。
- 在主城和 Ending 中扩展 60-90 秒的交响发展段。
- 接入中间件后测试区域切换、淡入淡出与战斗音乐纵向分层。

## 14. 本版交付

```text
斗萝大陆_IP音乐体系与背景音乐提示词_V1.0.md
```

本版只维护这一份 Markdown 源文档。8 小节旋律、和弦、配器、ABC
乐谱源、MIDI 轨道设计、双平台提示词与 Loop 规则均以内文为准；后续需要
实际 `.mid` 或 `.musicxml` 时，再从本文件的权威参数导出，避免多份源文件漂移。
