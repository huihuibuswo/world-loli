from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import CardTemplate, Player, PlayerCard


def card_data(card: PlayerCard, template: CardTemplate) -> dict:
    return {
        "id": card.id,
        "template_id": template.id,
        "name": template.name,
        "type": template.type,
        "cost": template.cost,
        "rarity": template.rarity,
        "source_spirit_id": template.source_spirit_id,
        "effect": template.effect_json,
        "upgrade": template.upgrade_json,
        "level": card.level,
        "count": card.count,
        "created_at": card.created_at,
    }


def owned_card(
    db: Session,
    player_id: int,
    card_id: int,
    *,
    lock: bool = False,
) -> tuple[PlayerCard, CardTemplate]:
    statement = (
        select(PlayerCard, CardTemplate)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(PlayerCard.id == card_id, PlayerCard.player_id == player_id)
    )
    if lock:
        statement = statement.with_for_update(of=PlayerCard)
    row = db.execute(statement).one_or_none()
    if row is None:
        abort(404, "卡牌不存在")
    return row[0], row[1]


def card_upgrade_cost(level: int, levels: int) -> int:
    return sum(current * 100 for current in range(level, level + levels))


def card_has_upgrade(template: CardTemplate) -> bool:
    upgrade = template.upgrade_json or {}
    return any(
        isinstance(upgrade.get(key), int) and upgrade[key] > 0
        for key in ("damage_per_level", "shield_per_level")
    )


def upgrade_player_card(
    db: Session,
    player_id: int,
    card_id: int,
    levels: int,
) -> tuple[PlayerCard, CardTemplate, Player, int]:
    player = db.scalar(select(Player).where(Player.id == player_id).with_for_update())
    if player is None:
        abort(404, "角色不存在")
    card, template = owned_card(db, player_id, card_id, lock=True)
    if not card_has_upgrade(template):
        abort(409, "该卡牌当前没有可提升的效果")
    cost = card_upgrade_cost(card.level, levels)
    if player.gold < cost:
        abort(409, "金币不足")
    player.gold -= cost
    card.level += levels
    return card, template, player, cost
