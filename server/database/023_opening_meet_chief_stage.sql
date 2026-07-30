BEGIN;

ALTER TABLE player_story_progress
    DROP CONSTRAINT IF EXISTS ck_player_story_progress_stage;

ALTER TABLE player_story_progress
    ADD CONSTRAINT ck_player_story_progress_stage CHECK (
        stage IN (
            'arrival',
            'meet_chief',
            'prepare',
            'forest_signal',
            'return_village',
            'complete'
        )
    );

COMMIT;
