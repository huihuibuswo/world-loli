BEGIN;

UPDATE card_templates
SET effect_json = '{"shield":5}'::JSONB
WHERE name = '防御姿态';

COMMIT;
