BEGIN;

UPDATE map_data
SET map_name = '晨曦村', map_type = 'village'
WHERE map_name = '晨雾森林'
  AND NOT EXISTS (SELECT 1 FROM map_data WHERE map_name = '晨曦村');

UPDATE map_data
SET map_type = 'village'
WHERE map_name = '晨曦村';

INSERT INTO npc_templates (name, type, story, battle_deck, reward, is_card_spirit)
VALUES
    (
        '晨曦村村长', 'dialogue',
        '欢迎来到晨曦村。先去训练区熟悉战斗，再沿着村道认识这里的居民吧。',
        '{}'::JSONB,
        '{"actions":["dialog","quest"],"sprite":"npc-village-chief"}'::JSONB,
        FALSE
    ),
    (
        '杂货商', 'shop',
        '旅行前记得检查补给。森林里的露水会让药草长得格外精神。',
        '{}'::JSONB,
        '{"actions":["dialog","shop"],"sprite":"npc-shopkeeper"}'::JSONB,
        FALSE
    ),
    (
        '铁匠少女苏娜', 'craft',
        '好工具要耐心打磨，冒险也一样。等你带回矿石，我再帮你看看。',
        '{}'::JSONB,
        '{"actions":["dialog","craft"],"sprite":"npc-suna"}'::JSONB,
        FALSE
    ),
    (
        '森林向导', 'quest',
        '前面就是迷雾森林。沿着路牌走，听见陌生动静时不要贸然靠近。',
        '{}'::JSONB,
        '{"actions":["dialog","quest"],"sprite":"npc-forest-guide"}'::JSONB,
        FALSE
    ),
    (
        '训练教官', 'training',
        '先绕着木偶移动一圈，再按下互动键发起训练。稳住节奏最重要。',
        '{}'::JSONB,
        '{"actions":["dialog"],"sprite":"npc-trainer"}'::JSONB,
        FALSE
    )
ON CONFLICT (name) DO UPDATE SET
    type = EXCLUDED.type,
    story = EXCLUDED.story,
    battle_deck = EXCLUDED.battle_deck,
    reward = EXCLUDED.reward,
    is_card_spirit = EXCLUDED.is_card_spirit;

UPDATE npc_templates
SET reward = reward || '{"sprite":"training-dummy"}'::JSONB
WHERE name = '训练木偶';

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    jsonb_build_array(
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '训练木偶'), 'template_name', '训练木偶', 'sprite', 'training-dummy', 'x', 320, 'y', 192),
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '训练教官'), 'template_name', '训练教官', 'sprite', 'npc-trainer', 'x', 420, 'y', 245),
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '晨曦村村长'), 'template_name', '晨曦村村长', 'sprite', 'npc-village-chief', 'x', 650, 'y', 545),
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '铁匠少女苏娜'), 'template_name', '铁匠少女苏娜', 'sprite', 'npc-suna', 'x', 300, 'y', 850),
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '杂货商'), 'template_name', '杂货商', 'sprite', 'npc-shopkeeper', 'x', 920, 'y', 810),
        jsonb_build_object('type', 'npc', 'template_id', (SELECT id FROM npc_templates WHERE name = '森林向导'), 'template_name', '森林向导', 'sprite', 'npc-forest-guide', 'x', 1160, 'y', 1130)
    )
)
WHERE map_name = '晨曦村';

COMMIT;
