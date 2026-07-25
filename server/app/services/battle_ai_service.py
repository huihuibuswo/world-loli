from collections import Counter
import json
import logging
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.schemas import AiBattleOutput
from app.services.ai_client import AiProviderError, get_ai_client


logger = logging.getLogger(__name__)


def _valid_sequence(sequence: list[int], candidates: list[dict[str, Any]], energy: int) -> bool:
    counts = Counter(
        {
            int(candidate["card_template_id"]): int(candidate.get("available_copies", 0))
            for candidate in candidates
            if isinstance(candidate, dict)
            and isinstance(candidate.get("card_template_id"), int)
            and isinstance(candidate.get("cost"), int)
        }
    )
    costs = {
        int(candidate["card_template_id"]): int(candidate["cost"])
        for candidate in candidates
        if isinstance(candidate, dict)
        and isinstance(candidate.get("card_template_id"), int)
        and isinstance(candidate.get("cost"), int)
    }
    remaining_energy = energy
    for template_id in sequence:
        if counts[template_id] <= 0 or costs.get(template_id, remaining_energy + 1) > remaining_energy:
            return False
        counts[template_id] -= 1
        remaining_energy -= costs[template_id]
    return not any(
        count > 0 and costs[template_id] <= remaining_energy
        for template_id, count in counts.items()
    )


def _starts_with_needless_defense(
    sequence: list[int],
    candidates: list[dict[str, Any]],
    fallback: list[int],
) -> bool:
    if not sequence or not fallback:
        return False
    by_id = {
        candidate["card_template_id"]: candidate
        for candidate in candidates
        if isinstance(candidate, dict)
        and isinstance(candidate.get("card_template_id"), int)
    }
    selected = by_id.get(sequence[0], {})
    baseline = by_id.get(fallback[0], {})

    def effect_value(candidate: dict[str, Any], key: str) -> int:
        try:
            return max(0, int(candidate.get(key, 0)))
        except (TypeError, ValueError):
            return 0

    selected_damage = effect_value(selected, "damage")
    selected_shield = effect_value(selected, "shield")
    baseline_damage = effect_value(baseline, "damage")
    return selected_damage == 0 and selected_shield > 0 and baseline_damage > 0


def choose_enemy_cards(context: dict[str, Any]) -> dict[str, Any]:
    candidates = context.get("candidates")
    candidate_rows = candidates if isinstance(candidates, list) else []
    fallback = context.get("fallback_card_template_ids")
    fallback_ids = [int(value) for value in fallback] if isinstance(fallback, list) else []
    state = context.get("state") if isinstance(context.get("state"), dict) else {}
    enemy_energy = int(state.get("enemy_energy", 0))

    enabled = (
        settings.ai_enabled
        and settings.ai_battle_enabled
        and settings.ai_configured
        and bool(context.get("battle_enabled"))
        and bool(candidate_rows)
    )
    if enabled:
        player_state = state.get("player_state") if isinstance(state.get("player_state"), dict) else {}
        enemy_state = state.get("enemy_state") if isinstance(state.get("enemy_state"), dict) else {}
        system = (
            f"你正在为回合制卡牌游戏中的敌方「{context.get('enemy_name', '对手')}」选择出牌顺序。"
            f"战斗风格：{context.get('battle_style', '稳妥行动')}。"
            "只能从候选 card_template_id 中选择，允许同一卡牌按 available_copies 重复出现。"
            "必须连续出牌，直到能量耗尽或剩余卡牌都无法支付。"
            "必须依据候选中的实际 damage、shield、cost 数值判断，不能只看名称、类型或标签。"
            "敌方生命较高或已有护盾时，优先造成有效伤害。"
            "仅当敌方生命较低且现有护盾不足时，才提高防御优先级，不得机械地见到防御牌就先选。"
            "若为耗尽能量必须打出多张纯防御牌，也应避免把它们排在更有效的攻击之前。"
            "不得创建卡牌、效果、目标、伤害、生命、能量、奖励或其他数值。"
            "只返回 JSON："
            '{"card_template_ids":[1,2],"battle_line":"不超过80字的可选角色台词"}。'
        )
        user = {
            "turn": state.get("current_turn"),
            "player_hp": player_state.get("hp"),
            "player_max_hp": player_state.get("max_hp"),
            "player_shield": player_state.get("shield", 0),
            "enemy_hp": enemy_state.get("hp"),
            "enemy_max_hp": enemy_state.get("max_hp"),
            "enemy_shield": enemy_state.get("shield", 0),
            "enemy_energy": enemy_energy,
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
            if not _valid_sequence(parsed.card_template_ids, candidate_rows, enemy_energy):
                raise AiProviderError("AI 返回了非法或未完成的敌方出牌序列")
            if _starts_with_needless_defense(
                parsed.card_template_ids,
                candidate_rows,
                fallback_ids,
            ):
                raise AiProviderError("AI 在确定性策略应攻击时无效地优先防御")
            battle_line = parsed.battle_line.strip()[:80] if parsed.battle_line else None
            logger.info(
                "ai_battle_success enemy_id=%s card_count=%s prompt_tokens=%s completion_tokens=%s",
                context.get("enemy_id"),
                len(parsed.card_template_ids),
                completion.prompt_tokens,
                completion.completion_tokens,
            )
            return {
                "card_template_ids": parsed.card_template_ids,
                "battle_line": battle_line,
            }
        except (AiProviderError, ValidationError) as exc:
            logger.warning(
                "ai_battle_fallback enemy_id=%s reason=%s",
                context.get("enemy_id"),
                type(exc).__name__,
            )

    return {"card_template_ids": fallback_ids, "battle_line": None}
