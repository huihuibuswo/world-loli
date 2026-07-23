BEGIN;

CREATE TABLE IF NOT EXISTS npc_first_victory_rewards (
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    npc_id BIGINT NOT NULL,
    card_template_id BIGINT NOT NULL REFERENCES card_templates(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, npc_id)
);

INSERT INTO card_templates (name, type, cost, rarity, source_spirit_id, effect_json, upgrade_json)
VALUES
    ('晨曦号令', 'attack', 2, 'uncommon', NULL, '{"damage":14}'::JSONB, '{"damage_per_level":3}'::JSONB),
    ('精明投掷', 'attack', 1, 'uncommon', NULL, '{"damage":10}'::JSONB, '{"damage_per_level":2}'::JSONB),
    ('炽热锻击', 'attack', 2, 'rare', NULL, '{"damage":16}'::JSONB, '{"damage_per_level":3}'::JSONB),
    ('引路箭', 'attack', 1, 'uncommon', NULL, '{"damage":11}'::JSONB, '{"damage_per_level":2}'::JSONB),
    ('破绽识破', 'attack', 2, 'uncommon', NULL, '{"damage":15}'::JSONB, '{"damage_per_level":3}'::JSONB)
ON CONFLICT (name) DO UPDATE SET
    type = EXCLUDED.type,
    cost = EXCLUDED.cost,
    rarity = EXCLUDED.rarity,
    source_spirit_id = EXCLUDED.source_spirit_id,
    effect_json = EXCLUDED.effect_json,
    upgrade_json = EXCLUDED.upgrade_json;

UPDATE npc_templates
SET
    story = '欢迎来到晨曦村。村长想亲自看看新旅人的勇气与判断。',
    battle_deck = '{"hp":28,"attack":5}'::JSONB,
    reward = jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-village-chief',
        'portrait', '/assets/generated/portraits/npc-village-chief.webp',
        'dialogue', jsonb_build_array(
            '旅人，欢迎来到晨曦村。这里不富裕，但每一盏灯都愿意为归来的人亮着。',
            '我年轻时也曾带着一副旧牌走过迷雾森林。真正保护同伴的，从来不只是力量。',
            '若你已经准备好，就让我看看你在牌桌上的判断吧。'
        ),
        'first_victory_card_template_id', (SELECT id FROM card_templates WHERE name = '晨曦号令')
    )
WHERE name = '晨曦村村长';

UPDATE npc_templates
SET
    story = '杂货商相信观察与取舍也是冒险者不可缺少的本领。',
    battle_deck = '{"hp":24,"attack":4}'::JSONB,
    reward = jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-shopkeeper',
        'portrait', '/assets/generated/portraits/npc-shopkeeper.webp',
        'dialogue', jsonb_build_array(
            '欢迎光临。先别急着掏金币，能平安回来的冒险者才是最好的客人。',
            '做买卖和打牌一样，要看清手里的筹码，也要猜到对方舍不得什么。',
            '想试试自己的眼力吗？赢了的话，我送你一张压箱底的牌。'
        ),
        'first_victory_card_template_id', (SELECT id FROM card_templates WHERE name = '精明投掷')
    )
WHERE name = '杂货商';

UPDATE npc_templates
SET
    story = '苏娜愿意用一场切磋检验冒险者是否懂得把握出手时机。',
    battle_deck = '{"hp":34,"attack":6}'::JSONB,
    reward = jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-suna',
        'portrait', '/assets/generated/portraits/npc-suna.webp',
        'dialogue', jsonb_build_array(
            '炉火不能太急。温度差一点，锻出来的刃就会在最需要它的时候断掉。',
            '战斗也一样。出手之前先听呼吸、看重心，然后把力量用在唯一正确的地方。',
            '来切磋一场吧。要是你能接住我的锻击，这张牌就归你。'
        ),
        'first_victory_card_template_id', (SELECT id FROM card_templates WHERE name = '炽热锻击')
    )
WHERE name = '铁匠少女苏娜';

UPDATE npc_templates
SET
    story = '森林向导会用迷雾中的战术考验准备进入森林的旅人。',
    battle_deck = '{"hp":30,"attack":5}'::JSONB,
    reward = jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-forest-guide',
        'portrait', '/assets/generated/portraits/npc-forest-guide.webp',
        'dialogue', jsonb_build_array(
            '迷雾森林不会主动伤人，真正危险的是人在看不清方向时做出的决定。',
            '记住苔藓、风声和鸟群的方向，它们比路牌更诚实。',
            '在你进森林前，让我确认一下你是否能在压力下保持清醒。'
        ),
        'first_victory_card_template_id', (SELECT id FROM card_templates WHERE name = '引路箭')
    )
WHERE name = '森林向导';

UPDATE npc_templates
SET
    story = '训练教官不再依赖木偶，亲自负责每一位新人的实战训练。',
    battle_deck = '{"hp":20,"attack":3}'::JSONB,
    reward = jsonb_build_object(
        'actions', jsonb_build_array('dialog', 'battle'),
        'sprite', 'npc-trainer',
        'portrait', '/assets/generated/portraits/npc-trainer.webp',
        'dialogue', jsonb_build_array(
            '木偶只能教你怎么出牌，却教不了你如何面对一个会思考的对手。',
            '从今天起由我亲自陪练。先稳住节奏，再寻找对方露出的破绽。',
            '准备好了就开始。第一次赢我，这张训练牌就是你的毕业礼。'
        ),
        'first_victory_card_template_id', (SELECT id FROM card_templates WHERE name = '破绽识破')
    )
WHERE name = '训练教官';

WITH dummy AS (
    SELECT id FROM npc_templates WHERE name = '训练木偶'
)
UPDATE active_battles
SET
    status = 'abandoned',
    state_json = jsonb_set(
        jsonb_set(state_json, '{result}', '"abandoned"'::JSONB, TRUE),
        '{reward}', '{}'::JSONB, TRUE
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE enemy_id IN (SELECT id FROM dummy)
  AND status = 'active';

UPDATE map_data
SET resource_json = jsonb_set(
    resource_json,
    '{objects}',
    COALESCE(
        (
            SELECT jsonb_agg(item)
            FROM jsonb_array_elements(COALESCE(resource_json->'objects', '[]'::JSONB)) AS item
            WHERE item->>'template_name' <> '训练木偶'
        ),
        '[]'::JSONB
    ),
    TRUE
)
WHERE resource_json ? 'objects';

DELETE FROM npc_templates WHERE name = '训练木偶';

COMMIT;
