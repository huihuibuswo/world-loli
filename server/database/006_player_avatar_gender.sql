BEGIN;

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS avatar_gender VARCHAR(8) NOT NULL DEFAULT 'female';

ALTER TABLE players
    DROP CONSTRAINT IF EXISTS players_avatar_gender_check;

ALTER TABLE players
    ADD CONSTRAINT players_avatar_gender_check
    CHECK (avatar_gender IN ('female', 'male'));

COMMIT;
