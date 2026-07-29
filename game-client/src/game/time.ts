export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night'

export interface GameTimeState {
  dayIndex: number
  minuteOfDay: number
  phase: TimePhase
}

export interface GameTimeAdvanceResult {
  state: GameTimeState
  remainderMs: number
}

export interface EnvironmentStyle {
  color: number
  alpha: number
  lightAlpha: number
}

export const DEFAULT_DAY_INDEX = 1
export const DEFAULT_MINUTE_OF_DAY = 480
export const REAL_MS_PER_GAME_MINUTE = 1_000
export const MINUTES_PER_DAY = 1_440

function validInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

export function getTimePhase(minuteOfDay: number): TimePhase {
  const minute = normalizeGameTime(DEFAULT_DAY_INDEX, minuteOfDay).minuteOfDay
  if (minute >= 300 && minute < 420) return 'dawn'
  if (minute >= 420 && minute < 1080) return 'day'
  if (minute >= 1080 && minute < 1200) return 'dusk'
  return 'night'
}

export function normalizeGameTime(dayIndex: unknown, minuteOfDay: unknown): GameTimeState {
  const day = validInteger(dayIndex) && dayIndex >= 1 ? dayIndex : DEFAULT_DAY_INDEX
  const minute = validInteger(minuteOfDay) && minuteOfDay >= 0 && minuteOfDay < MINUTES_PER_DAY
    ? minuteOfDay
    : DEFAULT_MINUTE_OF_DAY
  return { dayIndex: day, minuteOfDay: minute, phase: phaseForNormalizedMinute(minute) }
}

function phaseForNormalizedMinute(minute: number): TimePhase {
  if (minute >= 300 && minute < 420) return 'dawn'
  if (minute >= 420 && minute < 1080) return 'day'
  if (minute >= 1080 && minute < 1200) return 'dusk'
  return 'night'
}

export function advanceGameTime(
  state: Pick<GameTimeState, 'dayIndex' | 'minuteOfDay'>,
  elapsedMs: number,
  remainderMs = 0,
): GameTimeAdvanceResult {
  const current = normalizeGameTime(state.dayIndex, state.minuteOfDay)
  const accumulated = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
    + Math.max(0, Number.isFinite(remainderMs) ? remainderMs : 0)
  const elapsedMinutes = Math.floor(accumulated / REAL_MS_PER_GAME_MINUTE)
  const totalMinutes = current.minuteOfDay + elapsedMinutes
  const dayOffset = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const minuteOfDay = totalMinutes % MINUTES_PER_DAY
  return {
    state: {
      dayIndex: current.dayIndex + dayOffset,
      minuteOfDay,
      phase: phaseForNormalizedMinute(minuteOfDay),
    },
    remainderMs: accumulated % REAL_MS_PER_GAME_MINUTE,
  }
}

export function formatGameTime(minuteOfDay: number): string {
  const minute = normalizeGameTime(DEFAULT_DAY_INDEX, minuteOfDay).minuteOfDay
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

export function isMinuteInRange(minuteOfDay: number, start: number, end: number): boolean {
  if (![minuteOfDay, start, end].every((value) => Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY)) {
    return false
  }
  if (start === end) return true
  return start < end
    ? minuteOfDay >= start && minuteOfDay < end
    : minuteOfDay >= start || minuteOfDay < end
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, amount))
}

function lerpColor(start: number, end: number, amount: number): number {
  const red = Math.round(lerp((start >> 16) & 0xff, (end >> 16) & 0xff, amount))
  const green = Math.round(lerp((start >> 8) & 0xff, (end >> 8) & 0xff, amount))
  const blue = Math.round(lerp(start & 0xff, end & 0xff, amount))
  return (red << 16) | (green << 8) | blue
}

export function getEnvironmentStyle(mapType: string, minuteOfDay: number): EnvironmentStyle {
  const minute = normalizeGameTime(DEFAULT_DAY_INDEX, minuteOfDay).minuteOfDay
  const forest = mapType === 'forest'
  if (minute >= 300 && minute < 420) {
    const progress = (minute - 300) / 120
    return {
      color: lerpColor(forest ? 0x143d52 : 0x345275, forest ? 0x155e63 : 0xfef3c7, progress),
      alpha: lerp(forest ? 0.22 : 0.24, forest ? 0.08 : 0, progress),
      lightAlpha: lerp(0.72, 0, progress),
    }
  }
  if (minute >= 420 && minute < 1080) {
    return { color: forest ? 0x155e63 : 0xffffff, alpha: forest ? 0.08 : 0, lightAlpha: 0 }
  }
  if (minute >= 1080 && minute < 1200) {
    const progress = (minute - 1080) / 120
    return {
      color: lerpColor(forest ? 0x155e63 : 0xf59e0b, forest ? 0x163b58 : 0x172554, progress),
      alpha: lerp(forest ? 0.1 : 0.06, forest ? 0.25 : 0.28, progress),
      lightAlpha: lerp(0.05, 0.86, progress),
    }
  }
  return {
    color: forest ? 0x163b58 : 0x172554,
    alpha: forest ? 0.25 : 0.28,
    lightAlpha: 0.86,
  }
}
