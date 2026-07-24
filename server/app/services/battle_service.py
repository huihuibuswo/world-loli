from collections import Counter
from copy import deepcopy
from hashlib import sha256
from math import isfinite
from random import Random
from secrets import randbits
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    ActiveBattle,
    BattleRecord,
    CardTemplate,
    Deck,
    DeckCard,
    NpcTemplate,
    Player,
    PlayerCard,
    PlayerCardSpirit,
)
from app.services.ai_profile import get_npc_ai_profile
from app.services.card_spirit_service import grant_monster_fragments
from app.services.npc_affection_service import apply_affection
from app.services.opening_story_service import (
    mark_opening_battle_complete,
    validate_story_battle,
)
from app.services.quest_progress_service import record_quest_objective


MAX_EFFECT_VALUE = 1_000_000
MAX_ENEMY_DECK_SIZE = 60
DEFEAT_GOLD_PENALTY = 30
SUPPORTED_EFFECTS = {"damage", "shield"}


def battle_data(battle: ActiveBattle) -> dict[str, Any]:
    state = deepcopy(battle.state_json)
    enemy_hand = state.pop("enemy_hand_cards", [])
    enemy_draw = state.pop("enemy_draw_pile", [])
    enemy_discard = state.pop("enemy_discard_cards", [])
    state.pop("battle_seed", None)
    state.pop("player_shuffle_count", None)
    state.pop("enemy_shuffle_count", None)
    state["enemy_hand_count"] = len(enemy_hand) if isinstance(enemy_hand, list) else 0
    state["enemy_draw_count"] = len(enemy_draw) if isinstance(enemy_draw, list) else 0
    state["enemy_discard_count"] = len(enemy_discard) if isinstance(enemy_discard, list) else 0
    return {
        "battle_id": battle.id,
        "enemy_id": battle.enemy_id,
        "status": battle.status,
        "version": battle.version,
        **state,
    }


def _bounded_int(value: Any, *, minimum: int = 0, maximum: int = MAX_EFFECT_VALUE) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return minimum
    return max(minimum, min(parsed, maximum))


def _bounded_weight(value: Any, default: float = 1.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if not isfinite(parsed):
        return default
    return max(0.0, min(parsed, 10.0))


def _validated_enemy_deck(
    db: Session,
    enemy: NpcTemplate,
) -> tuple[dict[str, Any], list[int], dict[int, CardTemplate]]:
    config = enemy.battle_deck or {}
    rows = config.get("cards")
    if not isinstance(rows, list) or not rows:
        abort(500, f"{enemy.name} 的敌方卡组未配置")

    expanded: list[int] = []
    for row in rows:
        if not isinstance(row, dict):
            abort(500, f"{enemy.name} 的敌方卡组格式无效")
        template_id = row.get("card_template_id")
        amount = row.get("amount")
        if (
            isinstance(template_id, bool)
            or not isinstance(template_id, int)
            or template_id <= 0
            or isinstance(amount, bool)
            or not isinstance(amount, int)
            or amount <= 0
            or amount > 20
        ):
            abort(500, f"{enemy.name} 的敌方卡组数量或卡牌引用无效")
        expanded.extend([template_id] * amount)
    if len(expanded) > MAX_ENEMY_DECK_SIZE:
        abort(500, f"{enemy.name} 的敌方卡组超过 {MAX_ENEMY_DECK_SIZE} 张上限")

    templates = {
        template.id: template
        for template in db.scalars(
            select(CardTemplate).where(CardTemplate.id.in_(set(expanded)))
        ).all()
    }
    if set(templates) != set(expanded):
        abort(500, f"{enemy.name} 的敌方卡组引用了不存在的卡牌")
    if not any(template.source_spirit_id for template in templates.values()):
        abort(500, f"{enemy.name} 的敌方卡组缺少角色签名卡")
    for template in templates.values():
        effect = template.effect_json or {}
        if not isinstance(effect, dict) or not effect or set(effect) - SUPPORTED_EFFECTS:
            abort(500, f"{enemy.name} 的卡牌「{template.name}」包含未支持的效果")
        if not any(_bounded_int(effect.get(key)) > 0 for key in SUPPORTED_EFFECTS):
            abort(500, f"{enemy.name} 的卡牌「{template.name}」没有可执行效果")
        if template.cost < 0 or template.cost > MAX_EFFECT_VALUE:
            abort(500, f"{enemy.name} 的卡牌「{template.name}」费用无效")
    return config, expanded, templates


def _shuffle_pile(state: dict[str, Any], pile_key: str, side: str) -> None:
    seed = state.get("battle_seed")
    pile = state[pile_key]
    if isinstance(seed, bool) or not isinstance(seed, int) or not isinstance(pile, list):
        return
    counter_key = f"{side}_shuffle_count"
    shuffle_count = _bounded_int(state.get(counter_key, 0), maximum=MAX_EFFECT_VALUE)
    derived_seed = int.from_bytes(
        sha256(f"{seed}:{side}:{shuffle_count}".encode("ascii")).digest()[:8],
        "big",
    )
    Random(derived_seed).shuffle(pile)
    state[counter_key] = shuffle_count + 1


def _draw_to_hand(state: dict[str, Any], size: int = 5) -> None:
    hand = state["hand_cards"]
    draw = state["draw_pile"]
    discard = state["discard_cards"]
    while len(hand) < size:
        if not draw:
            if not discard:
                break
            draw.extend(discard)
            discard.clear()
            _shuffle_pile(state, "draw_pile", "player")
        hand.append(draw.pop(0))


def _draw_enemy_to_hand(state: dict[str, Any]) -> None:
    hand = state["enemy_hand_cards"]
    draw = state["enemy_draw_pile"]
    discard = state["enemy_discard_cards"]
    hand_size = _bounded_int(state.get("enemy_hand_size", 5), minimum=1, maximum=20)
    while len(hand) < hand_size:
        if not draw:
            if not discard:
                break
            draw.extend(discard)
            discard.clear()
            _shuffle_pile(state, "enemy_draw_pile", "enemy")
        hand.append(draw.pop(0))


def _ensure_enemy_deck_state(
    db: Session,
    enemy: NpcTemplate,
    state: dict[str, Any],
) -> dict[int, CardTemplate]:
    config, expanded, templates = _validated_enemy_deck(db, enemy)
    runtime_keys = ("enemy_hand_cards", "enemy_draw_pile", "enemy_discard_cards")
    if not all(isinstance(state.get(key), list) for key in runtime_keys):
        state["enemy_hand_cards"] = []
        state["enemy_draw_pile"] = list(expanded)
        state["enemy_discard_cards"] = []
    else:
        runtime_cards = [card_id for key in runtime_keys for card_id in state[key]]
        if Counter(runtime_cards) != Counter(expanded):
            abort(500, f"{enemy.name} 的敌方卡组运行状态无效")

    state["enemy_max_energy"] = _bounded_int(config.get("energy", 3), minimum=1, maximum=20)
    state["enemy_hand_size"] = _bounded_int(config.get("hand_size", 5), minimum=1, maximum=20)
    state["enemy_energy"] = _bounded_int(
        state.get("enemy_energy", state["enemy_max_energy"]),
        maximum=state["enemy_max_energy"],
    )
    state.setdefault("player_state", {}).setdefault("shield", 0)
    state.setdefault("enemy_state", {}).setdefault("shield", 0)
    _draw_enemy_to_hand(state)
    return templates


def _damage_with_affection(damage: int, affection: int) -> int:
    if affection <= 0 or damage <= 0:
        return damage
    if affection <= 20:
        percent = 5
    elif affection <= 50:
        percent = 10
    elif affection <= 80:
        percent = 20
    else:
        percent = 30
    return damage + max(1, damage * percent // 100)


def _apply_card_effect(
    state: dict[str, Any],
    template: CardTemplate,
    *,
    actor: str,
    damage: int | None = None,
    shield: int | None = None,
    player_defense: int = 0,
) -> dict[str, int]:
    effect = template.effect_json or {}
    resolved_damage = _bounded_int(effect.get("damage", 0)) if damage is None else damage
    resolved_shield = _bounded_int(effect.get("shield", 0)) if shield is None else shield
    source = state["player_state"] if actor == "player" else state["enemy_state"]
    target = state["enemy_state"] if actor == "player" else state["player_state"]
    if actor == "enemy" and resolved_damage > 0:
        resolved_damage = max(1, resolved_damage - max(0, player_defense) // 2)
    target_shield = _bounded_int(target.get("shield", 0))
    blocked = min(target_shield, resolved_damage)
    dealt = resolved_damage - blocked
    target["shield"] = target_shield - blocked
    target["hp"] = max(0, _bounded_int(target.get("hp", 0)) - dealt)
    if resolved_shield > 0:
        source["shield"] = _bounded_int(source.get("shield", 0)) + resolved_shield
    return {"damage": dealt, "blocked": blocked, "shield": resolved_shield}


def create_battle(db: Session, player: Player, enemy_id: int) -> ActiveBattle:
    existing = db.scalar(
        select(ActiveBattle).where(
            ActiveBattle.player_id == player.id, ActiveBattle.status == "active"
        )
    )
    if existing is not None:
        abort(409, "已有进行中的战斗")

    enemy = db.get(NpcTemplate, enemy_id)
    if enemy is None:
        abort(404, "敌人不存在")
    validate_story_battle(db, player, enemy)
    enemy_config, enemy_deck, _ = _validated_enemy_deck(db, enemy)
    active_deck = db.scalar(
        select(Deck).where(Deck.player_id == player.id, Deck.is_active.is_(True))
    )
    if active_deck is None:
        abort(409, "请先设置一副启用套牌")

    deck_rows = db.execute(
        select(DeckCard, PlayerCard, CardTemplate)
        .join(PlayerCard, PlayerCard.id == DeckCard.card_id)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(DeckCard.deck_id == active_deck.id, DeckCard.player_id == player.id)
        .order_by(DeckCard.card_id)
    ).all()
    draw_pile = [card.id for item, card, _ in deck_rows for _ in range(item.amount)]
    if not draw_pile:
        abort(409, "启用套牌中没有卡牌")

    enemy_hp = _bounded_int(enemy_config.get("hp", 30), minimum=1)
    state: dict[str, Any] = {
        "battle_seed": randbits(63),
        "player_shuffle_count": 0,
        "enemy_shuffle_count": 0,
        "current_turn": 1,
        "energy": 3,
        "player_state": {"hp": player.hp, "max_hp": player.hp, "shield": 0},
        "enemy_state": {
            "name": enemy.name,
            "sprite": str((enemy.reward or {}).get("sprite", "npc-trainer")),
            "hp": enemy_hp,
            "max_hp": enemy_hp,
            "shield": 0,
        },
        "hand_cards": [],
        "draw_pile": draw_pile,
        "discard_cards": [],
        "enemy_energy": _bounded_int(enemy_config.get("energy", 3), minimum=1, maximum=20),
        "enemy_max_energy": _bounded_int(
            enemy_config.get("energy", 3), minimum=1, maximum=20
        ),
        "enemy_hand_size": _bounded_int(enemy_config.get("hand_size", 5), minimum=1, maximum=20),
        "enemy_hand_cards": [],
        "enemy_draw_pile": enemy_deck,
        "enemy_discard_cards": [],
        "buffs": [],
        "debuffs": [],
        "spirit_template_ids": sorted(
            {template.source_spirit_id for _, _, template in deck_rows if template.source_spirit_id}
        ),
    }
    _shuffle_pile(state, "draw_pile", "player")
    _shuffle_pile(state, "enemy_draw_pile", "enemy")
    _draw_to_hand(state)
    _draw_enemy_to_hand(state)
    battle = ActiveBattle(player_id=player.id, enemy_id=enemy.id, state_json=state)
    db.add(battle)
    db.commit()
    return battle


def get_owned_battle(
    db: Session, player_id: int, battle_id: int, *, lock: bool = False
) -> ActiveBattle:
    statement = select(ActiveBattle).where(
        ActiveBattle.id == battle_id, ActiveBattle.player_id == player_id
    )
    if lock:
        statement = statement.with_for_update()
    battle = db.scalar(statement)
    if battle is None:
        abort(404, "战斗不存在")
    return battle


def _check_active_version(battle: ActiveBattle, expected_version: int) -> None:
    if battle.status != "active":
        abort(409, "战斗已经结束")
    if battle.version != expected_version:
        abort(409, "战斗状态已更新，请刷新后重试")


def _complete_battle(
    db: Session,
    battle: ActiveBattle,
    player: Player,
    result: str,
    *,
    defeat_reason: str | None = None,
) -> None:
    enemy = db.get(NpcTemplate, battle.enemy_id)
    reward: dict[str, Any] = {}
    penalty: dict[str, Any] | None = None
    is_monster = enemy is not None and (enemy.battle_deck or {}).get("monster_rank") is not None
    affection_result = (
        apply_affection(db, player.id, enemy, "battle")
        if result == "victory" and enemy is not None and not is_monster
        else None
    )
    if affection_result is not None:
        first_card = next(
            (
                item
                for item in affection_result["rewards"]
                if item["type"] == "card" and item["milestone_level"] == 1
            ),
            None,
        )
        if first_card is not None:
            reward = {
                "first_battle": True,
                "card": {
                    "template_id": first_card["template_id"],
                    "name": first_card["name"],
                    "count": first_card["count"],
                },
            }
            if result == "victory":
                reward["first_victory"] = True
    if result == "victory" and enemy is not None:
        record_quest_objective(
            db,
            player.id,
            "battle_npc",
            target_name_field="npc_name",
            target_name=enemy.name,
        )
        fragment_reward = grant_monster_fragments(db, player.id, enemy)
        if fragment_reward is not None:
            reward["fragment"] = fragment_reward
        opening_reward = mark_opening_battle_complete(db, player.id, enemy, result)
        if opening_reward is not None:
            reward["opening"] = opening_reward
    elif result == "defeat":
        gold_before = max(0, int(player.gold))
        gold_lost = min(gold_before, DEFEAT_GOLD_PENALTY)
        player.gold = gold_before - gold_lost
        penalty = {
            "gold_lost": gold_lost,
            "gold_remaining": player.gold,
        }

    battle.status = result
    state = deepcopy(battle.state_json)
    state["result"] = result
    state["reward"] = reward
    state["penalty"] = penalty
    state["defeat_reason"] = defeat_reason if result == "defeat" else None
    state["affection_result"] = affection_result
    battle.state_json = state
    record_settlement = reward if penalty is None else {"penalty": penalty}
    db.add(
        BattleRecord(
            player_id=player.id,
            enemy_id=battle.enemy_id,
            result=result,
            turn_count=int(state["current_turn"]),
            reward_json=record_settlement,
        )
    )


def play_card(
    db: Session,
    player: Player,
    battle_id: int,
    card_id: int,
    expected_version: int,
) -> ActiveBattle:
    battle = get_owned_battle(db, player.id, battle_id, lock=True)
    _check_active_version(battle, expected_version)
    state = deepcopy(battle.state_json)
    if card_id not in state["hand_cards"]:
        abort(409, "该卡牌不在当前手牌中")

    row = db.execute(
        select(PlayerCard, CardTemplate)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(PlayerCard.id == card_id, PlayerCard.player_id == player.id)
    ).one_or_none()
    if row is None:
        abort(404, "卡牌不存在")
    card, template = row
    if state["energy"] < template.cost:
        abort(409, "能量不足")

    effect = template.effect_json or {}
    damage = _bounded_int(effect.get("damage", 0))
    shield = _bounded_int(effect.get("shield", 0))
    damage += (card.level - 1) * _bounded_int(
        (template.upgrade_json or {}).get("damage_per_level", 0), maximum=100_000
    )
    shield += (card.level - 1) * _bounded_int(
        (template.upgrade_json or {}).get("shield_per_level", 0), maximum=100_000
    )
    if template.source_spirit_id:
        spirit = db.scalar(
            select(PlayerCardSpirit).where(
                PlayerCardSpirit.player_id == player.id,
                PlayerCardSpirit.spirit_template_id == template.source_spirit_id,
            )
        )
        if spirit is not None:
            damage = _damage_with_affection(damage, spirit.affection)
    resolved = _apply_card_effect(
        state,
        template,
        actor="player",
        damage=damage,
        shield=shield,
    )
    state["energy"] -= template.cost
    state["hand_cards"].remove(card_id)
    state["discard_cards"].append(card_id)
    state["last_action"] = {
        "type": "play_card",
        "card_id": card_id,
        "card_template_id": template.id,
        "card_name": template.name,
        **resolved,
    }
    battle.state_json = state
    battle.version += 1
    if state["enemy_state"]["hp"] == 0:
        _complete_battle(db, battle, player, "victory")
    db.commit()
    return battle


def _enemy_candidates(
    state: dict[str, Any],
    templates: dict[int, CardTemplate],
) -> list[dict[str, Any]]:
    counts = Counter(state["enemy_hand_cards"])
    energy = state["enemy_energy"]
    candidates = []
    for template_id in sorted(counts):
        template = templates[template_id]
        if template.cost > energy:
            continue
        effect = template.effect_json or {}
        candidates.append(
            {
                "card_template_id": template.id,
                "name": template.name,
                "cost": template.cost,
                "type": template.type,
                "tags": [key for key in ("damage", "shield") if _bounded_int(effect.get(key)) > 0],
                "available_copies": counts[template.id],
            }
        )
    return candidates


def deterministic_enemy_sequence(
    hand_cards: list[int],
    energy: int,
    templates: dict[int, CardTemplate],
    state: dict[str, Any] | None = None,
    action_weights: dict[str, Any] | None = None,
) -> list[int]:
    remaining = list(hand_cards)
    sequence: list[int] = []
    available_energy = energy
    weights = action_weights if isinstance(action_weights, dict) else {}
    damage_weight = _bounded_weight(weights.get("damage"))
    shield_weight = _bounded_weight(weights.get("shield"))
    player_state = (state or {}).get("player_state", {})
    player_effective_hp = _bounded_int(player_state.get("hp", 0)) + _bounded_int(
        player_state.get("shield", 0)
    )
    while True:
        playable = [templates[card_id] for card_id in remaining if templates[card_id].cost <= available_energy]
        if not playable:
            return sequence

        def score(template: CardTemplate) -> tuple[float, int, int]:
            effect = template.effect_json or {}
            damage = _bounded_int(effect.get("damage", 0))
            shield = _bounded_int(effect.get("shield", 0))
            lethal_bonus = 1_000_000 if damage > 0 and damage >= player_effective_hp else 0
            value = lethal_bonus + damage * damage_weight + shield * shield_weight
            return value, template.cost, -template.id

        chosen = max(playable, key=score)
        sequence.append(chosen.id)
        remaining.remove(chosen.id)
        available_energy -= chosen.cost


def _valid_enemy_sequence(
    sequence: list[int],
    hand_cards: list[int],
    energy: int,
    templates: dict[int, CardTemplate],
) -> bool:
    remaining = Counter(hand_cards)
    available_energy = energy
    for template_id in sequence:
        template = templates.get(template_id)
        if template is None or remaining[template_id] <= 0 or template.cost > available_energy:
            return False
        remaining[template_id] -= 1
        available_energy -= template.cost
    return not any(
        count > 0 and templates[template_id].cost <= available_energy
        for template_id, count in remaining.items()
    )


def prepare_enemy_turn(
    db: Session,
    player: Player,
    battle_id: int,
    expected_version: int,
) -> dict[str, Any]:
    battle = get_owned_battle(db, player.id, battle_id)
    _check_active_version(battle, expected_version)
    enemy = db.get(NpcTemplate, battle.enemy_id)
    if enemy is None:
        abort(404, "敌人不存在")
    state = deepcopy(battle.state_json)
    templates = _ensure_enemy_deck_state(db, enemy, state)
    state["enemy_energy"] = state["enemy_max_energy"]
    profile = get_npc_ai_profile(enemy)
    action_weights = (enemy.battle_deck or {}).get("action_weights")
    fallback = deterministic_enemy_sequence(
        state["enemy_hand_cards"],
        state["enemy_energy"],
        templates,
        state,
        action_weights,
    )
    return {
        "battle_id": battle.id,
        "version": battle.version,
        "enemy_id": enemy.id,
        "enemy_name": enemy.name,
        "battle_enabled": profile.battle_enabled,
        "battle_style": profile.battle_style,
        "state": state,
        "candidates": _enemy_candidates(state, templates),
        "fallback_card_template_ids": fallback,
    }


def end_turn(
    db: Session,
    player: Player,
    battle_id: int,
    expected_version: int,
    selected_card_template_ids: list[int] | None = None,
    battle_line: str | None = None,
) -> ActiveBattle:
    battle = get_owned_battle(db, player.id, battle_id, lock=True)
    _check_active_version(battle, expected_version)
    state = deepcopy(battle.state_json)
    enemy = db.get(NpcTemplate, battle.enemy_id)
    if enemy is None:
        abort(404, "敌人不存在")
    templates = _ensure_enemy_deck_state(db, enemy, state)
    state["enemy_energy"] = state["enemy_max_energy"]
    requested = selected_card_template_ids or []
    requested_valid = _valid_enemy_sequence(
        requested,
        state["enemy_hand_cards"],
        state["enemy_energy"],
        templates,
    )
    sequence = requested if requested_valid else deterministic_enemy_sequence(
        state["enemy_hand_cards"],
        state["enemy_energy"],
        templates,
        state,
        (enemy.battle_deck or {}).get("action_weights"),
    )
    if not requested_valid:
        battle_line = None

    actions: list[dict[str, Any]] = []
    for template_id in sequence:
        template = templates[template_id]
        if template_id not in state["enemy_hand_cards"] or template.cost > state["enemy_energy"]:
            break
        state["enemy_energy"] -= template.cost
        state["enemy_hand_cards"].remove(template_id)
        state["enemy_discard_cards"].append(template_id)
        resolved = _apply_card_effect(
            state,
            template,
            actor="enemy",
            player_defense=player.defense,
        )
        actions.append(
            {
                "card_template_id": template.id,
                "name": template.name,
                "type": template.type,
                "cost": template.cost,
                **resolved,
            }
        )
        if state["player_state"]["hp"] == 0:
            break

    state["last_action"] = {
        "type": "enemy_cards",
        "cards": actions,
        "damage": sum(item["damage"] for item in actions),
        "blocked": sum(item["blocked"] for item in actions),
        "shield": sum(item["shield"] for item in actions),
        "battle_line": battle_line,
    }
    if state["player_state"]["hp"] == 0:
        battle.state_json = state
        battle.version += 1
        _complete_battle(db, battle, player, "defeat", defeat_reason="knockout")
    else:
        state["current_turn"] += 1
        state["energy"] = 3
        _draw_to_hand(state)
        _draw_enemy_to_hand(state)
        battle.state_json = state
        battle.version += 1
    db.commit()
    return battle


def surrender_battle(
    db: Session,
    player: Player,
    battle_id: int,
    expected_version: int,
) -> ActiveBattle:
    battle = get_owned_battle(db, player.id, battle_id, lock=True)
    _check_active_version(battle, expected_version)
    state = deepcopy(battle.state_json)
    state["last_action"] = {"type": "surrender"}
    battle.state_json = state
    battle.version += 1
    _complete_battle(db, battle, player, "defeat", defeat_reason="surrender")
    db.commit()
    return battle
