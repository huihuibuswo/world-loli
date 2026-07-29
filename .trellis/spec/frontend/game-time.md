# Game Time Contract

## Scenario: Persistent day/night state

### 1. Scope / Trigger

Use this contract whenever a feature reads, advances, persists, displays, or gates behavior by in-game time. It prevents the HUD, Phaser scenes, battles, NPC schedules, and saves from drifting onto separate clocks.

### 2. Signatures

- Database: `players.day_index INTEGER NOT NULL DEFAULT 1 CHECK (day_index >= 1)`.
- Database: `players.minute_of_day INTEGER NOT NULL DEFAULT 480 CHECK (minute_of_day >= 0 AND minute_of_day < 1440)`.
- API: `POST /api/v1/save` accepts optional strict integers `day_index` and `minute_of_day`.
- Frontend owner: `useGameStore().gameTime` and `advanceWorldTime(elapsedMs)`.
- Shared functions: `normalizeGameTime`, `advanceGameTime`, `getTimePhase`, `isMinuteInRange` in `game-client/src/game/time.ts`.

### 3. Contracts

- Persist only `day_index` and `minute_of_day`; derive `phase` in the shared time module.
- The Pinia game store is the single runtime clock owner.
- `WorldScene` may emit `time:advance`, but it must not keep an independent time counter.
- Phaser scenes consume `GAME_TIME_KEY` registry snapshots and `time:changed` events.
- Device wall-clock APIs (`Date`, `getHours`, offline elapsed timestamps) are not game-time inputs.
- Hidden tabs, blurred windows, battle, dialogue, menus, loading, and world input locks pause time without catch-up.
- Missing legacy fields normalize to day 1 at `08:00`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `day_index < 1` | API returns `422`; database constraint rejects direct writes |
| `minute_of_day < 0` or `>= 1440` | API returns `422`; database constraint rejects direct writes |
| Boolean or fractional time input | API returns `422`; fields use strict integer validation |
| Empty `POST /save` body | Remains valid for backward compatibility |
| Missing client fields | Normalize to `1 / 480`, never render `NaN` |
| Schedule crosses midnight | Use `isMinuteInRange`; do not compare only with `start <= time < end` |

### 5. Good / Base / Bad Cases

- Good: the store advances from `23:59` to day `N+1`, `00:00`, emits one `time:changed`, and all consumers update from that snapshot.
- Base: an NPC without schedule fields remains available all day.
- Bad: `BattleScene` calls `new Date().getHours()` or a Vue component starts another interval.

### 6. Tests Required

- Pure functions: every phase boundary, cross-day rollover, remainder carry, formatting, invalid normalization, and midnight-spanning ranges.
- API: defaults, full and partial saves, empty body, round-trip profile serialization, strict invalid inputs.
- Database verification: defaults, constraints, and seeded NPC schedule values.
- Visual QA: desktop and `390px` mobile HUD without overlap; readable day/night world; scheduled NPC hidden with body, label, and marker disabled while critical NPCs remain visible.

### 7. Wrong vs Correct

#### Wrong

```ts
const isDay = new Date().getHours() >= 6
setInterval(() => localMinute.value += 1, 1000)
```

#### Correct

```ts
gameEvents.emit('time:advance', { elapsedMs: delta })
game.advanceWorldTime(elapsedMs)
const phase = getTimePhase(game.gameTime.minuteOfDay)
```

The world scene supplies elapsed active-play time; the store owns the state transition; every consumer imports the same derivation functions.

