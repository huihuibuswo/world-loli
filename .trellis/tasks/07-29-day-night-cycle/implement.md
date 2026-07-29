# 昼夜系统实施计划

## Ordered Checklist

- [x] Add migration `022_day_night_cycle.sql` with constrained player time columns and Dawn Village NPC schedule JSON fields.
- [x] Extend SQLAlchemy `Player`, Pydantic save schema, `player_data()`, and `/save` persistence.
- [x] Add backend API-flow coverage for default time, valid persistence, invalid ranges, and empty-body compatibility.
- [x] Add frontend time types and dependency-free `game/time.ts` utilities.
- [x] Extend game events and `WorldGame` registry synchronization for time advance/change.
- [x] Add Pinia time state initialization, ticking, rollover, reset, and save payload.
- [x] Add GameShell time HUD and visibility/focus pause coordination.
- [x] Add WorldScene environment overlay, village lights, time tick emission, and NPC schedule updates.
- [x] Update NPC entity to safely toggle sprite, label, movement, and physics availability.
- [x] Update BattleScene to use the shared phase snapshot and remove device clock usage.
- [x] Run adversarial review for duplicated timers, hidden-tab jumps, schedule edge cases, night readability, and stale save responses.
- [x] Run full relevant verification and capture desktop/mobile screenshots for day and night.

## Validation

```powershell
Set-Location game-client
npm run typecheck
npm run build
```

```powershell
Set-Location server
pytest tests/test_api_flow.py
```

If the configured integration database is available, also run the complete backend test suite. For visual QA, run the Vite development server and inspect desktop/mobile screenshots at forced day and night values through the development-only time control or registry state.

## Risky Files

- `game-client/src/stores/game.ts`: central state; avoid unrelated refactors and ensure profile refreshes do not reset advanced local time unexpectedly.
- `game-client/src/game/scenes/WorldScene.ts`: high activity scene; keep overlay and schedule updates event-driven, not object rebuilds per frame.
- `game-client/src/game/entities/NPC.ts`: physics/body toggling must not leave invisible colliders or orphan labels.
- `server/app/api/save.py`: preserve empty request compatibility and commit behavior.
- `server/database/022_day_night_cycle.sql`: constraints/defaults must work for existing player rows.

## Review Gates

- Before activation: PRD, design, and implementation plan agree on one timer, no offline catch-up, and Must-only scope.
- Before visual QA: typecheck/build pass and the world scene renders without errors.
- Before completion: backend persistence tests pass; battle no longer references `Date`; hidden-tab and midnight schedule behavior are manually checked.

## Deferred Follow-ups

- Sleep/skip-time interaction.
- Full NPC route schedules and interiors.
- Weather, seasons, moon phase, offline progression, and time-gated encounter/reward systems.
- Bespoke night lighting art and performance quality tiers.
