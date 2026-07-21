BEGIN;

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    jsonb_build_array(
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '训练木偶'),
            'template_name', '训练木偶',
            'x', 320,
            'y', 192
        )
    )
)
WHERE map_name = '晨曦村';

COMMIT;
