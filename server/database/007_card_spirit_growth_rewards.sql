BEGIN;

UPDATE npc_templates
SET reward = jsonb_set(reward, '{spirit_exp}', '60'::JSONB, TRUE)
WHERE name = '训练木偶';

COMMIT;
