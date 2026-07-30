export const FOREST_REGION_KEYS = [
  'glimmer_forest_part_1',
  'glimmer_forest_part_2',
  'glimmer_forest_part_3',
  'glimmer_forest_part_4',
  'glimmer_forest_part_5',
] as const

export type ForestRegionKey = typeof FOREST_REGION_KEYS[number]

export type ForestObstacleLayoutItem = {
  x: number
  y: number
  texture: string
  size: number
  displayHeight?: number
  angle?: number
  body:
    | { shape: 'circle'; radius: number; offsetX: number; offsetY: number }
    | { shape: 'rect'; width: number; height: number; offsetX: number; offsetY: number }
}

export type ForestRouteLayoutItem = {
  points: number[]
  width: number
  height: number
  alpha: number
}

export type ForestDecorationLayoutItem = {
  x: number
  y: number
  texture: string
  width: number
  height: number
  alpha?: number
  angle?: number
  depth?: number
  tile?: boolean
  additive?: boolean
  motion?:
    | { type: 'tile'; x: number; y: number; duration: number }
    | { type: 'pulse'; from: number; to: number; duration: number }
}

export type ForestRegionConfig = {
  key: ForestRegionKey
  groundTexture: string
  routes: ForestRouteLayoutItem[]
  obstacles: ForestObstacleLayoutItem[]
  decorations: ForestDecorationLayoutItem[]
}

export const FOREST_REGION_ASSETS: Record<string, string> = {
  'forest-region-exit-left': 'sprites/common/forest-exit-silver-mist-left.png',
  'forest-region-exit-right': 'sprites/common/forest-exit-silver-mist-right.png',

  'forest-region-part-2-ground': 'ground/part-2-silver-mist-valley-ground.png',
  'forest-region-part-2-water-flow': 'ground/part-2-stream-water-flow.png',
  'forest-region-part-2-bridge-horizontal': 'sprites/part-2/fallen-log-bridge-horizontal.png',
  'forest-region-part-2-bridge-diagonal': 'sprites/part-2/fallen-log-bridge-diagonal.png',
  'forest-region-part-2-reverse-mist-fall': 'effects/part-2/reverse-mist-fall.png',
  'forest-region-part-2-wetland-reflection': 'effects/part-2/wetland-reflection.png',

  'forest-region-part-3-ground': 'ground/part-3-root-ruins-ground.png',
  'forest-region-part-3-root-arch': 'sprites/part-3/giant-root-arch.png',
  'forest-region-part-3-root-gate-open': 'sprites/part-3/root-gate-open.png',
  'forest-region-part-3-courtyard': 'ground/part-3-sunken-courtyard.png',
  'forest-region-part-3-clue-idle': 'sprites/part-3/ruin-clue-slab-idle.png',
  'forest-region-part-3-clue-active': 'sprites/part-3/ruin-clue-slab-active.png',

  'forest-region-part-4-ground': 'ground/part-4-night-firefly-path-ground.png',
  'forest-region-part-4-corridor-straight': 'sprites/part-4/tree-corridor-straight.png',
  'forest-region-part-4-corridor-left': 'sprites/part-4/tree-corridor-left.png',
  'forest-region-part-4-corridor-right': 'sprites/part-4/tree-corridor-right.png',
  'forest-region-part-4-moonlight': 'effects/part-4/broken-canopy-moonlight.png',
  'forest-region-part-4-foreground-top': 'sprites/part-4/foreground-branches-top.png',
  'forest-region-part-4-foreground-left': 'sprites/part-4/foreground-branches-left.png',
  'forest-region-part-4-foreground-right': 'sprites/part-4/foreground-branches-right.png',

  'forest-region-part-5-ground': 'ground/part-5-broken-moon-deep-forest-ground.png',
  'forest-region-part-5-basin': 'ground/part-5-mist-convergence-basin.png',
  'forest-region-part-5-landmark': 'sprites/part-5/central-stage-landmark.png',
  'forest-region-part-5-response-idle': 'effects/part-5/broken-moon-response-idle.png',
  'forest-region-part-5-response-active': 'effects/part-5/broken-moon-response-active.png',
  'forest-region-part-5-stable-exit': 'sprites/part-5/deep-forest-stable-exit.png',
}

for (let index = 1; index <= 10; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-2-bank-${suffix}`] = `sprites/part-2/stream-bank/stream-bank-${suffix}.png`
}
for (let index = 1; index <= 12; index += 1) {
  const suffix = String(index).padStart(2, '0')
  if ([1, 3, 5, 7, 9, 12].includes(index)) {
    FOREST_REGION_ASSETS[`forest-region-part-2-foliage-${suffix}`] = `sprites/part-2/aquatic-foliage/aquatic-foliage-${suffix}.png`
  }
  if (index <= 10) {
    FOREST_REGION_ASSETS[`forest-region-part-3-ruin-${suffix}`] = `sprites/part-3/weathered-ruins/weathered-ruin-${suffix}.png`
  }
}
for (let index = 1; index <= 16; index += 1) {
  const suffix = String(index).padStart(2, '0')
  if (index % 2 === 1) {
    FOREST_REGION_ASSETS[`forest-region-part-4-path-${suffix}`] = `sprites/part-4/glowing-path-markers/glowing-path-marker-${suffix}.png`
  }
}
for (let index = 1; index <= 6; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-4-fireflies-${suffix}`] = `effects/part-4/night-fireflies/night-firefly-group-${suffix}.png`
}
for (let index = 1; index <= 3; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-5-wall-${suffix}`] = `sprites/part-5/broken-canopy-tree-wall-${suffix}.png`
}
for (let index = 1; index <= 5; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-5-tree-${suffix}`] = `sprites/part-5/inward-leaning-tree-${suffix}.png`
}

const rectObstacle = (
  x: number,
  y: number,
  texture: string,
  size: number,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  displayHeight = size,
  angle = 0,
): ForestObstacleLayoutItem => ({
  x,
  y,
  texture,
  size,
  displayHeight,
  angle,
  body: { shape: 'rect', width, height, offsetX, offsetY },
})

const PART_1_OBSTACLES: ForestObstacleLayoutItem[] = [
  rectObstacle(620, 440, 'forest-ancient-moon-tree', 620, 200, 80, 210, 430),
  rectObstacle(250, 300, 'forest-tree-common-a', 360, 82, 54, 139, 276),
  rectObstacle(720, 180, 'forest-tree-common-b', 360, 82, 54, 139, 276),
  rectObstacle(1230, 260, 'forest-tree-common-c', 360, 82, 54, 139, 276),
  rectObstacle(1740, 330, 'forest-tree-common-d', 390, 88, 58, 151, 300),
  rectObstacle(1870, 760, 'forest-tree-common-e', 370, 84, 56, 143, 285),
  rectObstacle(1760, 1260, 'forest-tree-common-a', 350, 80, 52, 135, 270),
  rectObstacle(1510, 1780, 'forest-tree-common-b', 360, 82, 54, 139, 276),
  rectObstacle(1030, 1860, 'forest-tree-common-c', 360, 82, 54, 139, 276),
  rectObstacle(560, 1810, 'forest-tree-common-d', 390, 88, 58, 151, 300),
  rectObstacle(180, 1590, 'forest-tree-common-e', 360, 82, 54, 139, 276),
  rectObstacle(210, 1040, 'forest-tree-common-a', 350, 80, 52, 135, 270),
  rectObstacle(1200, 720, 'forest-root-obstacle-a', 220, 160, 62, 30, 94),
  rectObstacle(1460, 920, 'forest-root-obstacle-b', 220, 160, 62, 30, 94),
  rectObstacle(760, 1210, 'forest-root-obstacle-c', 220, 160, 62, 30, 94),
  rectObstacle(410, 1470, 'forest-root-obstacle-d', 220, 160, 62, 30, 94),
  { x: 1180, y: 1520, texture: 'forest-rock-cluster', size: 170, body: { shape: 'circle', radius: 48, offsetX: 37, offsetY: 74 } },
  { x: 360, y: 760, texture: 'forest-hollow-stump', size: 170, body: { shape: 'circle', radius: 46, offsetX: 39, offsetY: 76 } },
  { x: 1550, y: 520, texture: 'forest-stump-cold', size: 150, body: { shape: 'circle', radius: 42, offsetX: 33, offsetY: 66 } },
  rectObstacle(930, 1450, 'forest-fallen-log', 230, 178, 62, 26, 112),
]

const PART_2_OBSTACLES = [
  [430, 1360, '01'], [650, 1220, '02'], [890, 1090, '03'], [1160, 930, '04'],
  [1390, 760, '05'], [1580, 570, '06'], [350, 930, '07'], [760, 690, '08'],
  [1260, 500, '09'], [1660, 340, '10'],
].map(([x, y, suffix], index) => rectObstacle(
  Number(x),
  Number(y),
  `forest-region-part-2-bank-${suffix}`,
  260,
  180,
  62,
  40,
  160,
  220,
  index % 2 ? -24 : 24,
))

const PART_3_OBSTACLES = [
  [310, 1460, '01'], [560, 1260, '02'], [820, 1540, '03'], [1110, 1380, '04'],
  [1420, 1510, '05'], [1690, 1260, '06'], [360, 690, '07'], [720, 470, '08'],
  [1320, 560, '09'], [1690, 720, '10'],
].map(([x, y, suffix], index) => rectObstacle(
  Number(x),
  Number(y),
  `forest-region-part-3-ruin-${suffix}`,
  index % 3 === 0 ? 260 : 220,
  index % 3 === 0 ? 170 : 140,
  72,
  index % 3 === 0 ? 45 : 40,
  index % 3 === 0 ? 142 : 120,
))

const PART_4_OBSTACLES: ForestObstacleLayoutItem[] = [
  rectObstacle(410, 340, 'forest-region-part-4-corridor-left', 430, 250, 92, 90, 286, 360),
  rectObstacle(1024, 250, 'forest-region-part-4-corridor-straight', 520, 330, 94, 95, 332, 390),
  rectObstacle(1640, 350, 'forest-region-part-4-corridor-right', 430, 250, 92, 90, 286, 360),
  rectObstacle(310, 930, 'forest-region-part-4-corridor-straight', 480, 300, 90, 90, 310, 370, 90),
  rectObstacle(1740, 930, 'forest-region-part-4-corridor-straight', 480, 300, 90, 90, 310, 370, 90),
  rectObstacle(520, 1630, 'forest-region-part-4-corridor-left', 430, 250, 92, 90, 286, 360, 180),
  rectObstacle(1510, 1640, 'forest-region-part-4-corridor-right', 430, 250, 92, 90, 286, 360, 180),
]

const PART_5_OBSTACLES: ForestObstacleLayoutItem[] = [
  rectObstacle(360, 430, 'forest-region-part-5-wall-01', 430, 250, 94, 90, 286, 360),
  rectObstacle(1024, 270, 'forest-region-part-5-wall-02', 520, 330, 96, 95, 332, 390),
  rectObstacle(1690, 430, 'forest-region-part-5-wall-03', 430, 250, 94, 90, 286, 360),
  ...[
    [390, 1060, '01'], [690, 720, '02'], [1020, 590, '03'], [1370, 730, '04'], [1670, 1060, '05'],
  ].map(([x, y, suffix]) => rectObstacle(
    Number(x),
    Number(y),
    `forest-region-part-5-tree-${suffix}`,
    360,
    92,
    70,
    134,
    280,
  )),
  rectObstacle(1040, 1250, 'forest-region-part-5-landmark', 460, 290, 110, 85, 290),
]

const route = (points: number[], width = 245, height = 90, alpha = 0.78): ForestRouteLayoutItem => ({
  points,
  width,
  height,
  alpha,
})

const pathMarkers = [
  [260, 1690, '01'], [470, 1500, '03'], [690, 1320, '05'], [900, 1120, '07'],
  [1110, 920, '09'], [1320, 720, '11'], [1540, 510, '13'], [1770, 300, '15'],
].map(([x, y, suffix], index): ForestDecorationLayoutItem => ({
  x: Number(x),
  y: Number(y),
  texture: `forest-region-part-4-path-${suffix}`,
  width: 120,
  height: 120,
  alpha: 0.82,
  angle: index % 2 ? -20 : 18,
  depth: Number(y) - 4,
  additive: true,
}))

export const FOREST_REGIONS: Record<ForestRegionKey, ForestRegionConfig> = {
  glimmer_forest_part_1: {
    key: 'glimmer_forest_part_1',
    groundTexture: 'forest-ground-cold-wet',
    routes: [
      route([32, 150, 128, 145, 320, 195, 455, 330, 510, 520, 515, 675, 680, 790, 875, 880, 1040, 1010, 1190, 1180, 1370, 1320, 1510, 1485, 1690, 1630, 1870, 1770, 2048, 1840], 260, 98, 0.92),
      route([455, 330, 560, 440, 650, 520], 210, 78, 0.82),
      route([515, 675, 410, 755, 300, 840], 210, 78, 0.82),
      route([680, 790, 800, 800, 920, 800], 210, 78, 0.82),
      route([875, 880, 760, 960, 760, 1110], 210, 78, 0.82),
      route([1040, 1010, 1080, 1060, 1160, 1120], 210, 78, 0.82),
    ],
    obstacles: PART_1_OBSTACLES,
    decorations: [
      { x: 620, y: 520, texture: 'forest-moon-clearing-overlay', width: 820, height: 820, depth: -8 },
      { x: 620, y: 474, texture: 'forest-broken-moon-mark', width: 118, height: 118, alpha: 0.46, depth: 441, additive: true },
      { x: 1024, y: 1024, texture: 'forest-reverse-mist-back', width: 2048, height: 2048, alpha: 0.11, depth: -7, tile: true, motion: { type: 'tile', x: 1024, y: 260, duration: 24_000 } },
      { x: 1024, y: 1024, texture: 'forest-reverse-mist-mid', width: 2048, height: 2048, alpha: 0.065, depth: -6, tile: true, motion: { type: 'tile', x: 1024, y: 340, duration: 17_000 } },
    ],
  },
  glimmer_forest_part_2: {
    key: 'glimmer_forest_part_2',
    groundTexture: 'forest-region-part-2-ground',
    routes: [
      route([150, 1840, 320, 1660, 540, 1490, 760, 1320, 1010, 1110, 1260, 900, 1500, 650, 1710, 410, 1900, 210]),
      route([760, 1320, 620, 1100, 510, 860], 205, 72, 0.66),
    ],
    obstacles: PART_2_OBSTACLES,
    decorations: [
      { x: 1040, y: 1040, texture: 'forest-region-part-2-water-flow', width: 1480, height: 350, angle: -38, alpha: 0.86, depth: -8, tile: true, motion: { type: 'tile', x: 360, y: 180, duration: 18_000 } },
      { x: 1030, y: 1040, texture: 'forest-region-part-2-bridge-diagonal', width: 430, height: 286, angle: -6, depth: 1036 },
      { x: 540, y: 1480, texture: 'forest-region-part-2-bridge-horizontal', width: 360, height: 240, angle: 18, depth: 1476 },
      ...['01', '03', '05', '07', '09', '12'].map((suffix, index): ForestDecorationLayoutItem => ({
        x: 280 + index * 290,
        y: 1140 - (index % 3) * 180,
        texture: `forest-region-part-2-foliage-${suffix}`,
        width: 132,
        height: 132,
        depth: 1120 - (index % 3) * 180,
      })),
      { x: 1710, y: 390, texture: 'forest-region-part-2-reverse-mist-fall', width: 520, height: 300, alpha: 0.5, depth: 350, additive: true, motion: { type: 'pulse', from: 0.32, to: 0.58, duration: 3_600 } },
      { x: 900, y: 1130, texture: 'forest-region-part-2-wetland-reflection', width: 720, height: 300, angle: -38, alpha: 0.35, depth: -7, additive: true, motion: { type: 'pulse', from: 0.2, to: 0.42, duration: 2_800 } },
    ],
  },
  glimmer_forest_part_3: {
    key: 'glimmer_forest_part_3',
    groundTexture: 'forest-region-part-3-ground',
    routes: [
      route([150, 1840, 360, 1640, 610, 1450, 830, 1260, 1020, 1030, 1240, 790, 1510, 580, 1770, 390, 1900, 210]),
      route([830, 1260, 680, 1040, 560, 820], 205, 72, 0.68),
    ],
    obstacles: PART_3_OBSTACLES,
    decorations: [
      { x: 1030, y: 1040, texture: 'forest-region-part-3-courtyard', width: 900, height: 900, alpha: 0.9, depth: -8 },
      { x: 1030, y: 680, texture: 'forest-region-part-3-root-arch', width: 600, height: 600, depth: 640 },
      { x: 1770, y: 350, texture: 'forest-region-part-3-root-gate-open', width: 440, height: 440, depth: 330 },
      { x: 680, y: 1060, texture: 'forest-region-part-3-clue-idle', width: 210, height: 210, depth: 1058 },
      { x: 1430, y: 980, texture: 'forest-region-part-3-clue-active', width: 210, height: 210, alpha: 0.82, depth: 978, additive: true, motion: { type: 'pulse', from: 0.55, to: 0.9, duration: 2_600 } },
    ],
  },
  glimmer_forest_part_4: {
    key: 'glimmer_forest_part_4',
    groundTexture: 'forest-region-part-4-ground',
    routes: [
      route([150, 1840, 350, 1670, 560, 1490, 780, 1300, 1000, 1080, 1220, 870, 1450, 650, 1680, 430, 1900, 210], 225, 76, 0.55),
      route([1000, 1080, 1180, 1220, 1370, 1390], 180, 64, 0.42),
    ],
    obstacles: PART_4_OBSTACLES,
    decorations: [
      ...pathMarkers,
      ...['01', '02', '03', '04', '05', '06'].map((suffix, index): ForestDecorationLayoutItem => ({
        x: 340 + index * 270,
        y: 720 + (index % 2) * 460,
        texture: `forest-region-part-4-fireflies-${suffix}`,
        width: 250,
        height: 250,
        alpha: 0.62,
        depth: 700 + (index % 2) * 460,
        additive: true,
        motion: { type: 'pulse', from: 0.28, to: 0.7, duration: 2_200 + index * 190 },
      })),
      { x: 1050, y: 1030, texture: 'forest-region-part-4-moonlight', width: 1040, height: 1040, alpha: 0.42, depth: -7, additive: true },
      { x: 1024, y: 150, texture: 'forest-region-part-4-foreground-top', width: 1500, height: 750, alpha: 0.88, depth: 8_000 },
      { x: 160, y: 1030, texture: 'forest-region-part-4-foreground-left', width: 650, height: 1050, alpha: 0.82, depth: 8_001 },
      { x: 1888, y: 1030, texture: 'forest-region-part-4-foreground-right', width: 650, height: 1050, alpha: 0.82, depth: 8_001 },
    ],
  },
  glimmer_forest_part_5: {
    key: 'glimmer_forest_part_5',
    groundTexture: 'forest-region-part-5-ground',
    routes: [
      route([150, 1840, 360, 1690, 590, 1510, 820, 1380, 1040, 1250], 235, 82, 0.48),
      route([1040, 1250, 1240, 1010, 1460, 760, 1720, 480], 205, 70, 0.42),
    ],
    obstacles: PART_5_OBSTACLES,
    decorations: [
      { x: 1040, y: 1240, texture: 'forest-region-part-5-basin', width: 1080, height: 1080, alpha: 0.92, depth: -8 },
      { x: 1040, y: 1120, texture: 'forest-region-part-5-response-idle', width: 720, height: 720, alpha: 0.55, depth: 1080, additive: true },
      { x: 1040, y: 1120, texture: 'forest-region-part-5-response-active', width: 720, height: 720, alpha: 0.35, depth: 1081, additive: true, motion: { type: 'pulse', from: 0.1, to: 0.42, duration: 3_200 } },
      { x: 420, y: 1600, texture: 'forest-region-part-5-stable-exit', width: 270, height: 270, depth: 1580 },
    ],
  },
}

export function resolveForestRegionKey(regionKey: string | undefined): ForestRegionKey {
  return FOREST_REGION_KEYS.includes(regionKey as ForestRegionKey)
    ? regionKey as ForestRegionKey
    : 'glimmer_forest_part_1'
}

export function getForestRegionConfig(regionKey: string | undefined): ForestRegionConfig {
  return FOREST_REGIONS[resolveForestRegionKey(regionKey)]
}
