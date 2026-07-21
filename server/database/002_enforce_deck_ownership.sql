BEGIN;

ALTER TABLE deck_cards
    ADD COLUMN IF NOT EXISTS player_id BIGINT;

UPDATE deck_cards AS dc
SET player_id = d.player_id
FROM decks AS d
WHERE dc.deck_id = d.id
  AND dc.player_id IS NULL;

ALTER TABLE deck_cards
    ALTER COLUMN player_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_decks_id_player_id
    ON decks (id, player_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_cards_id_player_id
    ON player_cards (id, player_id);

ALTER TABLE deck_cards
    DROP CONSTRAINT IF EXISTS deck_cards_deck_id_fkey,
    DROP CONSTRAINT IF EXISTS deck_cards_card_id_fkey,
    DROP CONSTRAINT IF EXISTS deck_cards_deck_owner_fk,
    DROP CONSTRAINT IF EXISTS deck_cards_card_owner_fk;

ALTER TABLE deck_cards
    ADD CONSTRAINT deck_cards_deck_owner_fk
        FOREIGN KEY (deck_id, player_id)
        REFERENCES decks (id, player_id)
        ON DELETE CASCADE,
    ADD CONSTRAINT deck_cards_card_owner_fk
        FOREIGN KEY (card_id, player_id)
        REFERENCES player_cards (id, player_id)
        ON DELETE CASCADE;

COMMIT;
