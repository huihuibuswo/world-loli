# 昼夜系统技术设计

## Boundaries

- Persistence owner: `players.day_index`, `players.minute_of_day`.
- API owner: existing player serialization and `/save` endpoints.
- Runtime state owner: Pinia `useGameStore`.
- Tick source: the existing Phaser world update loop emits elapsed world time only while the world scene is active and unlocked.
- Visual owner: `WorldScene` environment overlay.
- HUD owner: `GameShell.vue`.
- Schedule configuration owner: optional fields on map NPC objects.

## Core Module

Add `game-client/src/game/time.ts` with dependency-free constants and pure functions:

```ts
type TimePhase = 'dawn' | 'day' | 'dusk' | 'night'

normalizeGameTime(dayIndex, minuteOfDay)
advanceGameTime(state, elapsedMs, remainderMs)
getTimePhase(minuteOfDay)
formatGameTime(minuteOfDay)
isMinuteInRange(minuteOfDay, start, end)
getEnvironmentStyle(mapType, minuteOfDay)
```

`advanceGameTime` carries fractional elapsed milliseconds so frame rounding does not lose time. One accumulated real second advances one game minute.

## Data Contracts

### Backend

```json
{
  "day_index": 1,
  "minute_of_day": 480
}
```

- Both fields are integers with `day_index >= 1` and `0 <= minute_of_day < 1440`.
- `SaveGameRequest` makes both fields optional for backward compatibility.
- If one value is supplied without the other, update only the supplied value after validation.
- `player_data()` includes both fields, so `/player/profile`, `/save`, map transitions that embed player data, and profile refreshes stay consistent.

### Frontend

`PlayerProfile` gains snake_case persisted fields. `GameTimeState` uses client-style camelCase plus derived `phase`:

```ts
interface GameTimeState {
  dayIndex: number
  minuteOfDay: number
  phase: TimePhase
}
```

The store initializes it from `PlayerProfile`, updates both the runtime state and player fields on tick, and sends the persisted values in `saveGame()`.

### Map NPC schedule

```json
{
  "available_from": 480,
  "available_until": 1200,
  "schedule_critical": false
}
```

Absent schedule fields mean always available. `schedule_critical = true` also forces availability.

## Runtime Data Flow

```text
profile/save response
  -> Pinia gameTime
  -> WorldGame registry snapshot
  -> WorldScene overlay + NPC visibility
  -> BattleScene phase snapshot

WorldScene update(delta)
  -> gameEvents time:advance
  -> Pinia advanceGameTime
  -> gameEvents time:changed
  -> registry update + WorldScene visual refresh

manual save
  -> POST /save { day_index, minute_of_day }
  -> database commit
  -> snapshot response
```

`WorldScene` only emits elapsed time when it is active and `worldInputLocked` is false. Because battle stops `WorldScene`, battle time is naturally paused. GameShell locks world input for dialogue, drawers, opening dialogue, and loading. Visibility/blur is added as another lock source and elapsed gaps are discarded.

## Scene Lighting

Use a screen-space Phaser rectangle with `setScrollFactor(0)` and a high world depth below `UIScene`/DOM HUD. Update fill color and alpha from a pure environment-style function.

- Dawn: cold blue fading toward neutral daylight.
- Day: transparent or near-transparent overlay.
- Dusk: warm low-alpha tint fading toward night.
- Night: blue/cyan overlay, never opaque black.
- Forest palettes use lower brightness and colder hues but cap alpha to preserve paths and labels.

Add lightweight village light circles for existing well/building anchors at dusk/night. Lights are decorative, do not use physics, and are hidden during day.

## NPC Availability

`WorldScene` keeps schedule metadata associated with each created `NPC`. On phase/minute changes it applies `setScheduleAvailable()` on the NPC entity:

- unavailable: stop movement, disable body, hide sprite/name label, hide marker, clear nearby interaction.
- available: restore active/visible/body and resume normal wandering.

The NPC entity owns sprite/label visibility so labels cannot remain orphaned. Schedule checks run on initial creation and when the game minute changes, not every frame.

## Pause Semantics

- The world tick is controlled by scene activity plus the existing `WORLD_INPUT_LOCK_KEY`.
- GameShell already derives lock state from dialogue/drawer/opening overlays and battle; extend it with map loading and page visibility/focus.
- When hidden or blurred, record no elapsed duration. Resume starts from the next frame delta.
- No `Date.now()` based catch-up is used.

## Compatibility

- Migration is append-only and applies defaults to existing rows.
- Empty `POST /save` remains valid.
- Missing schedule fields preserve current NPC behavior.
- Missing client time fields normalize to day 1 `08:00` for defensive compatibility.
- Existing generated `.d.ts`/`.js` siblings are not manually edited; TypeScript is authoritative.

## Trade-offs

- Store fields live on `players` rather than a new save table because the project has one player record per current save and existing snapshots already serialize the player.
- Manual save persists time; position autosaves do not write time to avoid a save request every movement interval.
- No offline progression prevents unexpected missed content and avoids trusting device wall-clock time.
- Programmatic overlays/lights deliver the first usable cycle without requiring new art.

## Rollback

- Frontend rollback removes the time module, HUD, events, and scene lighting while leaving database columns harmlessly unused.
- API rollback can keep serializing defaulted columns; the empty save route remains compatible.
- NPC schedule migration only adds JSON fields and can be reversed with a follow-up migration if necessary.

