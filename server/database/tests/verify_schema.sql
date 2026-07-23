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

ROLLBACK;

SELECT COUNT(*) AS public_table_count
FROM pg_tables
WHERE schemaname = 'public';

SELECT COUNT(*) AS foreign_key_count
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace;
