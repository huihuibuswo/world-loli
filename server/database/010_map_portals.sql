BEGIN;

INSERT INTO map_data (map_name, map_type, level_limit, resource_json)
VALUES (
    '微光森林',
    'forest',
    1,
    '{
      "spawn":{"x":1800,"y":1740},
      "bounds":{"min_x":0,"min_y":0,"max_x":2048,"max_y":2048},
      "objects":[]
    }'::JSONB
)
ON CONFLICT (map_name) DO UPDATE SET
    map_type = EXCLUDED.map_type,
    level_limit = EXCLUDED.level_limit;

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(item)
            FROM jsonb_array_elements(COALESCE(resource_json->'objects', '[]'::JSONB)) AS item
            WHERE item->>'type' <> 'map_portal'
        ),
        '[]'::JSONB
    ) || jsonb_build_array(
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林'),
            'target_map_name', '微光森林',
            'label', '前往微光森林',
            'x', 1900,
            'y', 1840,
            'spawn_x', 1800,
            'spawn_y', 1740
        )
    ),
    TRUE
)
WHERE map_name = '晨曦村';

UPDATE map_data
SET resource_json = jsonb_build_object(
    'spawn', jsonb_build_object('x', 1800, 'y', 1740),
    'bounds', jsonb_build_object('min_x', 0, 'min_y', 0, 'max_x', 2048, 'max_y', 2048),
    'objects', jsonb_build_array(
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '森林向导'),
            'template_name', '森林向导',
            'sprite', 'npc-forest-guide',
            'x', 1450,
            'y', 1420
        ),
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '训练教官'),
            'template_name', '训练教官',
            'sprite', 'npc-trainer',
            'x', 920,
            'y', 780
        ),
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '晨曦村'),
            'target_map_name', '晨曦村',
            'label', '返回晨曦村',
            'x', 1900,
            'y', 1840,
            'spawn_x', 1800,
            'spawn_y', 1740
        )
    )
)
WHERE map_name = '微光森林';

COMMIT;
