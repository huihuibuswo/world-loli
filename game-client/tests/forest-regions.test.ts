import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { resolveActorFootDepth } from '../src/game/depthSorting.ts'
import {
  FOREST_REGION_ASSET_ROOT,
  FOREST_REGION_ASSETS,
  FOREST_REGION_KEYS,
  FOREST_REGIONS,
  FOREST_REGION_RUNTIME_ASSETS,
  getForestRegionConfig,
  isForestVisualVisibleOnMinimap,
  resolveForestVisibleFootY,
  resolveForestVisualDepth,
  validateForestRegionConfig,
} from '../src/game/forestRegions.ts'
import { resolveMinimapLayout } from '../src/game/minimapLayout.ts'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const runtimeRoot = fileURLToPath(new URL(
  '../public/assets/generated/environment/glimmer-forest/regions-v2/',
  import.meta.url,
))
const artRoot = fileURLToPath(new URL(
  '../art-source/generated/glimmer-forest-regions-v2/',
  import.meta.url,
))

type ManifestAsset = {
  name: string
  art_source: string
  runtime: string
  width: number
  height: number
  mode: string
  alpha_bbox: [number, number, number, number]
  anchor: [number, number]
  footpoint: [number, number]
  visual_size: [number, number]
  role: string
  collision_profile: string | null
  component_count: number
  review: string
  intentional_padding?: string
  sha256: string
  source_codes: string[]
}

type Manifest = {
  version: string
  runtime_root: string
  assets: ManifestAsset[]
  validation: { passed: boolean; problem_count: number; problems: string[] }
}

const manifest = JSON.parse(readFileSync(`${artRoot}manifest.json`, 'utf8')) as Manifest
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

const containsPoint = (collider: (typeof FOREST_REGIONS.glimmer_forest_part_2.colliders)[number], x: number, y: number): boolean => {
  if (collider.shape === 'circle') return Math.hypot(x - collider.x, y - collider.y) <= (collider.radius ?? 0)
  return Math.abs(x - collider.x) <= (collider.width ?? 0) / 2
    && Math.abs(y - collider.y) <= (collider.height ?? 0) / 2
}

const part2WaterContains = (x: number, y: number): boolean => FOREST_REGIONS.glimmer_forest_part_2.colliders
  .filter((item) => item.role === 'water')
  .some((item) => containsPoint(item, x, y))

const samplePolyline = (points: readonly { x: number; y: number }[], stepsPerSegment = 16): { x: number; y: number }[] => points.flatMap((start, index) => {
  const end = points[index + 1]
  if (!end) return [start]
  return Array.from({ length: stepsPerSegment }, (_, step) => {
    const ratio = step / stepsPerSegment
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
  })
})

const samplePolylineBySpacing = (points: readonly { x: number; y: number }[], spacing: number): { x: number; y: number }[] => points.flatMap((start, index) => {
  const end = points[index + 1]
  if (!end) return [start]
  const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / spacing))
  return Array.from({ length: steps }, (_, step) => {
    const ratio = step / steps
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
  })
})

test('minimap viewport follows the visible canvas area under ENVELOP scaling', () => {
  const desktop = resolveMinimapLayout({
    canvasLeft: 0,
    canvasTop: 0,
    canvasWidth: 1280,
    canvasHeight: 720,
    viewportWidth: 1280,
    gameWidth: 1280,
    gameHeight: 720,
    compact: false,
  })
  assert.deepEqual(desktop, {
    frameSize: 150,
    frameTop: 20,
    frameRight: 20,
    cameraX: 1110,
    cameraY: 20,
    cameraWidth: 150,
    cameraHeight: 150,
  })

  const mobile = resolveMinimapLayout({
    canvasLeft: -556,
    canvasTop: 0,
    canvasWidth: 1500,
    canvasHeight: 844,
    viewportWidth: 390,
    gameWidth: 1280,
    gameHeight: 720,
    compact: true,
  })
  const renderedLeft = mobile.cameraX * (1500 / 1280) - 556
  const renderedTop = mobile.cameraY * (844 / 720)
  assert.ok(Math.abs(renderedLeft - 268) < 0.001)
  assert.ok(Math.abs(renderedTop - 64) < 0.001)
  assert.ok(Math.abs(mobile.cameraWidth * (1500 / 1280) - 112) < 0.001)
  assert.ok(Math.abs(mobile.cameraHeight * (844 / 720) - 112) < 0.001)
})

test('defines five V2 region configurations with authoritative layout layers', () => {
  assert.equal(FOREST_REGION_KEYS.length, 5)
  assert.deepEqual(Object.keys(FOREST_REGIONS).sort(), [...FOREST_REGION_KEYS].sort())

  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    assert.equal(region.key, key)
    assert.ok(region.groundLayers.length > 0)
    assert.ok(region.paths.length > 0)
    assert.ok(region.props.length > 0)
    assert.ok(region.colliders.length > 0)
    assert.ok(region.safeZones.length > 0)
    assert.deepEqual(validateForestRegionConfig(region), [])
    region.props.forEach((prop) => assert.equal('body' in prop, false))
    region.colliders.forEach((collider) => assert.ok(collider.id && collider.debugLabel))
  })
})

test('main and branch routes meet V2 width and endpoint contracts', () => {
  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    region.paths.forEach((path) => {
      assert.ok(path.points.length >= 2)
      assert.ok(path.width >= (path.role === 'main' ? 240 : 180))
      for (let index = 1; index < path.points.length; index += 1) {
        const previous = path.points[index - 1]
        const current = path.points[index]
        assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) <= 430, `${key}/${path.id} has an oversized gap`)
      }
    })
  })

  for (const key of FOREST_REGION_KEYS.slice(1, 4)) {
    const main = FOREST_REGIONS[key].paths.find((path) => path.role === 'main')!
    assert.ok(Math.hypot(main.points[0].x - 280, main.points[0].y - 1700) < 4)
    const end = main.points.at(-1)!
    assert.ok(Math.hypot(end.x - 1840, end.y - 260) < 4)
  }
})

test('safe zones remain clear and water banks are visual-only props', () => {
  const part2 = FOREST_REGIONS.glimmer_forest_part_2
  assert.equal(part2.props.filter((item) => item.id.startsWith('p2-bank-')).length, 9)
  assert.equal(part2.props.some((item) => item.id === 'p2-bank-08'), false)
  assert.equal(part2.colliders.some((item) => item.visualRef?.startsWith('p2-bank-')), false)
  assert.equal(part2.colliders.filter((item) => item.role === 'water').length, 12)

  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    assert.equal(validateForestRegionConfig(region).filter((problem) => problem.includes('safe zone')).length, 0)
  })
})

test('part 2 uses phased ground, explicit water, bank, foliage, bridge, and reflection layouts', () => {
  const part2 = FOREST_REGIONS.glimmer_forest_part_2
  const base = part2.groundLayers.find((item) => item.id === 'p2-ground')!
  const variant = part2.groundLayers.find((item) => item.id === 'p2-ground-variant')!
  const macro = part2.groundLayers.find((item) => item.id === 'p2-macro')!

  assert.equal(base.tile, true)
  assert.equal(base.tilePosition, undefined)
  assert.deepEqual(variant.tilePosition, { x: 384, y: 256 })
  assert.equal(variant.alpha, 0.22)
  assert.equal(macro.alpha, 0.24)
  assert.equal(part2.groundLayers.some((item) => item.texture === 'forest-region-part-2-ground-3'), false)

  const waters = part2.props.filter((item) => item.id.startsWith('p2-water-'))
  const banks = part2.props.filter((item) => item.id.startsWith('p2-bank-'))
  const foliage = part2.props.filter((item) => item.id.startsWith('p2-foliage-'))
  const reflections = part2.effects.filter((item) => item.id.startsWith('p2-reflection-'))
  assert.equal(waters.length, 7)
  assert.equal(new Set(waters.map((item) => `${item.width}x${item.height}:${item.angle}`)).size, 7)
  assert.equal(banks.length, 9)
  assert.equal(new Set(banks.map((item) => `${item.width}x${item.height}:${item.angle}`)).size, 9)
  assert.equal(foliage.length, 6)
  assert.equal(new Set(foliage.map((item) => `${item.width}x${item.height}:${item.angle}`)).size, 6)
  assert.equal(reflections.length, 4)

  assert.deepEqual(part2.landmarks.map((item) => item.id).sort(), ['p2-main-bridge', 'p2-shoal-bridge'])
  part2.landmarks.forEach((bridge) => {
    assert.equal(bridge.depthRole, 'underlay')
    assert.equal(isForestVisualVisibleOnMinimap(bridge), true)
  })
})

test('part 2 routes remain collision-free and both bridge centerlines are open', () => {
  const part2 = FOREST_REGIONS.glimmer_forest_part_2
  part2.paths.forEach((route) => {
    samplePolyline(route.points).forEach(({ x, y }) => {
      assert.equal(part2WaterContains(x, y), false, `${route.id} enters water at ${x},${y}`)
    })
  })

  const bridgeLines = [
    { id: 'shoal', center: { x: 540, y: 720 }, extent: 120 },
    { id: 'main', center: { x: 1030, y: 1040 }, extent: 120 },
  ]
  bridgeLines.forEach(({ id, center, extent }) => {
    for (let index = 0; index < 7; index += 1) {
      const offset = -extent + index * (extent * 2 / 6)
      assert.equal(part2WaterContains(center.x + offset, center.y - offset), false, `${id} bridge point ${index} is blocked`)
    }
  })

  ;[
    ['shoal northwest edge', 410, 590],
    ['shoal southeast edge', 640, 820],
    ['main northwest edge', 930, 940],
    ['main southeast edge', 1150, 1160],
  ].forEach(([label, x, y]) => assert.equal(part2WaterContains(x as number, y as number), true, label as string))
})

test('part 2 water chain blocks both sides continuously except at the two bridge gaps', () => {
  const water = FOREST_REGIONS.glimmer_forest_part_2.colliders.filter((item) => item.role === 'water')
  assert.equal(water.length, 12)

  water.slice(1).forEach((current, index) => {
    if (index === 1 || index === 4) return
    const previous = water[index]
    const horizontalGap = Math.max(0, Math.abs(current.x - previous.x) - ((current.width ?? 0) + (previous.width ?? 0)) / 2)
    const verticalGap = Math.max(0, Math.abs(current.y - previous.y) - ((current.height ?? 0) + (previous.height ?? 0)) / 2)
    assert.equal(Math.hypot(horizontalGap, verticalGap), 0, `${previous.id}/${current.id} leaves a non-bridge gap`)
  })

  const streamCenterline = [
    { x: 120, y: 520 }, { x: 360, y: 650 }, { x: 620, y: 760 }, { x: 900, y: 930 },
    { x: 1160, y: 1110 }, { x: 1430, y: 1290 }, { x: 1710, y: 1450 }, { x: 2020, y: 1540 },
  ]
  const openRuns = samplePolylineBySpacing(streamCenterline, 8).reduce<{ x: number; y: number }[][]>((runs, point) => {
    if (part2WaterContains(point.x, point.y)) return runs
    const currentRun = runs.at(-1)
    if (!currentRun || Math.hypot(point.x - currentRun.at(-1)!.x, point.y - currentRun.at(-1)!.y) > 12) {
      runs.push([point])
    } else {
      currentRun.push(point)
    }
    return runs
  }, [])

  assert.equal(openRuns.length, 2, `expected two bridge gaps, found ${openRuns.length}`)
  const expectedBridges = [{ x: 540, y: 720 }, { x: 1030, y: 1040 }]
  openRuns.forEach((run, index) => {
    const midpoint = run[Math.floor(run.length / 2)]
    const span = Math.hypot(run.at(-1)!.x - run[0].x, run.at(-1)!.y - run[0].y)
    assert.ok(Math.hypot(midpoint.x - expectedBridges[index].x, midpoint.y - expectedBridges[index].y) <= 32, `gap ${index + 1} is not centered on its bridge`)
    assert.ok(span >= 112 && span <= 230, `gap ${index + 1} span ${span} is outside the bridge contract`)
  })
})

test('part 2 minimap keeps navigation layers and hides decorative effects and foliage', () => {
  const part2 = FOREST_REGIONS.glimmer_forest_part_2
  const visibleProps = [...part2.props, ...part2.landmarks, ...part2.effects]
    .filter(isForestVisualVisibleOnMinimap)
    .map((item) => item.id)
  const hiddenProps = [...part2.props, ...part2.landmarks, ...part2.effects]
    .filter((item) => !isForestVisualVisibleOnMinimap(item))
    .map((item) => item.id)

  assert.ok(part2.paths.some((item) => item.id === 'p2-main'))
  assert.ok(part2.paths.some((item) => item.id === 'p2-wetland'))
  assert.equal(part2.props.filter((item) => item.id.startsWith('p2-water-')).every((item) => visibleProps.includes(item.id)), true)
  assert.equal(part2.landmarks.every((item) => visibleProps.includes(item.id)), true)
  assert.equal(part2.props.filter((item) => item.id.startsWith('p2-foliage-')).every((item) => hiddenProps.includes(item.id)), true)
  assert.equal(part2.effects.every((item) => hiddenProps.includes(item.id)), true)
})

test('visual colliders across all forest regions do not extend below alpha footpoints', () => {
  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    const visuals = new Map([...region.props, ...region.landmarks].map((item) => [item.id, item]))

    region.colliders.forEach((collider) => {
      if (!collider.visualRef) return
      const visual = visuals.get(collider.visualRef)
      assert.ok(visual, `${key}/${collider.visualRef}`)
      const visibleFootY = resolveForestVisibleFootY(visual)
      assert.notEqual(visibleFootY, undefined, `${key}/${collider.visualRef}`)
      const halfHeight = collider.shape === 'circle' ? collider.radius ?? 0 : (collider.height ?? 0) / 2
      assert.ok(
        collider.y + halfHeight <= visibleFootY! + 0.01,
        `${key}/${collider.id} extends below ${collider.visualRef} visible footpoint`,
      )
    })
  })
})

test('all sortable forest props have alpha footpoints', () => {
  FOREST_REGION_KEYS.forEach((key) => {
    const sortable = [...FOREST_REGIONS[key].props, ...FOREST_REGIONS[key].landmarks]
      .filter((item) => item.depthRole === 'world' || item.depthRole === 'canopy')
    sortable.forEach((item) => assert.ok(item.alphaFootpoint, `${key}/${item.id}`))
  })
})

test('rock collider covers the wider visible base instead of only its center', () => {
  const rock = FOREST_REGIONS.glimmer_forest_part_1.colliders.find((item) => item.id === 'p1-rock-body')!
  assert.equal(rock.shape, 'rect')
  assert.equal(rock.width, 120)
  assert.equal(rock.height, 62)
})

test('actor sorting uses the collision foot rather than the sprite center', () => {
  assert.equal(resolveActorFootDepth(1_500, 17, 20), 1_537)
  assert.equal(resolveActorFootDepth(1_500, 34, 18), 1_552)
})

test('forest visual depth uses the same visible footpoint as collision sorting', () => {
  const part1 = FOREST_REGIONS.glimmer_forest_part_1
  const visual = part1.props.find((item) => item.id === 'p1-tree-a1')!
  const visibleFootY = resolveForestVisibleFootY(visual)!
  const visualDepth = resolveForestVisualDepth(visual)
  const playerAboveDepth = visibleFootY - 1
  const playerBelowDepth = visibleFootY + 1

  assert.equal(visualDepth, visibleFootY)
  assert.ok(visibleFootY < visual.y)
  assert.ok(playerAboveDepth < visualDepth, 'the prop must cover a player above its visible footpoint')
  assert.ok(playerBelowDepth > visualDepth, 'the player must cover the prop below its visible footpoint')

  assert.equal(resolveForestVisualDepth({ ...visual, alphaFootpoint: undefined }), visual.y)
  assert.equal(resolveForestVisualDepth({ ...visual, depthRole: 'ground-decal' }), -8)
  assert.equal(resolveForestVisualDepth({ ...visual, depthRole: 'underlay' }), -6)
  assert.equal(resolveForestVisualDepth({ ...visual, depthRole: 'effect' }), 7_000)
  assert.equal(resolveForestVisualDepth({ ...visual, depthRole: 'foreground' }), 8_000)
})

test('falls back to part 1 for an absent or unknown persisted region key', () => {
  assert.equal(getForestRegionConfig(undefined).key, 'glimmer_forest_part_1')
  assert.equal(getForestRegionConfig('unknown_region').key, 'glimmer_forest_part_1')
})

test('all generated V2 assets use the single root and exist', () => {
  assert.equal(FOREST_REGION_ASSET_ROOT, '/assets/generated/environment/glimmer-forest/regions-v2')
  assert.equal(manifest.runtime_root.replace(/\/$/, ''), FOREST_REGION_ASSET_ROOT)
  const missing = Object.entries(FOREST_REGION_ASSETS)
    .filter(([, relativePath]) => !existsSync(`${runtimeRoot}${relativePath}`))
    .map(([key, relativePath]) => `${key}: ${relativePath}`)
  assert.deepEqual(missing, [])
})

test('preload set contains only V2 assets used by a layout or portal marker', () => {
  assert.ok(Object.keys(FOREST_REGION_RUNTIME_ASSETS).length < Object.keys(FOREST_REGION_ASSETS).length)
  const missing = Object.entries(FOREST_REGION_RUNTIME_ASSETS)
    .filter(([, relativePath]) => !existsSync(`${runtimeRoot}${relativePath}`))
    .map(([key, relativePath]) => `${key}: ${relativePath}`)
  assert.deepEqual(missing, [])
})

test('manifest records tight alpha, footpoints, collision profiles, and byte-identical mirrors', () => {
  assert.equal(manifest.version, 'glimmer-forest-regions-v2')
  assert.deepEqual(manifest.validation, { passed: true, problem_count: 0, problems: [] })
  assert.ok(manifest.assets.length >= 90)

  for (const asset of manifest.assets) {
    assert.deepEqual(asset.visual_size, [asset.width, asset.height])
    assert.equal(asset.anchor.length, 2)
    assert.equal(asset.footpoint.length, 2)
    assert.equal(asset.review, 'approved')
    assert.ok(asset.component_count >= 1)
    if (asset.mode === 'RGBA') {
      const [left, top, right, bottom] = asset.alpha_bbox
      assert.ok(right > left && bottom > top)
      const coverage = Math.max((right - left) / asset.width, (bottom - top) / asset.height)
      assert.ok(coverage >= 0.7 || asset.intentional_padding)
    }
    const artPath = `${projectRoot}${asset.art_source.replace('game-client/', '').replaceAll('/', '\\')}`
    const runtimePath = `${projectRoot}public${asset.runtime.replaceAll('/', '\\')}`
    assert.equal(digest(artPath), asset.sha256)
    assert.equal(digest(runtimePath), asset.sha256)
  }
})

test('re-extracted atlas sprites contain one approved primary component where the subject is contiguous', () => {
  const auditedSources = new Set(['W03', 'D03', 'N02', 'D02'])
  const audited = manifest.assets.filter((asset) => asset.source_codes.some((code) => auditedSources.has(code)))
  assert.ok(audited.length >= 25)
  audited.forEach((asset) => {
    assert.equal(asset.component_count, 1, asset.name)
    assert.equal(asset.mode, 'RGBA', asset.name)
  })
})

test('local overlays are RGBA rather than opaque rectangular patches', () => {
  const required = [
    'part-2-stream-water-flow.png',
    'part-3-sunken-courtyard.png',
    'part-5-mist-convergence-basin-edge.png',
    'mist-convergence-basin-mist.png',
  ]
  required.forEach((name) => {
    const asset = manifest.assets.find((item) => item.name === name)
    assert.ok(asset, name)
    assert.equal(asset.mode, 'RGBA', name)
    assert.deepEqual(asset.alpha_bbox[0], 0, `${name} should feather to a transparent canvas edge`)
  })
})
