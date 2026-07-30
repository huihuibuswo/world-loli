BEGIN;

INSERT INTO map_data (map_name, map_type, level_limit, resource_json)
VALUES
    ('微光森林·银雾溪谷', 'forest', 1, '{}'::JSONB),
    ('微光森林·盘根遗迹', 'forest', 1, '{}'::JSONB),
    ('微光森林·夜萤幽径', 'forest', 1, '{}'::JSONB),
    ('微光森林·断月深林', 'forest', 1, '{}'::JSONB)
ON CONFLICT (map_name) DO UPDATE SET
    map_type = EXCLUDED.map_type,
    level_limit = EXCLUDED.level_limit;

UPDATE map_data
SET resource_json = jsonb_set(
    jsonb_set(
        jsonb_set(
            COALESCE(resource_json, '{}'::JSONB),
            '{region_key}',
            to_jsonb('glimmer_forest_part_1'::TEXT),
            TRUE
        ),
        '{region_name}',
        to_jsonb('微光森林·部分1：月痕前庭'::TEXT),
        TRUE
    ),
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
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '晨曦村'),
            'target_map_name', '晨曦村',
            'label', '返回晨曦村',
            'x', 1900,
            'y', 1840,
            'spawn_x', 1800,
            'spawn_y', 1740
        ),
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·银雾溪谷'),
            'target_map_name', '微光森林·银雾溪谷',
            'label', '前往银雾溪谷',
            'x', 1880,
            'y', 260,
            'spawn_x', 280,
            'spawn_y', 1700
        )
    ),
    TRUE
)
WHERE map_name = '微光森林';

UPDATE map_data
SET resource_json = jsonb_build_object(
    'region_key', 'glimmer_forest_part_2',
    'region_name', '微光森林·部分2：银雾溪谷',
    'spawn', jsonb_build_object('x', 280, 'y', 1700),
    'bounds', jsonb_build_object('min_x', 0, 'min_y', 0, 'max_x', 2048, 'max_y', 2048),
    'objects', jsonb_build_array(
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林'),
            'target_map_name', '微光森林',
            'label', '返回月痕前庭',
            'x', 160,
            'y', 1840,
            'spawn_x', 1780,
            'spawn_y', 520
        ),
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·盘根遗迹'),
            'target_map_name', '微光森林·盘根遗迹',
            'label', '前往盘根遗迹',
            'x', 1880,
            'y', 200,
            'spawn_x', 280,
            'spawn_y', 1700
        )
    )
)
WHERE map_name = '微光森林·银雾溪谷';

UPDATE map_data
SET resource_json = jsonb_build_object(
    'region_key', 'glimmer_forest_part_3',
    'region_name', '微光森林·部分3：盘根遗迹',
    'spawn', jsonb_build_object('x', 280, 'y', 1700),
    'bounds', jsonb_build_object('min_x', 0, 'min_y', 0, 'max_x', 2048, 'max_y', 2048),
    'objects', jsonb_build_array(
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·银雾溪谷'),
            'target_map_name', '微光森林·银雾溪谷',
            'label', '返回银雾溪谷',
            'x', 160,
            'y', 1840,
            'spawn_x', 1780,
            'spawn_y', 520
        ),
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·夜萤幽径'),
            'target_map_name', '微光森林·夜萤幽径',
            'label', '前往夜萤幽径',
            'x', 1880,
            'y', 220,
            'spawn_x', 280,
            'spawn_y', 1700
        )
    )
)
WHERE map_name = '微光森林·盘根遗迹';

UPDATE map_data
SET resource_json = jsonb_build_object(
    'region_key', 'glimmer_forest_part_4',
    'region_name', '微光森林·部分4：夜萤幽径',
    'spawn', jsonb_build_object('x', 280, 'y', 1700),
    'bounds', jsonb_build_object('min_x', 0, 'min_y', 0, 'max_x', 2048, 'max_y', 2048),
    'objects', jsonb_build_array(
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·盘根遗迹'),
            'target_map_name', '微光森林·盘根遗迹',
            'label', '返回盘根遗迹',
            'x', 160,
            'y', 1840,
            'spawn_x', 1780,
            'spawn_y', 520
        ),
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·断月深林'),
            'target_map_name', '微光森林·断月深林',
            'label', '前往断月深林',
            'x', 1880,
            'y', 220,
            'spawn_x', 280,
            'spawn_y', 1700
        )
    )
)
WHERE map_name = '微光森林·夜萤幽径';

UPDATE map_data
SET resource_json = jsonb_build_object(
    'region_key', 'glimmer_forest_part_5',
    'region_name', '微光森林·部分5：断月深林',
    'spawn', jsonb_build_object('x', 280, 'y', 1700),
    'bounds', jsonb_build_object('min_x', 0, 'min_y', 0, 'max_x', 2048, 'max_y', 2048),
    'objects', jsonb_build_array(
        jsonb_build_object(
            'type', 'map_portal',
            'target_map_id', (SELECT id FROM map_data WHERE map_name = '微光森林·夜萤幽径'),
            'target_map_name', '微光森林·夜萤幽径',
            'label', '返回夜萤幽径',
            'x', 160,
            'y', 1840,
            'spawn_x', 1780,
            'spawn_y', 520
        )
    )
)
WHERE map_name = '微光森林·断月深林';

COMMIT;
