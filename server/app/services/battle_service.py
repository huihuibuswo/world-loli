from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    ActiveBattle,
    BattleRecord,
    CardTemplate,
    Deck,
    DeckCard,
    NpcTemplate,
    NpcFirstVictoryReward,
    Player,
    PlayerCard,
    PlayerCardSpirit,
)
from app.services.ai_profile import get_npc_ai_profile


def battle_data(battle: ActiveBattle) -> dict[str, Any]:
    return {
        "battle_id": battle.id,
        "enemy_id": battle.enemy_id,
        "status": battle.status,
        "version": battle.version,
        **battle.state_json,
    }


def enemy_action_candidates(enemy: NpcTemplate, state: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = [
        {
            "id": "basic_attack",
            "description": "进行一次稳定的普通攻击",
            "tags": ["damage"],
        }
    ]
    config = enemy.battle_deck or {}
    enemy_state = state.get("enemy_state") if isinstance(state.get("enemy_state"), dict) else {}
    guard = max(0, min(int(config.get("guard", 0)), 1_000_000))
    if guard > 0 and int(enemy_state.get("shield", 0)) <= 0:
        candidates.append(
            {
                "id": "guard",
                "description": "获得护盾，抵挡下一次受到的伤害",
                "tags": ["defense"],
            }
        )
    return candidates


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
        hand.append(draw.pop(0))


def _damage_with_affection(damage: int, affection: int) -> int:
    """Apply the documented affection tiers without changing card configuration."""
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

    enemy_config = enemy.battle_deck or {}
    state: dict[str, Any] = {
        "current_turn": 1,
        "energy": 3,
        "player_state": {"hp": player.hp, "max_hp": player.hp},
        "enemy_state": {
            "name": enemy.name,
            "sprite": str((enemy.reward or {}).get("sprite", "npc-trainer")),
            "hp": max(1, int(enemy_config.get("hp", 30))),
            "max_hp": max(1, int(enemy_config.get("hp", 30))),
            "shield": 0,
        },
        "hand_cards": [],
        "draw_pile": draw_pile,
        "discard_cards": [],
        "buffs": [],
        "debuffs": [],
        "spirit_template_ids": sorted(
            {template.source_spirit_id for _, _, template in deck_rows if template.source_spirit_id}
        ),
    }
    _draw_to_hand(state)
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
) -> None:
    enemy = db.get(NpcTemplate, battle.enemy_id)
    reward: dict[str, Any] = {}
    if enemy is not None and result == "victory":
        template_id = (enemy.reward or {}).get("first_victory_card_template_id")
        template = db.get(CardTemplate, int(template_id)) if template_id else None
        if template is not None:
            claimed_npc_id = db.scalar(
                pg_insert(NpcFirstVictoryReward)
                .values(
                    player_id=player.id,
                    npc_id=enemy.id,
                    card_template_id=template.id,
                )
                .on_conflict_do_nothing(
                    index_elements=[
                        NpcFirstVictoryReward.player_id,
                        NpcFirstVictoryReward.npc_id,
                    ]
                )
                .returning(NpcFirstVictoryReward.npc_id)
            )
            if claimed_npc_id is not None:
                owned_card = db.scalar(
                    select(PlayerCard).where(
                        PlayerCard.player_id == player.id,
                        PlayerCard.card_template_id == template.id,
                        PlayerCard.level == 1,
                    )
                )
                if owned_card is None:
                    db.add(PlayerCard(player_id=player.id, card_template_id=template.id))
                else:
                    owned_card.count += 1
                reward = {
                    "first_victory": True,
                    "card": {
                        "template_id": template.id,
                        "name": template.name,
                        "count": 1,
                    },
                }

    battle.status = result
    state = deepcopy(battle.state_json)
    state["result"] = result
    state["reward"] = reward
    battle.state_json = state
    db.add(
        BattleRecord(
            player_id=player.id,
            enemy_id=battle.enemy_id,
            result=result,
            turn_count=int(state["current_turn"]),
            reward_json=reward,
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
    base_damage = max(0, min(int(effect.get("damage", 0)), 1_000_000))
    per_level = max(0, min(int((template.upgrade_json or {}).get("damage_per_level", 0)), 100_000))
    damage = base_damage + (card.level - 1) * per_level
    if template.source_spirit_id:
        spirit = db.scalar(
            select(PlayerCardSpirit).where(
                PlayerCardSpirit.player_id == player.id,
                PlayerCardSpirit.spirit_template_id == template.source_spirit_id,
            )
        )
        if spirit is not None:
            damage = _damage_with_affection(damage, spirit.affection)
    shield = max(0, min(int(state["enemy_state"].get("shield", 0)), 1_000_000))
    blocked = min(shield, damage)
    damage -= blocked
    state["enemy_state"]["shield"] = shield - blocked
    state["energy"] -= template.cost
    state["hand_cards"].remove(card_id)
    state["discard_cards"].append(card_id)
    state["enemy_state"]["hp"] = max(0, state["enemy_state"]["hp"] - damage)
    state["last_action"] = {
        "type": "play_card",
        "card_id": card_id,
        "damage": damage,
        "blocked": blocked,
    }
    battle.state_json = state
    battle.version += 1
    if state["enemy_state"]["hp"] == 0:
        _complete_battle(db, battle, player, "victory")
    db.commit()
    return battle


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
    profile = get_npc_ai_profile(enemy)
    return {
        "battle_id": battle.id,
        "version": battle.version,
        "enemy_id": enemy.id,
        "enemy_name": enemy.name,
        "battle_enabled": profile.battle_enabled,
        "battle_style": profile.battle_style,
        "state": state,
        "candidates": enemy_action_candidates(enemy, state),
    }


def end_turn(
    db: Session,
    player: Player,
    battle_id: int,
    expected_version: int,
    selected_action_id: str = "basic_attack",
    battle_line: str | None = None,
) -> ActiveBattle:
    battle = get_owned_battle(db, player.id, battle_id, lock=True)
    _check_active_version(battle, expected_version)
    state = deepcopy(battle.state_json)
    enemy = db.get(NpcTemplate, battle.enemy_id)
    if enemy is None:
        abort(404, "敌人不存在")
    candidate_ids = {item["id"] for item in enemy_action_candidates(enemy, state)}
    action_id = selected_action_id if selected_action_id in candidate_ids else "basic_attack"
    enemy_attack = max(0, min(int((enemy.battle_deck or {}).get("attack", 5)), 1_000_000))
    if action_id == "guard":
        shield = max(1, min(int((enemy.battle_deck or {}).get("guard", 1)), 1_000_000))
        state["enemy_state"]["shield"] = shield
        state["last_action"] = {
            "type": "enemy_guard",
            "action_id": action_id,
            "shield": shield,
            "battle_line": battle_line,
        }
    else:
        damage = max(1, enemy_attack - player.defense // 2)
        state["player_state"]["hp"] = max(0, state["player_state"]["hp"] - damage)
        state["last_action"] = {
            "type": "enemy_attack",
            "action_id": "basic_attack",
            "damage": damage,
            "battle_line": battle_line,
        }
    state["current_turn"] += 1
    state["energy"] = 3
    _draw_to_hand(state)
    battle.state_json = state
    battle.version += 1
    if state["player_state"]["hp"] == 0:
        _complete_battle(db, battle, player, "defeat")
    db.commit()
    return battle
