export const FOREST_REGION_KEYS = [
  'glimmer_forest_part_1',
  'glimmer_forest_part_2',
  'glimmer_forest_part_3',
  'glimmer_forest_part_4',
  'glimmer_forest_part_5',
] as const

export const FOREST_REGION_ASSET_ROOT = '/assets/generated/environment/glimmer-forest/regions-v2'

export type ForestRegionKey = typeof FOREST_REGION_KEYS[number]
export type ForestPoint = Readonly<{ x: number; y: number }>
export type ForestDepthRole = 'ground-decal' | 'underlay' | 'world' | 'canopy' | 'foreground' | 'effect'

export type ForestGroundLayer = {
  id: string
  texture: string
  x?: number
  y?: number
  angle?: number
  alpha?: number
  tile?: boolean
  width?: number
  height?: number
  depthRole: 'ground-decal' | 'underlay'
}

export type ForestPath = {
  id: string
  role: 'main' | 'branch' | 'false'
  points: readonly ForestPoint[]
  width: number
  texture: string
  alpha: number
}

export type ForestProp = {
  id: string
  texture: string
  x: number
  y: number
  width: number
  height: number
  origin?: ForestPoint
  angle?: number
  alpha?: number
  additive?: boolean
  depthRole: ForestDepthRole
  alphaFootpoint?: {
    sourceHeight: number
    alphaBottom: number
  }
}

export type ForestCollider = {
  id: string
  debugLabel: string
  shape: 'rect' | 'circle'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  role: 'boundary' | 'trunk' | 'ruin' | 'water' | 'landmark'
  visualRef?: string
}

export type ForestLandmark = ForestProp & {
  interactionClearance?: { width: number; height: number }
}

export type ForestEffect = ForestProp & {
  motion?:
    | { type: 'tile'; x: number; y: number; duration: number }
    | { type: 'pulse'; from: number; to: number; duration: number }
}

export type ForestForeground = ForestProp & {
  fadeRadius: number
  fadedAlpha: number
}

export type ForestSafeZone = {
  id: string
  role: 'spawn' | 'portal' | 'interaction' | 'performance'
  x: number
  y: number
  width: number
  height: number
}

// Compatibility types remain while WorldScene migrates to the V2 authoritative fields below.
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

export type ForestRouteLayoutItem = { points: number[]; width: number; height: number; alpha: number }
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
  motion?: ForestEffect['motion']
}

export type ForestRegionConfig = {
  key: ForestRegionKey
  groundLayers: readonly ForestGroundLayer[]
  paths: readonly ForestPath[]
  props: readonly ForestProp[]
  colliders: readonly ForestCollider[]
  landmarks: readonly ForestLandmark[]
  effects: readonly ForestEffect[]
  foreground: readonly ForestForeground[]
  safeZones: readonly ForestSafeZone[]
  groundTexture: string
  routes: ForestRouteLayoutItem[]
  obstacles: ForestObstacleLayoutItem[]
  decorations: ForestDecorationLayoutItem[]
}

export const FOREST_REGION_ASSETS: Record<string, string> = {
  'forest-region-exit-left': 'sprites/common/forest-exit-silver-mist-left.png',
  'forest-region-exit-right': 'sprites/common/forest-exit-silver-mist-right.png',
}

for (const part of [2, 3, 4, 5]) {
  const name = {
    2: 'silver-mist-valley',
    3: 'root-ruins',
    4: 'night-firefly-path',
    5: 'broken-moon-deep-forest',
  }[part]
  for (let variant = 1; variant <= 3; variant += 1) {
    FOREST_REGION_ASSETS[`forest-region-part-${part}-ground-${variant}`] = `ground/part-${part}-${name}-ground-${variant}.png`
  }
  FOREST_REGION_ASSETS[`forest-region-part-${part}-macro`] = `ground/part-${part}-macro-overlay.png`
}

Object.assign(FOREST_REGION_ASSETS, {
  'forest-region-part-2-water-flow': 'ground/part-2-stream-water-flow.png',
  'forest-region-part-2-bridge-horizontal': 'sprites/part-2/fallen-log-bridge-horizontal.png',
  'forest-region-part-2-bridge-diagonal': 'sprites/part-2/fallen-log-bridge-diagonal.png',
  'forest-region-part-2-reverse-mist-fall': 'effects/part-2/reverse-mist-fall.png',
  'forest-region-part-2-wetland-reflection': 'effects/part-2/wetland-reflection.png',
  'forest-region-part-3-root-arch': 'sprites/part-3/giant-root-arch.png',
  'forest-region-part-3-root-gate-open': 'sprites/part-3/root-gate-open.png',
  'forest-region-part-3-courtyard': 'ground/part-3-sunken-courtyard.png',
  'forest-region-part-3-clue-idle': 'sprites/part-3/ruin-clue-slab-idle.png',
  'forest-region-part-3-clue-active': 'sprites/part-3/ruin-clue-slab-active.png',
  'forest-region-part-4-moonlight': 'effects/part-4/broken-canopy-moonlight.png',
  'forest-region-part-4-foreground-top': 'sprites/part-4/foreground-branches-top.png',
  'forest-region-part-4-foreground-left': 'sprites/part-4/foreground-branches-left.png',
  'forest-region-part-4-foreground-right': 'sprites/part-4/foreground-branches-right.png',
  'forest-region-part-5-basin-edge': 'ground/part-5-mist-convergence-basin-edge.png',
  'forest-region-part-5-basin-mist': 'effects/part-5/mist-convergence-basin-mist.png',
  'forest-region-part-5-landmark': 'sprites/part-5/central-stage-landmark.png',
  'forest-region-part-5-response-idle': 'effects/part-5/broken-moon-response-idle.png',
  'forest-region-part-5-response-active': 'effects/part-5/broken-moon-response-active.png',
  'forest-region-part-5-stable-exit': 'sprites/part-5/deep-forest-stable-exit.png',
})

for (let index = 1; index <= 10; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-2-bank-${suffix}`] = `sprites/part-2/stream-bank/stream-bank-${suffix}.png`
  FOREST_REGION_ASSETS[`forest-region-part-3-ruin-${suffix}`] = `sprites/part-3/weathered-ruins/weathered-ruin-${suffix}.png`
}
for (let index = 1; index <= 6; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-2-foliage-${suffix}`] = `sprites/part-2/aquatic-foliage/aquatic-foliage-${suffix}.png`
  FOREST_REGION_ASSETS[`forest-region-part-4-fireflies-${suffix}`] = `effects/part-4/night-fireflies/night-firefly-group-${suffix}.png`
}
for (let index = 1; index <= 8; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-4-path-${suffix}`] = `sprites/part-4/glowing-path-markers/glowing-path-marker-${suffix}.png`
  FOREST_REGION_ASSETS[`forest-region-part-4-false-path-${suffix}`] = `sprites/part-4/false-path-markers/false-path-marker-${suffix}.png`
}
for (const side of ['left', 'straight', 'right']) {
  for (const angle of [0, 45, 90, 135]) {
    FOREST_REGION_ASSETS[`forest-region-part-4-corridor-${side}-${angle}`] = `sprites/part-4/tree-corridor-${side}-${angle}.png`
  }
}
for (let index = 1; index <= 3; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-5-wall-${suffix}`] = `sprites/part-5/broken-canopy-tree-wall-${suffix}.png`
}
for (let index = 1; index <= 5; index += 1) {
  const suffix = String(index).padStart(2, '0')
  FOREST_REGION_ASSETS[`forest-region-part-5-tree-${suffix}`] = `sprites/part-5/inward-leaning-tree-${suffix}.png`
}

const point = (x: number, y: number): ForestPoint => ({ x, y })
const FOREST_ALPHA_FOOTPOINTS: Readonly<Record<string, ForestProp['alphaFootpoint']>> = {
  'forest-ancient-moon-tree': { sourceHeight: 1024, alphaBottom: 846 },
  'forest-tree-common-a': { sourceHeight: 640, alphaBottom: 572 },
  'forest-tree-common-b': { sourceHeight: 640, alphaBottom: 589 },
  'forest-tree-common-c': { sourceHeight: 640, alphaBottom: 582 },
  'forest-tree-common-d': { sourceHeight: 640, alphaBottom: 556 },
  'forest-tree-common-e': { sourceHeight: 640, alphaBottom: 566 },
  'forest-root-obstacle-a': { sourceHeight: 512, alphaBottom: 471 },
  'forest-root-obstacle-b': { sourceHeight: 512, alphaBottom: 475 },
  'forest-root-obstacle-c': { sourceHeight: 512, alphaBottom: 463 },
  'forest-root-obstacle-d': { sourceHeight: 512, alphaBottom: 453 },
  'forest-rock-cluster': { sourceHeight: 512, alphaBottom: 465 },
  'forest-hollow-stump': { sourceHeight: 512, alphaBottom: 447 },
  'forest-stump-cold': { sourceHeight: 512, alphaBottom: 414 },
  'forest-fallen-log': { sourceHeight: 512, alphaBottom: 426 },
  'forest-region-part-2-bridge-horizontal': { sourceHeight: 438, alphaBottom: 426 },
  'forest-region-part-2-bridge-diagonal': { sourceHeight: 438, alphaBottom: 426 },
  'forest-region-part-3-ruin-01': { sourceHeight: 262, alphaBottom: 250 },
  'forest-region-part-3-ruin-02': { sourceHeight: 248, alphaBottom: 236 },
  'forest-region-part-3-ruin-03': { sourceHeight: 235, alphaBottom: 223 },
  'forest-region-part-3-ruin-04': { sourceHeight: 253, alphaBottom: 241 },
  'forest-region-part-3-ruin-05': { sourceHeight: 251, alphaBottom: 239 },
  'forest-region-part-3-ruin-06': { sourceHeight: 188, alphaBottom: 176 },
  'forest-region-part-3-ruin-07': { sourceHeight: 254, alphaBottom: 242 },
  'forest-region-part-3-ruin-08': { sourceHeight: 77, alphaBottom: 65 },
  'forest-region-part-3-ruin-09': { sourceHeight: 204, alphaBottom: 192 },
  'forest-region-part-3-ruin-10': { sourceHeight: 291, alphaBottom: 279 },
  'forest-region-part-3-root-arch': { sourceHeight: 734, alphaBottom: 722 },
  'forest-region-part-3-root-gate-open': { sourceHeight: 638, alphaBottom: 626 },
  'forest-region-part-3-clue-idle': { sourceHeight: 335, alphaBottom: 323 },
  'forest-region-part-3-clue-active': { sourceHeight: 335, alphaBottom: 323 },
  'forest-region-part-4-corridor-left-45': { sourceHeight: 709, alphaBottom: 697 },
  'forest-region-part-4-corridor-right-45': { sourceHeight: 406, alphaBottom: 394 },
  'forest-region-part-5-wall-01': { sourceHeight: 812, alphaBottom: 800 },
  'forest-region-part-5-wall-02': { sourceHeight: 807, alphaBottom: 795 },
  'forest-region-part-5-wall-03': { sourceHeight: 805, alphaBottom: 793 },
  'forest-region-part-5-tree-01': { sourceHeight: 440, alphaBottom: 428 },
  'forest-region-part-5-tree-02': { sourceHeight: 444, alphaBottom: 432 },
  'forest-region-part-5-tree-03': { sourceHeight: 502, alphaBottom: 490 },
  'forest-region-part-5-tree-04': { sourceHeight: 440, alphaBottom: 428 },
  'forest-region-part-5-tree-05': { sourceHeight: 437, alphaBottom: 425 },
  'forest-region-part-5-landmark': { sourceHeight: 716, alphaBottom: 704 },
  'forest-region-part-5-stable-exit': { sourceHeight: 536, alphaBottom: 524 },
}
const path = (id: string, role: ForestPath['role'], coordinates: readonly [number, number][], width: number, alpha = 0.72): ForestPath => ({
  id,
  role,
  points: coordinates.map(([x, y]) => point(x, y)),
  width,
  texture: 'forest-path-wet-soil-overlay',
  alpha,
})
const prop = (id: string, texture: string, x: number, y: number, width: number, height: number, depthRole: ForestDepthRole = 'world', angle = 0): ForestProp => ({
  id,
  texture,
  x,
  y,
  width,
  height,
  depthRole,
  angle,
  origin: ['ground-decal', 'underlay', 'effect', 'foreground'].includes(depthRole) ? point(0.5, 0.5) : point(0.5, 1),
  alphaFootpoint: FOREST_ALPHA_FOOTPOINTS[texture],
})
const rect = (id: string, debugLabel: string, x: number, y: number, width: number, height: number, role: ForestCollider['role'], visualRef?: string): ForestCollider => ({ id, debugLabel, shape: 'rect', x, y, width, height, role, visualRef })
const circle = (id: string, debugLabel: string, x: number, y: number, radius: number, role: ForestCollider['role'], visualRef?: string): ForestCollider => ({ id, debugLabel, shape: 'circle', x, y, radius, role, visualRef })
const zone = (id: string, role: ForestSafeZone['role'], x: number, y: number, width: number, height: number): ForestSafeZone => ({ id, role, x, y, width, height })

const PART_1_PATHS = [
  path('p1-main', 'main', [[1800, 1740], [1600, 1560], [1450, 1420], [1240, 1250], [1050, 1060], [900, 860], [760, 680], [620, 520]], 260, 0.9),
  path('p1-exit', 'branch', [[1240, 1250], [1460, 1060], [1660, 790], [1810, 510], [1880, 260]], 220),
  path('p1-investigation', 'branch', [[1050, 1060], [790, 1120], [560, 1320], [390, 1460], [650, 1580], [980, 1450], [1240, 1250]], 200),
]

const PART_1_PROPS: ForestProp[] = [
  prop('p1-tree-a1', 'forest-tree-common-a', 220, 360, 340, 360), prop('p1-tree-a2', 'forest-tree-common-a', 260, 1080, 330, 350),
  prop('p1-tree-b1', 'forest-tree-common-b', 760, 220, 350, 370), prop('p1-tree-b2', 'forest-tree-common-b', 1480, 1780, 350, 370),
  prop('p1-tree-c1', 'forest-tree-common-c', 1240, 250, 350, 370), prop('p1-tree-c2', 'forest-tree-common-c', 1010, 1880, 350, 370),
  prop('p1-tree-d1', 'forest-tree-common-d', 1720, 430, 370, 390), prop('p1-tree-d2', 'forest-tree-common-d', 560, 1810, 370, 390),
  prop('p1-tree-e1', 'forest-tree-common-e', 1880, 820, 350, 370), prop('p1-tree-e2', 'forest-tree-common-e', 210, 1580, 360, 380),
  prop('p1-root-a', 'forest-root-obstacle-a', 1160, 650, 200, 180), prop('p1-root-b', 'forest-root-obstacle-b', 1510, 870, 210, 190),
  prop('p1-root-c', 'forest-root-obstacle-c', 700, 1240, 200, 180), prop('p1-root-d', 'forest-root-obstacle-d', 420, 1390, 210, 190),
  prop('p1-rock', 'forest-rock-cluster', 1160, 1560, 150, 150), prop('p1-hollow', 'forest-hollow-stump', 320, 790, 150, 150),
  prop('p1-stump', 'forest-stump-cold', 1570, 540, 140, 140), prop('p1-log', 'forest-fallen-log', 900, 1500, 210, 160),
]

const PART_1_LANDMARKS: ForestLandmark[] = [
  { ...prop('p1-ancient-tree', 'forest-ancient-moon-tree', 620, 440, 570, 620, 'canopy'), interactionClearance: { width: 260, height: 220 } },
  { ...prop('p1-clearing', 'forest-moon-clearing-overlay', 620, 520, 700, 620, 'ground-decal'), origin: point(0.5, 0.5) },
  { ...prop('p1-moon-mark', 'forest-broken-moon-mark', 620, 474, 118, 118, 'underlay'), additive: true, alpha: 0.46, origin: point(0.5, 0.5) },
]

export function resolveForestVisibleFootY(visual: ForestProp): number | undefined {
  if (!visual.alphaFootpoint) return undefined
  const { sourceHeight, alphaBottom } = visual.alphaFootpoint
  return visual.y - visual.height * (1 - alphaBottom / sourceHeight)
}

export function resolveForestVisualDepth(visual: ForestProp): number {
  if (visual.depthRole === 'ground-decal') return -8
  if (visual.depthRole === 'underlay') return -6
  if (visual.depthRole === 'effect') return 7_000
  if (visual.depthRole === 'foreground') return 8_000
  return resolveForestVisibleFootY(visual) ?? visual.y
}

type ForestVisualMap = ReadonlyMap<string, ForestProp>
function requireVisibleVisual(visuals: ForestVisualMap, id: string): ForestProp {
  const visual = visuals.get(id)
  if (!visual || resolveForestVisibleFootY(visual) === undefined) throw new Error(`Missing visual footprint: ${id}`)
  return visual
}
function circleAtVisibleFoot(visuals: ForestVisualMap, id: string, debugLabel: string, visualId: string, radius: number, role: ForestCollider['role'], x?: number): ForestCollider {
  const visual = requireVisibleVisual(visuals, visualId)
  return circle(id, debugLabel, x ?? visual.x, resolveForestVisibleFootY(visual)! - radius, radius, role, visualId)
}
function rectAtVisibleFoot(visuals: ForestVisualMap, id: string, debugLabel: string, visualId: string, width: number, height: number, role: ForestCollider['role'], x?: number): ForestCollider {
  const visual = requireVisibleVisual(visuals, visualId)
  return rect(id, debugLabel, x ?? visual.x, resolveForestVisibleFootY(visual)! - height / 2, width, height, role, visualId)
}

const part1VisualsById = new Map([...PART_1_PROPS, ...PART_1_LANDMARKS].map((item) => [item.id, item]))
const PART_1_COLLIDERS: ForestCollider[] = [
  rect('p1-ancient-trunk', 'ancient moon tree trunk', 620, 260, 116, 76, 'landmark', 'p1-ancient-tree'),
  ...PART_1_PROPS.filter((item) => item.id.startsWith('p1-tree')).map((item) => circleAtVisibleFoot(part1VisualsById, `${item.id}-trunk`, `${item.id} trunk`, item.id, 34, 'trunk')),
  rectAtVisibleFoot(part1VisualsById, 'p1-root-a-body', 'northeast root A', 'p1-root-a', 132, 46, 'boundary'), rectAtVisibleFoot(part1VisualsById, 'p1-root-b-body', 'northeast root B', 'p1-root-b', 138, 48, 'boundary'),
  rectAtVisibleFoot(part1VisualsById, 'p1-root-c-body', 'investigation root C', 'p1-root-c', 130, 44, 'boundary'), rectAtVisibleFoot(part1VisualsById, 'p1-root-d-body', 'investigation root D', 'p1-root-d', 136, 46, 'boundary'),
  rectAtVisibleFoot(part1VisualsById, 'p1-rock-body', 'rock cluster base', 'p1-rock', 120, 62, 'landmark'), circleAtVisibleFoot(part1VisualsById, 'p1-hollow-body', 'hollow stump base', 'p1-hollow', 34, 'landmark'),
  circleAtVisibleFoot(part1VisualsById, 'p1-stump-body', 'cold stump base', 'p1-stump', 32, 'landmark'), rectAtVisibleFoot(part1VisualsById, 'p1-log-body', 'fallen log body', 'p1-log', 154, 42, 'boundary'),
]

const PART_2_PATHS = [
  path('p2-main', 'main', [[280, 1700], [470, 1540], [660, 1380], [820, 1190], [1030, 1040], [1220, 850], [1420, 660], [1640, 430], [1840, 260]], 260, 0.82),
  path('p2-wetland', 'branch', [[660, 1380], [520, 1120], [500, 820], [620, 760]], 190, 0.64),
]
const p2Banks = [[250, 470, 24], [520, 620, 28], [760, 770, 31], [1280, 1130, 28], [1610, 1320, 22], [210, 680, 24], [500, 830, 29], [760, 990, 32], [1420, 1450, 27], [1760, 1590, 18]].map(([x, y, angle], index) => prop(`p2-bank-${index + 1}`, `forest-region-part-2-bank-${String(index + 1).padStart(2, '0')}`, x, y, 270, 190, 'ground-decal', angle))
const p2Foliage = [[300, 760], [560, 930], [720, 600], [1260, 1320], [1540, 1180], [1780, 1480]].map(([x, y], index) => prop(`p2-foliage-${index + 1}`, `forest-region-part-2-foliage-${String(index + 1).padStart(2, '0')}`, x, y, 120, 120, 'underlay'))
const PART_2_COLLIDERS: ForestCollider[] = [
  rect('p2-water-n1', 'north bank 1', 330, 555, 250, 54, 'water'), rect('p2-water-n2', 'north bank 2', 590, 690, 250, 54, 'water'), rect('p2-water-n3', 'north bank 3', 790, 820, 190, 52, 'water'),
  rect('p2-water-n4', 'north bank 4', 1280, 1160, 230, 52, 'water'), rect('p2-water-n5', 'north bank 5', 1530, 1320, 240, 52, 'water'), rect('p2-water-n6', 'north bank 6', 1810, 1480, 260, 52, 'water'),
  rect('p2-water-s1', 'south bank 1', 250, 725, 220, 54, 'water'), rect('p2-water-s2', 'south bank 2', 520, 865, 230, 54, 'water'), rect('p2-water-s3', 'south bank 3', 760, 1010, 180, 52, 'water'),
  rect('p2-water-s4', 'south bank 4', 1370, 1390, 230, 52, 'water'), rect('p2-water-s5', 'south bank 5', 1650, 1530, 240, 52, 'water'), rect('p2-water-s6', 'south bank 6', 1930, 1600, 210, 52, 'water'),
]

const PART_3_PATHS = [
  path('p3-main', 'main', [[280, 1700], [480, 1540], [700, 1400], [890, 1220], [1030, 1040], [1220, 850], [1450, 650], [1680, 430], [1840, 260]], 260, 0.78),
  path('p3-investigation', 'branch', [[890, 1220], [650, 1080], [560, 820], [760, 650], [1030, 680], [1220, 850]], 190, 0.66),
]
const ruinPositions = [[500, 1190], [470, 920], [620, 680], [840, 520], [1220, 520], [1450, 690], [1580, 940], [1500, 1240], [1200, 1460], [760, 1440]]
const PART_3_PROPS = ruinPositions.map(([x, y], index) => prop(`p3-ruin-${index + 1}`, `forest-region-part-3-ruin-${String(index + 1).padStart(2, '0')}`, x, y, index % 3 === 0 ? 240 : 210, index % 3 === 0 ? 230 : 190))
const PART_3_LANDMARKS: ForestLandmark[] = [
  { ...prop('p3-root-arch', 'forest-region-part-3-root-arch', 1030, 680, 600, 600, 'canopy'), interactionClearance: { width: 180, height: 220 } },
  prop('p3-root-gate', 'forest-region-part-3-root-gate-open', 1770, 350, 440, 440, 'canopy'),
  prop('p3-clue-idle', 'forest-region-part-3-clue-idle', 680, 1060, 190, 190),
  prop('p3-clue-active', 'forest-region-part-3-clue-active', 1430, 980, 190, 190),
]
const part3VisualsById = new Map([...PART_3_PROPS, ...PART_3_LANDMARKS].map((item) => [item.id, item]))
const PART_3_COLLIDERS: ForestCollider[] = [
  circleAtVisibleFoot(part3VisualsById, 'p3-ruin-1-body', 'west entrance pillar', 'p3-ruin-1', 30, 'ruin'), rectAtVisibleFoot(part3VisualsById, 'p3-ruin-2-body', 'west low wall', 'p3-ruin-2', 104, 38, 'ruin'),
  circleAtVisibleFoot(part3VisualsById, 'p3-ruin-3-body', 'northwest rubble', 'p3-ruin-3', 28, 'ruin'), rectAtVisibleFoot(part3VisualsById, 'p3-ruin-4-body', 'north wall left', 'p3-ruin-4', 112, 38, 'ruin'),
  rectAtVisibleFoot(part3VisualsById, 'p3-ruin-5-body', 'north wall right', 'p3-ruin-5', 112, 38, 'ruin'), circleAtVisibleFoot(part3VisualsById, 'p3-ruin-6-body', 'northeast pillar', 'p3-ruin-6', 30, 'ruin'),
  rectAtVisibleFoot(part3VisualsById, 'p3-ruin-7-body', 'east low wall', 'p3-ruin-7', 106, 38, 'ruin'), circleAtVisibleFoot(part3VisualsById, 'p3-ruin-8-body', 'southeast rubble', 'p3-ruin-8', 28, 'ruin'),
  rectAtVisibleFoot(part3VisualsById, 'p3-ruin-9-body', 'south low wall', 'p3-ruin-9', 108, 38, 'ruin'), circleAtVisibleFoot(part3VisualsById, 'p3-ruin-10-body', 'southwest pillar', 'p3-ruin-10', 30, 'ruin'),
  rectAtVisibleFoot(part3VisualsById, 'p3-arch-left', 'root arch left foot', 'p3-root-arch', 58, 82, 'landmark', 930), rectAtVisibleFoot(part3VisualsById, 'p3-arch-right', 'root arch right foot', 'p3-root-arch', 58, 82, 'landmark', 1130),
  rectAtVisibleFoot(part3VisualsById, 'p3-gate-left', 'exit gate left foot', 'p3-root-gate', 48, 72, 'landmark', 1600), rectAtVisibleFoot(part3VisualsById, 'p3-gate-right', 'exit gate right foot', 'p3-root-gate', 48, 72, 'landmark', 1720),
  rectAtVisibleFoot(part3VisualsById, 'p3-clue-idle-body', 'idle clue slab base', 'p3-clue-idle', 84, 34, 'landmark'),
  rectAtVisibleFoot(part3VisualsById, 'p3-clue-active-body', 'active clue slab base', 'p3-clue-active', 84, 34, 'landmark'),
]

const PART_4_PATHS = [
  path('p4-main', 'main', [[280, 1700], [450, 1540], [620, 1370], [820, 1240], [980, 1050], [1150, 900], [1340, 760], [1520, 590], [1730, 410], [1840, 260]], 250, 0.7),
  path('p4-false', 'false', [[980, 1050], [1180, 1220], [1380, 1370], [1530, 1430]], 180, 0.4),
]
const corridorPositions = [[360, 1540], [590, 1320], [790, 1110], [1040, 860], [1320, 650], [1570, 450], [540, 1740], [760, 1510], [980, 1300], [1210, 1080], [1460, 850], [1740, 610]]
const PART_4_PROPS = corridorPositions.map(([x, y], index) => prop(`p4-corridor-${index + 1}`, `forest-region-part-4-corridor-${index < 6 ? 'left' : 'right'}-${[45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45][index]}`, x, y, 330, 310, 'canopy'))
const pathMarkerPositions = [[300, 1680], [500, 1490], [700, 1320], [920, 1110], [1160, 900], [1370, 730], [1580, 540], [1780, 340]]
const falseMarkerPositions = [[1080, 1140], [1190, 1230], [1300, 1320], [1410, 1390], [1490, 1430], [1350, 1450]]
const part4VisualsById = new Map(PART_4_PROPS.map((item) => [item.id, item]))
const PART_4_COLLIDERS = corridorPositions.map(([x], index) => rectAtVisibleFoot(
  part4VisualsById,
  `p4-boundary-${index + 1}`,
  `tree corridor boundary ${index + 1}`,
  `p4-corridor-${index + 1}`,
  72,
  96,
  'boundary',
  x + (index < 6 ? -78 : 78),
))

const PART_5_PATHS = [
  path('p5-entry', 'main', [[280, 1700], [470, 1530], [650, 1410], [820, 1320], [920, 1240], [1040, 1120]], 260, 0.68),
  path('p5-ring', 'branch', [[1040, 640], [1380, 760], [1560, 1040], [1450, 1360], [1240, 1440], [1040, 1510], [650, 1390], [520, 1060], [680, 760], [1040, 640]], 200, 0.5),
]
const treePositions = [[540, 700], [1040, 520], [1510, 700], [1690, 1100], [1490, 1510]]
const PART_5_PROPS = [
  prop('p5-wall-1', 'forest-region-part-5-wall-01', 430, 330, 520, 430, 'canopy'), prop('p5-wall-2', 'forest-region-part-5-wall-02', 1024, 250, 620, 460, 'canopy'), prop('p5-wall-3', 'forest-region-part-5-wall-03', 1610, 330, 520, 430, 'canopy'),
  ...treePositions.map(([x, y], index) => prop(`p5-tree-${index + 1}`, `forest-region-part-5-tree-${String(index + 1).padStart(2, '0')}`, x, y, 330, 390)),
]
const PART_5_LANDMARKS: ForestLandmark[] = [
  prop('p5-landmark', 'forest-region-part-5-landmark', 1040, 1120, 520, 520),
  prop('p5-stable-exit', 'forest-region-part-5-stable-exit', 330, 1680, 270, 270, 'canopy'),
]
const part5VisualsById = new Map([...PART_5_PROPS, ...PART_5_LANDMARKS].map((item) => [item.id, item]))
const PART_5_COLLIDERS: ForestCollider[] = [
  rectAtVisibleFoot(part5VisualsById, 'p5-north-boundary-1', 'north tree wall left', 'p5-wall-1', 420, 58, 'boundary'), rectAtVisibleFoot(part5VisualsById, 'p5-north-boundary-2', 'north tree wall center', 'p5-wall-2', 520, 58, 'boundary'), rectAtVisibleFoot(part5VisualsById, 'p5-north-boundary-3', 'north tree wall right', 'p5-wall-3', 420, 58, 'boundary'),
  ...treePositions.map((_, index) => circleAtVisibleFoot(part5VisualsById, `p5-tree-${index + 1}-trunk`, `inward tree ${index + 1} trunk`, `p5-tree-${index + 1}`, [34, 38, 35, 37, 36][index], 'trunk')),
  rectAtVisibleFoot(part5VisualsById, 'p5-landmark-root-left', 'central landmark left root', 'p5-landmark', 70, 80, 'landmark', 740),
  rectAtVisibleFoot(part5VisualsById, 'p5-landmark-root-right', 'central landmark right root', 'p5-landmark', 70, 80, 'landmark', 1340),
]

function legacyObstacleItems(props: readonly ForestProp[], colliders: readonly ForestCollider[]): ForestObstacleLayoutItem[] {
  const propById = new Map(props.map((item) => [item.id, item]))
  return colliders.flatMap((collider) => {
    if (!collider.visualRef) return []
    const visual = propById.get(collider.visualRef)
    if (!visual) return []
    const size = visual.width
    const displayHeight = visual.height
    return [{
      x: collider.x,
      y: collider.y,
      texture: visual.texture,
      size,
      displayHeight,
      angle: visual.angle,
      body: collider.shape === 'circle'
        ? { shape: 'circle' as const, radius: collider.radius ?? 1, offsetX: size / 2 - (collider.radius ?? 1), offsetY: displayHeight - (collider.radius ?? 1) * 2 }
        : { shape: 'rect' as const, width: collider.width ?? 1, height: collider.height ?? 1, offsetX: (size - (collider.width ?? 1)) / 2, offsetY: displayHeight - (collider.height ?? 1) },
    }]
  })
}

function legacyDecorations(config: Pick<ForestRegionConfig, 'groundLayers' | 'props' | 'landmarks' | 'effects' | 'foreground'>): ForestDecorationLayoutItem[] {
  const ground = config.groundLayers.slice(1).map((item) => ({ x: item.x ?? 1024, y: item.y ?? 1024, texture: item.texture, width: item.width ?? 2048, height: item.height ?? 2048, alpha: item.alpha, angle: item.angle, depth: -8, tile: item.tile }))
  return [...ground, ...config.props, ...config.landmarks, ...config.effects, ...config.foreground].map((item) => ({
    x: 'x' in item ? item.x : 1024,
    y: 'y' in item ? item.y : 1024,
    texture: item.texture,
    width: item.width,
    height: item.height,
    alpha: item.alpha,
    angle: 'angle' in item ? item.angle : 0,
    depth: 'depthRole' in item && item.depthRole === 'foreground' ? 8_000 : ('y' in item ? item.y : -8),
    additive: 'additive' in item ? item.additive : false,
    motion: 'motion' in item ? (item as ForestEffect).motion : undefined,
  }))
}

function region(config: Omit<ForestRegionConfig, 'groundTexture' | 'routes' | 'obstacles' | 'decorations'>): ForestRegionConfig {
  const allVisuals = [...config.props, ...config.landmarks]
  return {
    ...config,
    groundTexture: config.groundLayers[0].texture,
    routes: config.paths.map((item) => ({ points: item.points.flatMap(({ x, y }) => [x, y]), width: item.width, height: Math.max(64, Math.round(item.width * 0.36)), alpha: item.alpha })),
    obstacles: legacyObstacleItems(allVisuals, config.colliders),
    decorations: legacyDecorations(config),
  }
}

const commonPartZones = (part: number): ForestSafeZone[] => [
  zone(`p${part}-entry-portal`, 'portal', 160, 1840, 240, 240),
  zone(`p${part}-spawn`, 'spawn', 280, 1700, 220, 220),
  ...(part < 5 ? [zone(`p${part}-exit-portal`, 'portal', 1880, 260, 240, 240)] : []),
]

export const FOREST_REGIONS: Record<ForestRegionKey, ForestRegionConfig> = {
  glimmer_forest_part_1: region({
    key: 'glimmer_forest_part_1',
    groundLayers: [{ id: 'p1-ground', texture: 'forest-ground-cold-wet', tile: true, depthRole: 'underlay' }],
    paths: PART_1_PATHS,
    props: PART_1_PROPS,
    colliders: PART_1_COLLIDERS,
    landmarks: PART_1_LANDMARKS,
    effects: [
      { ...prop('p1-mist-back', 'forest-reverse-mist-back', 1024, 1024, 2048, 2048, 'effect'), alpha: 0.11, motion: { type: 'tile', x: 1024, y: 260, duration: 24_000 } },
      { ...prop('p1-mist-mid', 'forest-reverse-mist-mid', 1024, 1024, 2048, 2048, 'effect'), alpha: 0.065, motion: { type: 'tile', x: 1024, y: 340, duration: 17_000 } },
    ],
    foreground: [],
    safeZones: [zone('p1-village-portal', 'portal', 1900, 1840, 240, 240), zone('p1-spawn', 'spawn', 1800, 1740, 220, 220), zone('p1-part2-portal', 'portal', 1880, 260, 240, 240), zone('p1-luna-clearing', 'interaction', 620, 520, 260, 220), zone('p1-performance', 'performance', 620, 520, 520, 420)],
  }),
  glimmer_forest_part_2: region({
    key: 'glimmer_forest_part_2',
    groundLayers: [
      { id: 'p2-ground', texture: 'forest-region-part-2-ground-1', tile: true, depthRole: 'underlay' },
      { id: 'p2-ground-variant', texture: 'forest-region-part-2-ground-2', tile: true, alpha: 0.3, depthRole: 'underlay' },
      { id: 'p2-macro', texture: 'forest-region-part-2-macro', width: 2048, height: 2048, alpha: 0.34, depthRole: 'ground-decal' },
      { id: 'p2-stream', texture: 'forest-region-part-2-water-flow', x: 1040, y: 1040, angle: 28, width: 2100, height: 260, alpha: 0.82, depthRole: 'ground-decal' },
    ],
    paths: PART_2_PATHS,
    props: [...p2Banks, ...p2Foliage],
    colliders: PART_2_COLLIDERS,
    landmarks: [prop('p2-main-bridge', 'forest-region-part-2-bridge-diagonal', 1030, 1040, 430, 286, 'canopy', -6), prop('p2-shoal-bridge', 'forest-region-part-2-bridge-horizontal', 540, 720, 360, 240, 'canopy')],
    effects: [
      { ...prop('p2-mist-fall', 'forest-region-part-2-reverse-mist-fall', 1710, 390, 520, 300, 'effect'), alpha: 0.5, additive: true, motion: { type: 'pulse', from: 0.32, to: 0.58, duration: 3600 } },
      { ...prop('p2-reflection', 'forest-region-part-2-wetland-reflection', 1050, 1080, 1080, 420, 'effect'), alpha: 0.32, additive: true },
    ],
    foreground: [],
    safeZones: commonPartZones(2),
  }),
  glimmer_forest_part_3: region({
    key: 'glimmer_forest_part_3',
    groundLayers: [
      { id: 'p3-ground', texture: 'forest-region-part-3-ground-1', tile: true, depthRole: 'underlay' },
      { id: 'p3-ground-variant', texture: 'forest-region-part-3-ground-3', tile: true, alpha: 0.28, depthRole: 'underlay' },
      { id: 'p3-macro', texture: 'forest-region-part-3-macro', width: 2048, height: 2048, alpha: 0.32, depthRole: 'ground-decal' },
      { id: 'p3-courtyard', texture: 'forest-region-part-3-courtyard', x: 1030, y: 1040, width: 760, height: 700, alpha: 0.9, depthRole: 'ground-decal' },
    ],
    paths: PART_3_PATHS,
    props: PART_3_PROPS,
    colliders: PART_3_COLLIDERS,
    landmarks: PART_3_LANDMARKS,
    effects: [],
    foreground: [],
    safeZones: [...commonPartZones(3), zone('p3-courtyard-clear', 'performance', 1030, 1040, 420, 360)],
  }),
  glimmer_forest_part_4: region({
    key: 'glimmer_forest_part_4',
    groundLayers: [
      { id: 'p4-ground', texture: 'forest-region-part-4-ground-1', tile: true, depthRole: 'underlay' },
      { id: 'p4-ground-variant', texture: 'forest-region-part-4-ground-2', tile: true, alpha: 0.28, depthRole: 'underlay' },
      { id: 'p4-macro', texture: 'forest-region-part-4-macro', width: 2048, height: 2048, alpha: 0.32, depthRole: 'ground-decal' },
    ],
    paths: PART_4_PATHS,
    props: [
      ...PART_4_PROPS,
      ...pathMarkerPositions.map(([x, y], index) => ({ ...prop(`p4-path-marker-${index + 1}`, `forest-region-part-4-path-${String(index + 1).padStart(2, '0')}`, x, y, 116, 116, 'effect'), additive: true, alpha: 0.82 })),
      ...falseMarkerPositions.map(([x, y], index) => prop(`p4-false-marker-${index + 1}`, `forest-region-part-4-false-path-${String(index + 1).padStart(2, '0')}`, x, y, 112, 112, 'underlay')),
    ],
    colliders: PART_4_COLLIDERS,
    landmarks: [],
    effects: [
      ...[[520, 820], [760, 1480], [1040, 650], [1260, 1240], [1510, 980], [1660, 470]].map(([x, y], index): ForestEffect => ({ ...prop(`p4-fireflies-${index + 1}`, `forest-region-part-4-fireflies-${String(index + 1).padStart(2, '0')}`, x, y, 240, 240, 'effect'), alpha: index === 5 ? 0.42 : 0.58, additive: true, motion: { type: 'pulse', from: 0.28, to: 0.66, duration: 2200 + index * 170 } })),
      { ...prop('p4-moonlight', 'forest-region-part-4-moonlight', 1050, 1030, 820, 720, 'effect'), alpha: 0.4, additive: true },
    ],
    foreground: [
      { ...prop('p4-foreground-top', 'forest-region-part-4-foreground-top', 1024, 130, 1500, 650, 'foreground'), alpha: 0.88, fadeRadius: 180, fadedAlpha: 0.4 },
      { ...prop('p4-foreground-left', 'forest-region-part-4-foreground-left', 120, 1040, 560, 980, 'foreground'), alpha: 0.82, fadeRadius: 180, fadedAlpha: 0.38 },
      { ...prop('p4-foreground-right', 'forest-region-part-4-foreground-right', 1928, 1040, 560, 980, 'foreground'), alpha: 0.82, fadeRadius: 180, fadedAlpha: 0.38 },
    ],
    safeZones: commonPartZones(4),
  }),
  glimmer_forest_part_5: region({
    key: 'glimmer_forest_part_5',
    groundLayers: [
      { id: 'p5-ground', texture: 'forest-region-part-5-ground-1', tile: true, depthRole: 'underlay' },
      { id: 'p5-ground-variant', texture: 'forest-region-part-5-ground-2', tile: true, alpha: 0.3, depthRole: 'underlay' },
      { id: 'p5-macro', texture: 'forest-region-part-5-macro', width: 2048, height: 2048, alpha: 0.34, depthRole: 'ground-decal' },
      { id: 'p5-basin-edge', texture: 'forest-region-part-5-basin-edge', x: 1040, y: 1120, width: 900, height: 820, alpha: 0.88, depthRole: 'ground-decal' },
    ],
    paths: PART_5_PATHS,
    props: PART_5_PROPS,
    colliders: PART_5_COLLIDERS,
    landmarks: PART_5_LANDMARKS,
    effects: [
      { ...prop('p5-basin-mist', 'forest-region-part-5-basin-mist', 1040, 1120, 760, 620, 'effect'), alpha: 0.5 },
      { ...prop('p5-response-idle', 'forest-region-part-5-response-idle', 1040, 1120, 620, 620, 'effect'), alpha: 0.5, additive: true },
      { ...prop('p5-response-active', 'forest-region-part-5-response-active', 1040, 1120, 620, 620, 'effect'), alpha: 0.28, additive: true, motion: { type: 'pulse', from: 0.1, to: 0.38, duration: 3200 } },
    ],
    foreground: [],
    safeZones: [...commonPartZones(5), zone('p5-core-performance', 'performance', 1040, 1120, 520, 520)],
  }),
}

// Keep the generated batch complete for provenance, but preload only textures used by a V2 layout.
const forestRegionRuntimeTextureKeys = new Set<string>([
  'forest-region-exit-left',
  'forest-region-exit-right',
  ...Object.values(FOREST_REGIONS).flatMap((region) => [
    ...region.groundLayers,
    ...region.props,
    ...region.landmarks,
    ...region.effects,
    ...region.foreground,
  ].map((item) => item.texture)),
])

export const FOREST_REGION_RUNTIME_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(FOREST_REGION_ASSETS).filter(([key]) => forestRegionRuntimeTextureKeys.has(key)),
)

function colliderBounds(collider: ForestCollider): { left: number; top: number; right: number; bottom: number } {
  const halfWidth = collider.shape === 'circle' ? collider.radius ?? 0 : (collider.width ?? 0) / 2
  const halfHeight = collider.shape === 'circle' ? collider.radius ?? 0 : (collider.height ?? 0) / 2
  return { left: collider.x - halfWidth, right: collider.x + halfWidth, top: collider.y - halfHeight, bottom: collider.y + halfHeight }
}

export function validateForestRegionConfig(config: ForestRegionConfig): string[] {
  const problems: string[] = []
  const ids = [...config.groundLayers, ...config.paths, ...config.props, ...config.colliders, ...config.landmarks, ...config.effects, ...config.foreground, ...config.safeZones].map((item) => item.id)
  if (new Set(ids).size !== ids.length) problems.push(`${config.key}: duplicate layout id`)
  config.paths.forEach((item) => {
    const minimum = item.role === 'main' ? 240 : 180
    if (item.width < minimum) problems.push(`${config.key}: ${item.id} width ${item.width} < ${minimum}`)
    if (item.points.length < 2) problems.push(`${config.key}: ${item.id} has fewer than two points`)
  })
  config.colliders.forEach((collider) => {
    if (!collider.debugLabel) problems.push(`${config.key}: ${collider.id} has no debug label`)
    const body = colliderBounds(collider)
    config.safeZones.forEach((safeZone) => {
      const overlaps = body.left < safeZone.x + safeZone.width / 2
        && body.right > safeZone.x - safeZone.width / 2
        && body.top < safeZone.y + safeZone.height / 2
        && body.bottom > safeZone.y - safeZone.height / 2
      if (overlaps) problems.push(`${config.key}: ${collider.id} overlaps safe zone ${safeZone.id}`)
    })
  })
  return problems
}

export function resolveForestRegionKey(regionKey: string | undefined): ForestRegionKey {
  return FOREST_REGION_KEYS.includes(regionKey as ForestRegionKey) ? regionKey as ForestRegionKey : 'glimmer_forest_part_1'
}

export function getForestRegionConfig(regionKey: string | undefined): ForestRegionConfig {
  return FOREST_REGIONS[resolveForestRegionKey(regionKey)]
}
