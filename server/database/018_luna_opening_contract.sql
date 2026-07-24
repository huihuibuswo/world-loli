BEGIN;

CREATE TEMP TABLE legacy_starter_decks ON COMMIT DROP AS
SELECT deck.id AS deck_id, deck.player_id
FROM decks AS deck
JOIN deck_cards AS item ON item.deck_id = deck.id
JOIN player_cards AS card ON card.id = item.card_id
JOIN card_templates AS template ON template.id = card.card_template_id
WHERE deck.name = '初始套牌'
GROUP BY deck.id, deck.player_id
HAVING SUM(item.amount) = 12
   AND COUNT(*) = 3
   AND BOOL_AND(template.name IN ('基础攻击', '防御姿态', '月牙撕裂'))
   AND SUM(item.amount) FILTER (WHERE template.name = '基础攻击') = 6
   AND SUM(item.amount) FILTER (WHERE template.name = '防御姿态') = 4
   AND SUM(item.amount) FILTER (WHERE template.name = '月牙撕裂') = 2;

INSERT INTO player_cards (player_id, card_template_id, level, count)
SELECT
    legacy.player_id,
    template.id,
    1,
    6
FROM legacy_starter_decks AS legacy
JOIN card_templates AS template ON template.name = '防御姿态'
ON CONFLICT (player_id, card_template_id, level) DO UPDATE SET
    count = GREATEST(player_cards.count, EXCLUDED.count);

INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
SELECT
    legacy.deck_id,
    card.id,
    legacy.player_id,
    6
FROM legacy_starter_decks AS legacy
JOIN card_templates AS template ON template.name = '防御姿态'
JOIN player_cards AS card
    ON card.player_id = legacy.player_id
   AND card.card_template_id = template.id
   AND card.level = 1
ON CONFLICT (deck_id, card_id) DO UPDATE SET
    amount = EXCLUDED.amount;

DELETE FROM deck_cards AS item
USING legacy_starter_decks AS legacy, player_cards AS card, card_templates AS template
WHERE item.deck_id = legacy.deck_id
  AND item.card_id = card.id
  AND card.player_id = legacy.player_id
  AND card.card_template_id = template.id
  AND template.name = '月牙撕裂';

WITH eligible AS (
    SELECT progress.player_id
    FROM player_story_progress AS progress
    JOIN decks AS deck
      ON deck.player_id = progress.player_id
     AND deck.is_active = TRUE
    WHERE progress.story_key = 'opening_moon_scar'
      AND progress.stage IN ('return_village', 'complete')
)
INSERT INTO player_card_spirits (player_id, spirit_template_id)
SELECT eligible.player_id, template.id
FROM eligible
CROSS JOIN card_spirit_templates AS template
WHERE template.name = '狼娘·露娜'
ON CONFLICT (player_id, spirit_template_id) DO NOTHING;

WITH eligible AS (
    SELECT progress.player_id
    FROM player_story_progress AS progress
    JOIN decks AS deck
      ON deck.player_id = progress.player_id
     AND deck.is_active = TRUE
    WHERE progress.story_key = 'opening_moon_scar'
      AND progress.stage IN ('return_village', 'complete')
)
INSERT INTO player_cards (player_id, card_template_id, level, count)
SELECT eligible.player_id, template.id, 1, 2
FROM eligible
CROSS JOIN card_templates AS template
WHERE template.name = '月牙撕裂'
ON CONFLICT (player_id, card_template_id, level) DO UPDATE SET
    count = GREATEST(player_cards.count, EXCLUDED.count);

WITH eligible AS (
    SELECT progress.player_id, deck.id AS deck_id
    FROM player_story_progress AS progress
    JOIN decks AS deck
      ON deck.player_id = progress.player_id
     AND deck.is_active = TRUE
    WHERE progress.story_key = 'opening_moon_scar'
      AND progress.stage IN ('return_village', 'complete')
)
INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
SELECT eligible.deck_id, card.id, eligible.player_id, 2
FROM eligible
JOIN card_templates AS template ON template.name = '月牙撕裂'
JOIN player_cards AS card
    ON card.player_id = eligible.player_id
   AND card.card_template_id = template.id
   AND card.level = 1
ON CONFLICT (deck_id, card_id) DO UPDATE SET
    amount = GREATEST(deck_cards.amount, EXCLUDED.amount);

UPDATE player_story_progress AS progress
SET data_json = COALESCE(progress.data_json, '{}'::JSONB) || jsonb_build_object(
    'luna_battle_completed', TRUE,
    'luna_contract_completed', TRUE,
    'luna_contract_version', 1
)
WHERE progress.story_key = 'opening_moon_scar'
  AND progress.stage IN ('return_village', 'complete')
  AND EXISTS (
      SELECT 1
      FROM player_card_spirits AS spirit
      JOIN card_spirit_templates AS template ON template.id = spirit.spirit_template_id
      WHERE spirit.player_id = progress.player_id
        AND template.name = '狼娘·露娜'
  )
  AND EXISTS (
      SELECT 1
      FROM decks AS deck
      JOIN deck_cards AS item ON item.deck_id = deck.id
      JOIN player_cards AS card ON card.id = item.card_id
      JOIN card_templates AS template ON template.id = card.card_template_id
      WHERE deck.player_id = progress.player_id
        AND deck.is_active = TRUE
        AND template.name = '月牙撕裂'
        AND item.amount >= 2
  );

COMMIT;
