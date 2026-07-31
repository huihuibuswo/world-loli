import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  FOREST_REGION_ASSET_ROOT,
  FOREST_REGION_ASSETS,
  FOREST_REGION_KEYS,
  FOREST_REGIONS,
  FOREST_REGION_RUNTIME_ASSETS,
  getForestRegionConfig,
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
  assert.equal(part2.props.filter((item) => item.id.startsWith('p2-bank-')).length, 10)
  assert.equal(part2.colliders.some((item) => item.visualRef?.startsWith('p2-bank-')), false)
  assert.ok(part2.colliders.filter((item) => item.role === 'water').length >= 8)

  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    assert.equal(validateForestRegionConfig(region).filter((problem) => problem.includes('safe zone')).length, 0)
  })
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
