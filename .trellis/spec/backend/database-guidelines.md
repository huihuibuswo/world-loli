# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Common Mistakes

<!-- Database-related mistakes your team has made -->

## Scenario: Expanding A Persisted State Machine

### 1. Scope / Trigger

Use this contract whenever application code adds or renames a value persisted in a column protected by a PostgreSQL `CHECK` constraint. A service constant alone does not change the database contract.

### 2. Signatures

- Application owner: the complete state set, for example `STAGES` in `opening_story_service.py`.
- Database owner: the matching `CHECK (stage IN (...))` constraint.
- Migration: a new numbered file under `server/database/` that drops and recreates the named constraint.

### 3. Contracts

- Every value written by the service must be accepted by the database constraint.
- Removed values must be migrated or rejected deliberately before the new constraint is installed.
- Migration files must be safe when the Compose migration service replays the full ordered directory.

### 4. Validation & Error Matrix

| Condition | Expected result |
| --- | --- |
| Service writes a declared state | Transaction commits |
| Service writes a state missing from the constraint | Migration defect; PostgreSQL raises `check_violation` |
| Unknown state is inserted directly | PostgreSQL raises `check_violation` |
| Existing rows contain a removed state | Migration must transform them before adding the new constraint |

### 5. Good/Base/Bad Cases

- Good: add `meet_chief` to `STAGES`, add a numbered constraint migration, and exercise the API transition.
- Base: existing states continue to commit after migration replay.
- Bad: change only the Python constant and rely on ORM model validation; PostgreSQL remains authoritative and rejects the write.

### 6. Tests Required

- API integration test: execute the transition and assert the returned state.
- Schema verification: insert the newly added state successfully.
- Negative schema verification: insert an unknown state and assert `check_violation`.
- Migration replay: run `docker compose run --rm migrate` against an existing development database.

### 7. Wrong vs Correct

Wrong:

```python
STAGES = {"arrival", "meet_chief", "prepare"}
# No database migration.
```

Correct:

```sql
ALTER TABLE player_story_progress
    DROP CONSTRAINT IF EXISTS ck_player_story_progress_stage;

ALTER TABLE player_story_progress
    ADD CONSTRAINT ck_player_story_progress_stage CHECK (
        stage IN ('arrival', 'meet_chief', 'prepare')
    );
```

## Scenario: Extending One World Area Into Persisted Regions

### 1. Scope / Trigger

Use this contract when one existing `map_data` row must remain compatibility-stable while additional playable regions are added through `resource_json` and the existing `/map/enter` portal authorization flow.

### 2. Signatures

- Compatibility identity: the original `map_data.map_name` remains exact.
- Region identity: `resource_json.region_key: string` is unique and machine-facing.
- Display identity: `resource_json.region_name: string` is player-facing.
- Portal object: `{ type: "map_portal", target_map_id, target_map_name, x, y, spawn_x, spawn_y }`.
- Client selector: `MapData.resource.region_key` chooses the region layout; an absent or unknown key falls back to the compatibility region.

### 3. Contracts

- Add regions with a new ordered, idempotent migration; do not rename the compatibility map.
- Preserve non-portal objects on the compatibility map when rebuilding its portal list.
- Every internal adjacency is represented by two directed portal objects.
- `/map/enter` remains authoritative: non-adjacent map IDs return `403`; no direct region-switch bypass is added.
- A portal destination spawn must be outside the reverse portal interaction radius and outside the destination layout's blocking footprint.

### 4. Validation & Error Matrix

| Condition | Expected result |
| --- | --- |
| Unique known `region_key` | Client renders the matching layout |
| Missing or unknown `region_key` | Client renders the compatibility-region layout |
| Adjacent target map | `/map/enter` succeeds and persists portal `spawn_x` / `spawn_y` |
| Non-adjacent target map | `/map/enter` returns `403` |
| Spawn distance is at or below the interaction radius | Schema verification fails |
| Migration is replayed | Existing region rows and portal objects converge without duplicates |

### 5. Good/Base/Bad Cases

- Good: keep `微光森林`, add uniquely keyed region rows, and connect only adjacent regions bidirectionally.
- Base: legacy maps without `region_key` continue to render through the compatibility fallback.
- Bad: rename the original map, append duplicate portals on every migration replay, or place a spawn inside the reverse portal's interaction range.

### 6. Tests Required

- Schema verification: assert the exact region-key set, uniqueness, compatibility name, and expected directed edge count.
- Geometry verification: compare every portal spawn with the destination reverse portal and assert squared distance is greater than the player's interaction radius squared.
- API integration: traverse the whole chain forward and backward, assert persisted spawn coordinates, reject a non-adjacent jump, and retain the legacy village round trip.
- Client test: assert every configured region is complete, unknown keys fall back, and every configured asset path exists.
- Migration replay: run the ordered migration service more than once against an existing development database.

### 7. Wrong vs Correct

Wrong:

```sql
UPDATE map_data SET map_name = '微光森林·部分1：月痕前庭'
WHERE map_name = '微光森林';
-- Existing services and SQL that require the exact map name now break.
```

Correct:

```sql
UPDATE map_data
SET resource_json = jsonb_set(
    jsonb_set(resource_json, '{region_key}', '"glimmer_forest_part_1"'::jsonb, TRUE),
    '{region_name}', '"微光森林·部分1：月痕前庭"'::jsonb, TRUE
)
WHERE map_name = '微光森林';
```
