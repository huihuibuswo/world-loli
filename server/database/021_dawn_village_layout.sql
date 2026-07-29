BEGIN;

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '训练木偶'
                        THEN item || jsonb_build_object('x', 300, 'y', 210)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '训练教官'
                        THEN item || jsonb_build_object('x', 430, 'y', 270)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '晨曦村村长'
                        THEN item || jsonb_build_object('x', 690, 'y', 575)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '铁匠少女苏娜'
                        THEN item || jsonb_build_object('x', 390, 'y', 875)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '杂货商'
                        THEN item || jsonb_build_object('x', 1110, 'y', 825)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '狼娘·露娜'
                        THEN item || jsonb_build_object('x', 1240, 'y', 1130)
                    WHEN item->>'type' = 'npc' AND item->>'template_name' = '森林向导'
                        THEN item || jsonb_build_object('x', 1510, 'y', 1450)
                    WHEN item->>'type' = 'collectible_plant' AND item->>'node_id' = 'village_dew_01'
                        THEN item || jsonb_build_object('x', 210, 'y', 360)
                    WHEN item->>'type' = 'collectible_plant' AND item->>'node_id' = 'village_berry_01'
                        THEN item || jsonb_build_object('x', 1312, 'y', 680)
                    WHEN item->>'type' = 'collectible_plant' AND item->>'node_id' = 'village_sunbell_01'
                        THEN item || jsonb_build_object('x', 950, 'y', 420)
                    WHEN item->>'type' = 'collectible_plant' AND item->>'node_id' = 'village_fire_01'
                        THEN item || jsonb_build_object('x', 560, 'y', 780)
                    WHEN item->>'type' = 'collectible_plant' AND item->>'node_id' = 'village_vine_01'
                        THEN item || jsonb_build_object('x', 1390, 'y', 1080)
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
