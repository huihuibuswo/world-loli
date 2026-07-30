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
