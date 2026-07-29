import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_DAY_INDEX,
  DEFAULT_MINUTE_OF_DAY,
  advanceGameTime,
  formatGameTime,
  getEnvironmentStyle,
  getTimePhase,
  isMinuteInRange,
  normalizeGameTime,
} from '../src/game/time.ts'

test('normalizes invalid and legacy time values', () => {
  assert.deepEqual(normalizeGameTime(undefined, Number.NaN), {
    dayIndex: DEFAULT_DAY_INDEX,
    minuteOfDay: DEFAULT_MINUTE_OF_DAY,
    phase: 'day',
  })
  assert.deepEqual(normalizeGameTime(undefined, 300), {
    dayIndex: DEFAULT_DAY_INDEX,
    minuteOfDay: 300,
    phase: 'dawn',
  })
  assert.deepEqual(normalizeGameTime(3, undefined), {
    dayIndex: 3,
    minuteOfDay: DEFAULT_MINUTE_OF_DAY,
    phase: 'day',
  })
})

test('uses exact phase boundaries', () => {
  assert.equal(getTimePhase(299), 'night')
  assert.equal(getTimePhase(300), 'dawn')
  assert.equal(getTimePhase(419), 'dawn')
  assert.equal(getTimePhase(420), 'day')
  assert.equal(getTimePhase(1079), 'day')
  assert.equal(getTimePhase(1080), 'dusk')
  assert.equal(getTimePhase(1199), 'dusk')
  assert.equal(getTimePhase(1200), 'night')
})

test('carries sub-second remainder and rolls over the day', () => {
  const first = advanceGameTime({ dayIndex: 2, minuteOfDay: 1439 }, 750, 500)
  assert.deepEqual(first, {
    state: { dayIndex: 3, minuteOfDay: 0, phase: 'night' },
    remainderMs: 250,
  })
})

test('formats stable 24-hour clock text', () => {
  assert.equal(formatGameTime(0), '00:00')
  assert.equal(formatGameTime(485), '08:05')
  assert.equal(formatGameTime(1439), '23:59')
})

test('supports regular and crossing-midnight schedule ranges', () => {
  assert.equal(isMinuteInRange(480, 480, 1200), true)
  assert.equal(isMinuteInRange(1200, 480, 1200), false)
  assert.equal(isMinuteInRange(30, 1200, 300), true)
  assert.equal(isMinuteInRange(600, 1200, 300), false)
  assert.equal(isMinuteInRange(600, 600, 600), true)
})

test('environment interpolation stays readable and continuous', () => {
  const dawnStart = getEnvironmentStyle('village', 300)
  const dawnEnd = getEnvironmentStyle('village', 419)
  const night = getEnvironmentStyle('village', 1200)
  const forestDay = getEnvironmentStyle('forest', 720)
  assert.ok(dawnStart.alpha > dawnEnd.alpha)
  assert.ok(night.alpha <= 0.28)
  assert.ok(forestDay.alpha > 0)
  assert.ok(forestDay.alpha < night.alpha)
})
