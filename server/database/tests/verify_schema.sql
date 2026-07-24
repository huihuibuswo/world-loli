\set ON_ERROR_STOP on

BEGIN;

INSERT INTO users (username, password_hash)
VALUES
    ('schema_owner_a', 'not-a-real-hash'),
    ('schema_owner_b', 'not-a-real-hash');

INSERT INTO players (user_id, name)
SELECT id, username
FROM users
WHERE username IN ('schema_owner_a', 'schema_owner_b');

INSERT INTO card_templates (name, type, rarity)
VALUES ('schema_ownership_test_card', 'skill', 'common');

INSERT INTO player_cards (player_id, card_template_id)
SELECT p.id, ct.id
FROM players AS p
CROSS JOIN card_templates AS ct
WHERE p.name = 'schema_owner_a'
  AND ct.name = 'schema_ownership_test_card';

INSERT INTO decks (player_id, name)
SELECT id, name || '_deck'
FROM players
WHERE name IN ('schema_owner_a', 'schema_owner_b');

DO $verify$
DECLARE
    owner_a_player_id BIGINT;
    owner_b_player_id BIGINT;
    owner_a_card_id BIGINT;
    owner_a_deck_id BIGINT;
    owner_b_deck_id BIGINT;
BEGIN
    SELECT id INTO owner_a_player_id
    FROM players WHERE name = 'schema_owner_a';

    SELECT id INTO owner_b_player_id
    FROM players WHERE name = 'schema_owner_b';

    SELECT pc.id INTO owner_a_card_id
    FROM player_cards AS pc
    WHERE pc.player_id = owner_a_player_id;

    SELECT id INTO owner_a_deck_id
    FROM decks WHERE player_id = owner_a_player_id;

    SELECT id INTO owner_b_deck_id
    FROM decks WHERE player_id = owner_b_player_id;

    INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
    VALUES (owner_a_deck_id, owner_a_card_id, owner_a_player_id, 1);

    BEGIN
        INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
        VALUES (owner_b_deck_id, owner_a_card_id, owner_b_player_id, 1);
        RAISE EXCEPTION 'cross-player card insertion was unexpectedly accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'cross-player card insertion correctly rejected';
    END;
END
$verify$;

DO $verify_ai$
DECLARE
    owner_a_player_id BIGINT;
    owner_a_npc_id BIGINT;
BEGIN
    SELECT id INTO owner_a_player_id
    FROM players WHERE name = 'schema_owner_a';

    SELECT id INTO owner_a_npc_id
    FROM npc_templates ORDER BY id LIMIT 1;

    INSERT INTO npc_ai_conversations (player_id, npc_id, recent_turns)
    VALUES (
        owner_a_player_id,
        owner_a_npc_id,
        '[{"request_id":"schema-test","player":"你好","npc":"你好"}]'::JSONB
    );

    BEGIN
        INSERT INTO npc_ai_conversations (player_id, npc_id)
        VALUES (owner_a_player_id, owner_a_npc_id);
        RAISE EXCEPTION 'duplicate player/NPC AI conversation was unexpectedly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'duplicate player/NPC AI conversation correctly rejected';
    END;
END
$verify_ai$;

DO $verify_npc_affection$
DECLARE
    owner_a_player_id BIGINT;
    owner_a_npc_id BIGINT;
    owner_a_card_id BIGINT;
    owner_a_plant_id BIGINT;
BEGIN
    SELECT id INTO owner_a_player_id
    FROM players WHERE name = 'schema_owner_a';

    SELECT id, (reward->>'first_victory_card_template_id')::BIGINT
    INTO owner_a_npc_id, owner_a_card_id
    FROM npc_templates
    WHERE reward ? 'first_victory_card_template_id'
    ORDER BY id
    LIMIT 1;

    SELECT id INTO owner_a_plant_id
    FROM plant_templates ORDER BY id LIMIT 1;

    INSERT INTO player_npc_affection (player_id, npc_id, points)
    VALUES (owner_a_player_id, owner_a_npc_id, 1);

    INSERT INTO player_npc_affection_rewards (
        player_id, npc_id, milestone_level, reward_type, card_template_id
    )
    VALUES (owner_a_player_id, owner_a_npc_id, 1, 'card', owner_a_card_id);

    BEGIN
        INSERT INTO player_npc_affection_rewards (
            player_id, npc_id, milestone_level, reward_type, card_template_id
        )
        VALUES (owner_a_player_id, owner_a_npc_id, 1, 'card', owner_a_card_id);
        RAISE EXCEPTION 'duplicate NPC affection milestone was unexpectedly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'duplicate NPC affection milestone correctly rejected';
    END;

    INSERT INTO npc_gift_records (
        player_id, npc_id, plant_template_id, preference, affection_gained
    )
    VALUES (owner_a_player_id, owner_a_npc_id, owner_a_plant_id, 'liked', 2);
END
$verify_npc_affection$;

DO $verify_spirit_fragments$
DECLARE
    owner_a_player_id BIGINT;
    owner_a_spirit_template_id BIGINT;
BEGIN
    SELECT id INTO owner_a_player_id
    FROM players WHERE name = 'schema_owner_a';

    SELECT id INTO owner_a_spirit_template_id
    FROM card_spirit_templates ORDER BY id LIMIT 1;

    INSERT INTO player_card_spirit_fragments (player_id, spirit_template_id, amount)
    VALUES (owner_a_player_id, owner_a_spirit_template_id, 29);

    BEGIN
        INSERT INTO player_card_spirit_fragments (player_id, spirit_template_id, amount)
        VALUES (owner_a_player_id, owner_a_spirit_template_id, 1);
        RAISE EXCEPTION 'duplicate player/spirit fragment progress was unexpectedly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'duplicate player/spirit fragment progress correctly rejected';
    END;

    BEGIN
        INSERT INTO player_card_spirit_fragments (player_id, spirit_template_id, amount)
        VALUES (owner_a_player_id, owner_a_spirit_template_id, -1);
        RAISE EXCEPTION 'negative spirit fragment amount was unexpectedly accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'negative spirit fragment amount correctly rejected';
    END;

    IF EXISTS (
        SELECT 1
        FROM npc_templates
        WHERE name IN ('晨曦村村长', '杂货商', '铁匠少女苏娜', '森林向导', '训练教官')
          AND jsonb_array_length(COALESCE(battle_deck->'cards', '[]'::JSONB)) < 1
    ) THEN
        RAISE EXCEPTION 'one or more battle NPC decks are missing cards';
    END IF;
END
$verify_spirit_fragments$;

DO $verify_opening_story$
DECLARE
    owner_a_player_id BIGINT;
BEGIN
    SELECT id INTO owner_a_player_id
    FROM players WHERE name = 'schema_owner_a';

    INSERT INTO player_story_progress (player_id, story_key, stage)
    VALUES (owner_a_player_id, 'opening_moon_scar', 'prepare');

    BEGIN
        INSERT INTO player_story_progress (player_id, story_key, stage)
        VALUES (owner_a_player_id, 'opening_moon_scar', 'prepare');
        RAISE EXCEPTION 'duplicate player/story progress was unexpectedly accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'duplicate player/story progress correctly rejected';
    END;

    BEGIN
        INSERT INTO player_story_progress (player_id, story_key, stage)
        VALUES (owner_a_player_id, 'invalid_story', 'invalid_stage');
        RAISE EXCEPTION 'invalid story stage was unexpectedly accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'invalid story stage correctly rejected';
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM npc_templates
        WHERE name = '狼娘·露娜'
          AND battle_deck->>'monster_rank' = 'boss'
          AND reward->>'story_gate' = 'opening_moon_scar'
    ) THEN
        RAISE EXCEPTION 'opening Luna boss configuration is missing';
    END IF;
END
$verify_opening_story$;

DO $verify_battle_balance$
DECLARE
    hp_default TEXT;
BEGIN
    SELECT column_default INTO hp_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'hp';

    IF hp_default IS NULL OR hp_default NOT LIKE '%75%' THEN
        RAISE EXCEPTION 'player hp default is not balanced to 75: %', hp_default;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM card_templates
        WHERE name = '基础攻击'
          AND cost = 1
          AND effect_json = '{"damage":6}'::JSONB
    ) THEN
        RAISE EXCEPTION 'balanced basic attack configuration is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM card_templates
        WHERE name = '防御姿态'
          AND cost = 1
          AND effect_json = '{"shield":8}'::JSONB
    ) THEN
        RAISE EXCEPTION 'balanced guard configuration is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM card_templates
        WHERE name = '战术打击'
          AND cost = 1
          AND effect_json = '{"damage":8}'::JSONB
    ) THEN
        RAISE EXCEPTION 'enemy tactical strike configuration is missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM npc_templates
        WHERE name IN (
            '训练教官',
            '杂货商',
            '晨曦村村长',
            '森林向导',
            '铁匠少女苏娜',
            '狼娘·露娜'
        )
          AND (
              jsonb_array_length(COALESCE(battle_deck->'cards', '[]'::JSONB)) <> 3
              OR (
                  SELECT COALESCE(SUM((card->>'amount')::INTEGER), 0)
                  FROM jsonb_array_elements(COALESCE(battle_deck->'cards', '[]'::JSONB)) AS card
              ) <> 10
              OR NOT battle_deck ? 'action_weights'
          )
    ) THEN
        RAISE EXCEPTION 'one or more balanced battle actors have invalid decks or weights';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM npc_templates
        WHERE name = '铁匠少女苏娜'
          AND (battle_deck->>'hp')::INTEGER = 60
    ) THEN
        RAISE EXCEPTION 'Suna high-pressure battle hp is not calibrated to 60';
    END IF;
END
$verify_battle_balance$;

ROLLBACK;

SELECT COUNT(*) AS public_table_count
FROM pg_tables
WHERE schemaname = 'public';

SELECT COUNT(*) AS foreign_key_count
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace;
