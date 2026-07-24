BEGIN;

UPDATE active_battles
SET
    status = 'abandoned',
    state_json = jsonb_set(
        jsonb_set(state_json, '{result}', '"abandoned"'::JSONB, TRUE),
        '{reward}', '{}'::JSONB, TRUE
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
  AND EXISTS (
      SELECT 1
      FROM card_templates
      WHERE name = '基础攻击'
        AND effect_json = '{"damage":8}'::JSONB
  );

ALTER TABLE players ALTER COLUMN hp SET DEFAULT 75;

UPDATE players
SET hp = 75
WHERE level = 1
  AND hp = 100
  AND EXISTS (
      SELECT 1
      FROM card_templates
      WHERE name = '基础攻击'
        AND effect_json = '{"damage":8}'::JSONB
  );

UPDATE card_templates
SET effect_json = '{"damage":6}'::JSONB
WHERE name = '基础攻击';

UPDATE card_templates
SET effect_json = '{"shield":8}'::JSONB
WHERE name = '防御姿态';

UPDATE card_templates
SET effect_json = '{"damage":13}'::JSONB
WHERE name IN ('月牙撕裂', '破绽识破');

UPDATE card_templates
SET effect_json = '{"damage":9}'::JSONB
WHERE name IN ('精明投掷', '引路箭');

INSERT INTO card_templates (
    name, type, cost, rarity, source_spirit_id, effect_json, upgrade_json
)
VALUES (
    '战术打击', 'attack', 1, 'common', NULL,
    '{"damage":8}'::JSONB,
    '{}'::JSONB
)
ON CONFLICT (name) DO UPDATE SET
    type = EXCLUDED.type,
    cost = EXCLUDED.cost,
    rarity = EXCLUDED.rarity,
    source_spirit_id = EXCLUDED.source_spirit_id,
    effect_json = EXCLUDED.effect_json,
    upgrade_json = EXCLUDED.upgrade_json;

WITH balance(
    npc_name,
    hp,
    signature_name,
    signature_amount,
    attack_amount,
    guard_amount,
    damage_weight,
    shield_weight
) AS (
    VALUES
        ('训练教官', 52, '破绽识破', 2, 4, 4, 1.00, 0.70),
        ('杂货商', 68, '精明投掷', 2, 3, 5, 0.80, 1.15),
        ('晨曦村村长', 76, '晨曦号令', 3, 3, 4, 1.00, 1.00),
        ('森林向导', 74, '引路箭', 2, 3, 5, 0.75, 1.20),
        ('铁匠少女苏娜', 60, '炽热锻击', 4, 4, 2, 1.25, 0.55),
        ('狼娘·露娜', 72, '月牙撕裂', 3, 4, 3, 1.15, 0.70)
), configured AS (
    SELECT
        balance.npc_name,
        balance.hp,
        balance.damage_weight,
        balance.shield_weight,
        jsonb_build_array(
            jsonb_build_object(
                'card_template_id', (
                    SELECT id FROM card_templates WHERE name = balance.signature_name
                ),
                'amount', balance.signature_amount
            ),
            jsonb_build_object(
                'card_template_id', (
                    SELECT id FROM card_templates WHERE name = '战术打击'
                ),
                'amount', balance.attack_amount
            ),
            jsonb_build_object(
                'card_template_id', (
                    SELECT id FROM card_templates WHERE name = '防御姿态'
                ),
                'amount', balance.guard_amount
            )
        ) AS cards
    FROM balance
)
UPDATE npc_templates
SET battle_deck = COALESCE(npc_templates.battle_deck, '{}'::JSONB) || jsonb_build_object(
    'hp', configured.hp,
    'energy', 3,
    'hand_size', 5,
    'cards', configured.cards,
    'action_weights', jsonb_build_object(
        'damage', configured.damage_weight,
        'shield', configured.shield_weight
    )
)
FROM configured
WHERE npc_templates.name = configured.npc_name;

WITH eligible_decks AS (
    SELECT deck.id, deck.player_id
    FROM decks AS deck
    JOIN deck_cards AS item ON item.deck_id = deck.id
    JOIN player_cards AS card ON card.id = item.card_id
    JOIN card_templates AS template ON template.id = card.card_template_id
    WHERE deck.name = '初始套牌'
    GROUP BY deck.id, deck.player_id
    HAVING SUM(item.amount) <= 4
       AND BOOL_AND(template.name IN ('基础攻击', '月牙撕裂'))
), desired(template_name, amount) AS (
    VALUES
        ('基础攻击', 6),
        ('防御姿态', 4),
        ('月牙撕裂', 2)
)
INSERT INTO player_cards (player_id, card_template_id, level, count)
SELECT
    eligible.player_id,
    template.id,
    1,
    desired.amount
FROM eligible_decks AS eligible
CROSS JOIN desired
JOIN card_templates AS template ON template.name = desired.template_name
ON CONFLICT (player_id, card_template_id, level) DO UPDATE SET
    count = GREATEST(player_cards.count, EXCLUDED.count);

WITH eligible_decks AS (
    SELECT deck.id, deck.player_id
    FROM decks AS deck
    JOIN deck_cards AS item ON item.deck_id = deck.id
    JOIN player_cards AS card ON card.id = item.card_id
    JOIN card_templates AS template ON template.id = card.card_template_id
    WHERE deck.name = '初始套牌'
    GROUP BY deck.id, deck.player_id
    HAVING SUM(item.amount) <= 4
       AND BOOL_AND(template.name IN ('基础攻击', '月牙撕裂'))
), desired(template_name, amount) AS (
    VALUES
        ('基础攻击', 6),
        ('防御姿态', 4),
        ('月牙撕裂', 2)
)
INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
SELECT
    eligible.id,
    card.id,
    eligible.player_id,
    desired.amount
FROM eligible_decks AS eligible
CROSS JOIN desired
JOIN card_templates AS template ON template.name = desired.template_name
JOIN player_cards AS card
    ON card.player_id = eligible.player_id
   AND card.card_template_id = template.id
   AND card.level = 1
ON CONFLICT (deck_id, card_id) DO UPDATE SET
    amount = EXCLUDED.amount;

COMMIT;
