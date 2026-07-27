BEGIN;

UPDATE npc_templates
SET
    story = '肩侧负伤并受失控月痕侵蚀的狼族少女。她在确认旅人没有污染后，将共鸣卡灵投影托付给对方，实体留在晨曦村疗养。',
    reward = COALESCE(reward, '{}'::JSONB) || jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-luna',
        'portrait', '/assets/generated/portraits/luna.webp',
        'story_gate', 'opening_moon_scar',
        'dialogue', jsonb_build_array(
            '你身上有那道月痕的味道。别再往前——它正在牵动我的伤口。',
            '相同的断月纹刚刚袭击了我，也正在伤害狼族领地。',
            '如果你不是污染者，就用基础卡牌的稳定回路证明给我看。'
        )
    )
WHERE name = '狼娘·露娜';

INSERT INTO npc_templates (name, type, story, battle_deck, reward, is_card_spirit)
VALUES (
    '雾痕兽影',
    'story_monster',
    '断月纹污染模仿狼族力量凝成的攻击性轮廓，没有气味，也不是真正的狼族。',
    jsonb_build_object(
        'hp', 58,
        'energy', 3,
        'hand_size', 5,
        'monster_rank', 'elite',
        'cards', jsonb_build_array(
            jsonb_build_object(
                'card_template_id', (SELECT id FROM card_templates WHERE name = '月牙撕裂'),
                'amount', 2
            ),
            jsonb_build_object(
                'card_template_id', (SELECT id FROM card_templates WHERE name = '战术打击'),
                'amount', 5
            ),
            jsonb_build_object(
                'card_template_id', (SELECT id FROM card_templates WHERE name = '防御姿态'),
                'amount', 3
            )
        ),
        'action_weights', jsonb_build_object('damage', 1.05, 'shield', 0.75)
    ),
    jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-luna',
        'story_gate', 'opening_moon_scar',
        'dialogue', jsonb_build_array(
            '雾核吞下三处证据的共鸣，凝成了一头没有气味的兽影。',
            '它并非真正的狼族。击散它，留下完整的断月纹记录。'
        )
    ),
    FALSE
)
ON CONFLICT (name) DO UPDATE SET
    type = EXCLUDED.type,
    story = EXCLUDED.story,
    battle_deck = EXCLUDED.battle_deck,
    reward = EXCLUDED.reward,
    is_card_spirit = EXCLUDED.is_card_spirit;

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(item)
            FROM jsonb_array_elements(COALESCE(resource_json->'objects', '[]'::JSONB)) AS item
            WHERE NOT (
                item->>'type' = 'npc'
                AND item->>'template_name' = '狼娘·露娜'
            )
        ),
        '[]'::JSONB
    ) || jsonb_build_array(
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '狼娘·露娜'),
            'template_name', '狼娘·露娜',
            'sprite', 'npc-luna',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'complete',
            'stationary', TRUE,
            'x', 1090,
            'y', 930
        )
    ),
    TRUE
)
WHERE map_name = '晨曦村';

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(item)
            FROM jsonb_array_elements(COALESCE(resource_json->'objects', '[]'::JSONB)) AS item
            WHERE NOT (
                (item->>'type' = 'npc' AND item->>'template_name' IN ('狼娘·露娜', '雾痕兽影'))
                OR item->>'type' = 'story_evidence'
            )
        ),
        '[]'::JSONB
    ) || jsonb_build_array(
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '狼娘·露娜'),
            'template_name', '狼娘·露娜',
            'sprite', 'npc-luna',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'forest_signal',
            'x', 620,
            'y', 520
        ),
        jsonb_build_object(
            'type', 'story_evidence',
            'evidence_id', 'moonlight_flora',
            'name', '异常闭合的月光植物',
            'description', '月光植物在雾流逆转时同时闭合。',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'moon_trace_evidence',
            'x', 620,
            'y', 520
        ),
        jsonb_build_object(
            'type', 'story_evidence',
            'evidence_id', 'broken_wolf_tracks',
            'name', '突然中断的狼族足迹',
            'description', '狼族足迹在开阔地中央突然消失。',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'moon_trace_evidence',
            'x', 1010,
            'y', 890
        ),
        jsonb_build_object(
            'type', 'story_evidence',
            'evidence_id', 'broken_moon_mist_core',
            'name', '附着断月纹的雾核',
            'description', '雾核表面附着无法自然形成的断月纹。',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'moon_trace_evidence',
            'x', 1320,
            'y', 1180
        ),
        jsonb_build_object(
            'type', 'npc',
            'template_id', (SELECT id FROM npc_templates WHERE name = '雾痕兽影'),
            'template_name', '雾痕兽影',
            'sprite', 'npc-luna',
            'story_gate', 'opening_moon_scar',
            'story_stage', 'moon_trace_battle',
            'stationary', TRUE,
            'tint', 7153881,
            'x', 1320,
            'y', 1180
        )
    ),
    TRUE
)
WHERE map_name = '微光森林';

UPDATE player_story_progress
SET data_json = COALESCE(data_json, '{}'::JSONB) || jsonb_build_object(
    'main_quest', '月痕追迹',
    'luna_injured', TRUE,
    'luna_recovery_state', 'recuperating',
    'moon_trace_stage', COALESCE(data_json->>'moon_trace_stage', 'moon_trace_accept')
)
WHERE story_key = 'opening_moon_scar'
  AND stage = 'complete';

COMMIT;
