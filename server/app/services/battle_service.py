from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    ActiveBattle,
    BattleRecord,
    CardSpiritTemplate,
    CardTemplate,
    Deck,
    DeckCard,
    NpcTemplate,
    Player,
    PlayerCard,
    PlayerCardSpirit,
)


def battle_data(battle: ActiveBattle) -> dict[str, Any]:
    return {
        "battle_id": battle.id,
        "enemy_id": battle.enemy_id,
        "status": battle.status,
        "version": battle.version,
        **battle.state_json,
    }


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
        select(DeckCard, PlayerCard)
        .join(PlayerCard, PlayerCard.id == DeckCard.card_id)
        .where(DeckCard.deck_id == active_deck.id, DeckCard.player_id == player.id)
        .order_by(DeckCard.card_id)
    ).all()
    draw_pile = [card.id for item, card in deck_rows for _ in range(item.amount)]
    if not draw_pile:
        abort(409, "启用套牌中没有卡牌")

    enemy_config = enemy.battle_deck or {}
    state: dict[str, Any] = {
        "current_turn": 1,
        "energy": 3,
        "player_state": {"hp": player.hp, "max_hp": player.hp},
        "enemy_state": {
            "name": enemy.name,
            "hp": max(1, int(enemy_config.get("hp", 30))),
            "max_hp": max(1, int(enemy_config.get("hp", 30))),
        },
        "hand_cards": [],
        "draw_pile": draw_pile,
        "discard_cards": [],
        "buffs": [],
        "debuffs": [],
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
    reward = deepcopy(enemy.reward or {}) if enemy and result == "victory" else {}
    reward.pop("actions", None)
    if result == "victory":
        gold = max(0, min(int(reward.get("gold", 0)), 1_000_000))
        player.gold += gold

        spirit_template_id = reward.get("spirit_template_id")
        spirit_template = (
            db.get(CardSpiritTemplate, int(spirit_template_id)) if spirit_template_id else None
        )
        if spirit_template is not None:
            owned = db.scalar(
                select(PlayerCardSpirit).where(
                    PlayerCardSpirit.player_id == player.id,
                    PlayerCardSpirit.spirit_template_id == int(spirit_template_id),
                )
            )
            if owned is None:
                db.add(
                    PlayerCardSpirit(
                        player_id=player.id, spirit_template_id=int(spirit_template_id)
                    )
                )

        for template_id in reward.get("card_template_ids", []):
            template = db.get(CardTemplate, int(template_id))
            if template is None:
                continue
            owned_card = db.scalar(
                select(PlayerCard).where(
                    PlayerCard.player_id == player.id,
                    PlayerCard.card_template_id == int(template_id),
                    PlayerCard.level == 1,
                )
            )
            if owned_card is None:
                db.add(PlayerCard(player_id=player.id, card_template_id=int(template_id)))
            else:
                owned_card.count += 1

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
    state["energy"] -= template.cost
    state["hand_cards"].remove(card_id)
    state["discard_cards"].append(card_id)
    state["enemy_state"]["hp"] = max(0, state["enemy_state"]["hp"] - damage)
    state["last_action"] = {"type": "play_card", "card_id": card_id, "damage": damage}
    battle.state_json = state
    battle.version += 1
    if state["enemy_state"]["hp"] == 0:
        _complete_battle(db, battle, player, "victory")
    db.commit()
    return battle


def end_turn(
    db: Session,
    player: Player,
    battle_id: int,
    expected_version: int,
) -> ActiveBattle:
    battle = get_owned_battle(db, player.id, battle_id, lock=True)
    _check_active_version(battle, expected_version)
    state = deepcopy(battle.state_json)
    enemy = db.get(NpcTemplate, battle.enemy_id)
    enemy_attack = max(0, min(int((enemy.battle_deck or {}).get("attack", 5)), 1_000_000))
    damage = max(1, enemy_attack - player.defense // 2)
    state["player_state"]["hp"] = max(0, state["player_state"]["hp"] - damage)
    state["last_action"] = {"type": "enemy_attack", "damage": damage}
    state["current_turn"] += 1
    state["energy"] = 3
    _draw_to_hand(state)
    battle.state_json = state
    battle.version += 1
    if state["player_state"]["hp"] == 0:
        _complete_battle(db, battle, player, "defeat")
    db.commit()
    return battle
