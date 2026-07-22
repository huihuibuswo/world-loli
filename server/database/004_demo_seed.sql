BEGIN;

INSERT INTO card_spirit_templates (
    name, race, rarity, type, story, avatar, base_skill, awakening_skill
)
VALUES (
    '狼娘·露娜',
    '狼族',
    'rare',
    'physical',
    '来自迷雾森林的狼族少女。',
    '/assets/generated/portraits/luna.webp',
    '{"name":"月牙撕裂","damage":12}'::JSONB,
    '{"name":"银月觉醒","damage_bonus":8}'::JSONB
)
ON CONFLICT (name) DO NOTHING;

UPDATE card_spirit_templates
SET avatar = '/assets/generated/portraits/luna.webp'
WHERE name = '狼娘·露娜' AND avatar IS NULL;

INSERT INTO card_templates (
    name, type, cost, rarity, source_spirit_id, effect_json, upgrade_json
)
VALUES
    (
        '基础攻击', 'attack', 1, 'common', NULL,
        '{"damage":8}'::JSONB,
        '{"damage_per_level":2}'::JSONB
    ),
    (
        '月牙撕裂', 'attack', 2, 'rare',
        (SELECT id FROM card_spirit_templates WHERE name = '狼娘·露娜'),
        '{"damage":15}'::JSONB,
        '{"damage_per_level":3}'::JSONB
    )
ON CONFLICT (name) DO NOTHING;

INSERT INTO npc_templates (
    name, type, story, battle_deck, reward, is_card_spirit
)
VALUES (
    '训练木偶',
    'training',
    '村里的训练木偶，用来熟悉卡牌战斗。',
    '{"hp":20,"attack":3}'::JSONB,
    jsonb_build_object(
        'gold', 10,
        'spirit_exp', 60,
        'actions', jsonb_build_array('dialog', 'battle'),
        'spirit_template_id', (SELECT id FROM card_spirit_templates WHERE name = '狼娘·露娜'),
        'card_template_ids', jsonb_build_array(
            (SELECT id FROM card_templates WHERE name = '月牙撕裂')
        )
    ),
    FALSE
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO map_data (map_name, map_type, level_limit, resource_json)
VALUES (
    '晨曦村',
    'village',
    1,
    '{
      "spawn":{"x":128,"y":128},
      "bounds":{"min_x":0,"min_y":0,"max_x":2048,"max_y":2048},
      "objects":[
        {"type":"npc","template_name":"训练木偶","x":320,"y":192}
      ]
    }'::JSONB
)
ON CONFLICT (map_name) DO NOTHING;

COMMIT;
