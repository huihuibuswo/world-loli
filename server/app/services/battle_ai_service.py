import json
import logging
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.schemas import AiBattleOutput
from app.services.ai_client import AiProviderError, get_ai_client


logger = logging.getLogger(__name__)


def choose_enemy_action(context: dict[str, Any]) -> dict[str, str | None]:
    candidates = context.get("candidates")
    candidate_rows = candidates if isinstance(candidates, list) else []
    valid_ids = {
        str(candidate.get("id"))
        for candidate in candidate_rows
        if isinstance(candidate, dict) and candidate.get("id")
    }
    default_action = "basic_attack"
    if default_action not in valid_ids and valid_ids:
        default_action = sorted(valid_ids)[0]

    enabled = (
        settings.ai_enabled
        and settings.ai_battle_enabled
        and settings.ai_configured
        and bool(context.get("battle_enabled"))
        and len(valid_ids) > 1
    )
    if enabled:
        state = context.get("state") if isinstance(context.get("state"), dict) else {}
        player_state = state.get("player_state") if isinstance(state.get("player_state"), dict) else {}
        enemy_state = state.get("enemy_state") if isinstance(state.get("enemy_state"), dict) else {}
        system = (
            f"你正在为回合制卡牌游戏中的敌方「{context.get('enemy_name', '对手')}」选择行动。"
            f"战斗风格：{context.get('battle_style', '稳妥行动')}。"
            "只能从候选 action_id 中选择，不得创建动作、伤害、生命、奖励或其他数值。"
            "只返回 JSON："
            '{"action_id":"候选ID","battle_line":"不超过80字的可选角色台词"}。'
        )
        user = {
            "turn": state.get("current_turn"),
            "player_hp": player_state.get("hp"),
            "player_max_hp": player_state.get("max_hp"),
            "enemy_hp": enemy_state.get("hp"),
            "enemy_max_hp": enemy_state.get("max_hp"),
            "enemy_shield": enemy_state.get("shield", 0),
            "candidates": candidate_rows,
        }
        try:
            completion = get_ai_client().complete_json(
                [
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                ],
                timeout_seconds=settings.ai_battle_timeout_seconds,
                temperature=0.3,
            )
            parsed = AiBattleOutput.model_validate(completion.data)
            if parsed.action_id not in valid_ids:
                raise AiProviderError("AI 选择了非法战斗动作")
            battle_line = parsed.battle_line.strip()[:80] if parsed.battle_line else None
            logger.info(
                "ai_battle_success enemy_id=%s action_id=%s prompt_tokens=%s completion_tokens=%s",
                context.get("enemy_id"),
                parsed.action_id,
                completion.prompt_tokens,
                completion.completion_tokens,
            )
            return {"action_id": parsed.action_id, "battle_line": battle_line}
        except (AiProviderError, ValidationError) as exc:
            logger.warning(
                "ai_battle_fallback enemy_id=%s reason=%s",
                context.get("enemy_id"),
                type(exc).__name__,
            )

    return {"action_id": default_action, "battle_line": None}
