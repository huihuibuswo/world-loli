BEGIN;

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS day_index INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS minute_of_day INTEGER NOT NULL DEFAULT 480;

ALTER TABLE players
    DROP CONSTRAINT IF EXISTS ck_players_day_index,
    DROP CONSTRAINT IF EXISTS ck_players_minute_of_day;

ALTER TABLE players
    ADD CONSTRAINT ck_players_day_index CHECK (day_index >= 1),
    ADD CONSTRAINT ck_players_minute_of_day CHECK (minute_of_day >= 0 AND minute_of_day < 1440);

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '杂货商'
                        THEN item || jsonb_build_object(
                            'available_from', 480,
                            'available_until', 1200,
                            'schedule_critical', FALSE
                        )
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '铁匠少女苏娜'
                        THEN item || jsonb_build_object(
                            'available_from', 420,
                            'available_until', 1140,
                            'schedule_critical', FALSE
                        )
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '训练教官'
                        THEN item || jsonb_build_object(
                            'available_from', 360,
                            'available_until', 1320,
                            'schedule_critical', FALSE
                        )
                    ELSE item
                END
                ORDER BY ordinal
            )
            FROM jsonb_array_elements(COALESCE(resource_json->'objects', '[]'::JSONB))
                WITH ORDINALITY AS objects(item, ordinal)
        ),
        '[]'::JSONB
    ),
    TRUE
)
WHERE map_name = '晨曦村';

COMMIT;
