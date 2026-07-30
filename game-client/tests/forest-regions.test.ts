import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  FOREST_REGION_ASSETS,
  FOREST_REGION_KEYS,
  FOREST_REGIONS,
  getForestRegionConfig,
} from '../src/game/forestRegions.ts'

const runtimeRoot = fileURLToPath(new URL(
  '../public/assets/generated/environment/glimmer-forest/regions-v1/',
  import.meta.url,
))

test('defines five complete forest region configurations', () => {
  assert.equal(FOREST_REGION_KEYS.length, 5)
  assert.deepEqual(Object.keys(FOREST_REGIONS).sort(), [...FOREST_REGION_KEYS].sort())

  FOREST_REGION_KEYS.forEach((key) => {
    const region = FOREST_REGIONS[key]
    assert.equal(region.key, key)
    assert.ok(region.groundTexture)
    assert.ok(region.routes.length > 0)
    assert.ok(region.obstacles.length > 0)
    assert.ok(region.decorations.length > 0)
  })
})

test('falls back to part 1 for an absent or unknown persisted region key', () => {
  assert.equal(getForestRegionConfig(undefined).key, 'glimmer_forest_part_1')
  assert.equal(getForestRegionConfig('unknown_region').key, 'glimmer_forest_part_1')
})

test('all configured generated forest assets exist in the runtime mirror', () => {
  const missing = Object.entries(FOREST_REGION_ASSETS)
    .filter(([, relativePath]) => !existsSync(`${runtimeRoot}${relativePath}`))
    .map(([key, relativePath]) => `${key}: ${relativePath}`)
  assert.deepEqual(missing, [])
})
