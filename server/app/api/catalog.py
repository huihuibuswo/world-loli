from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import (
    AffectionRecord,
    CardSpiritTemplate,
    CardTemplate,
    Player,
    PlayerCard,
    PlayerCardSpirit,
)
from app.schemas import CardUpgradeRequest, SpiritAffectionRequest, SpiritLevelRequest


router = APIRouter(tags=["collection"])


def _spirit_data(spirit: PlayerCardSpirit, template: CardSpiritTemplate) -> dict:
    return {
        "id": spirit.id,
        "template_id": template.id,
        "name": template.name,
        "race": template.race,
        "rarity": template.rarity,
        "type": template.type,
        "story": template.story,
        "avatar": template.avatar,
        "base_skill": template.base_skill,
        "awakening_skill": template.awakening_skill,
        "level": spirit.level,
        "exp": spirit.exp,
        "affection": spirit.affection,
        "awaken_level": spirit.awaken_level,
        "acquired_at": spirit.acquired_at,
    }


def _card_data(card: PlayerCard, template: CardTemplate) -> dict:
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


def _owned_spirit(db: Session, player_id: int, spirit_id: int) -> tuple[PlayerCardSpirit, CardSpiritTemplate]:
    row = db.execute(
        select(PlayerCardSpirit, CardSpiritTemplate)
        .join(CardSpiritTemplate, CardSpiritTemplate.id == PlayerCardSpirit.spirit_template_id)
        .where(PlayerCardSpirit.id == spirit_id, PlayerCardSpirit.player_id == player_id)
    ).one_or_none()
    if row is None:
        abort(404, "卡牌精灵不存在")
    return row[0], row[1]


def _owned_card(db: Session, player_id: int, card_id: int) -> tuple[PlayerCard, CardTemplate]:
    row = db.execute(
        select(PlayerCard, CardTemplate)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(PlayerCard.id == card_id, PlayerCard.player_id == player_id)
    ).one_or_none()
    if row is None:
        abort(404, "卡牌不存在")
    return row[0], row[1]


@router.get("/spirits")
def list_spirits(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    rows = db.execute(
        select(PlayerCardSpirit, CardSpiritTemplate)
        .join(CardSpiritTemplate, CardSpiritTemplate.id == PlayerCardSpirit.spirit_template_id)
        .where(PlayerCardSpirit.player_id == player.id)
        .order_by(PlayerCardSpirit.id)
    ).all()
    return ok([_spirit_data(spirit, template) for spirit, template in rows])


@router.get("/spirits/{spirit_id}")
def get_spirit(
    spirit_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit, template = _owned_spirit(db, player.id, spirit_id)
    return ok(_spirit_data(spirit, template))


@router.post("/spirits/{spirit_id}/affection")
def add_affection(
    spirit_id: int,
    payload: SpiritAffectionRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit, template = _owned_spirit(db, player.id, spirit_id)
    record = db.scalar(
        select(AffectionRecord).where(AffectionRecord.player_card_spirit_id == spirit.id)
    )
    if record is None:
        record = AffectionRecord(
            player_card_spirit_id=spirit.id,
            affection_value=0,
            interaction_count=0,
        )
        db.add(record)
    elif record.last_interaction_time and datetime.now(UTC) - record.last_interaction_time < timedelta(seconds=60):
        abort(429, "互动过于频繁，请稍后再试")
    points = {"dialog": 1, "battle": 2, "gift": 3, "quest": 5}[payload.source]
    spirit.affection += points
    record.affection_value = spirit.affection
    record.interaction_count += 1
    record.last_interaction_time = datetime.now(UTC)
    db.commit()
    return ok(_spirit_data(spirit, template), "好感度已提升")


@router.post("/spirits/{spirit_id}/level")
def level_spirit(
    spirit_id: int,
    payload: SpiritLevelRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit, template = _owned_spirit(db, player.id, spirit_id)
    cost = sum(level * 100 for level in range(spirit.level, spirit.level + payload.levels))
    if spirit.exp < cost:
        abort(409, "卡牌精灵经验不足")
    spirit.exp -= cost
    spirit.level += payload.levels
    db.commit()
    return ok(_spirit_data(spirit, template), "卡牌精灵已升级")


@router.get("/spirits/{spirit_id}/growth")
def spirit_growth(
    spirit_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit, _ = _owned_spirit(db, player.id, spirit_id)
    return ok(
        {
            "level": spirit.level,
            "exp": spirit.exp,
            "next_level_exp": spirit.level * 100,
            "affection": spirit.affection,
            "awaken_level": spirit.awaken_level,
        }
    )


@router.get("/cards")
def list_cards(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    rows = db.execute(
        select(PlayerCard, CardTemplate)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(PlayerCard.player_id == player.id)
        .order_by(PlayerCard.id)
    ).all()
    return ok([_card_data(card, template) for card, template in rows])


@router.get("/cards/{card_id}")
def get_card(
    card_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    card, template = _owned_card(db, player.id, card_id)
    return ok(_card_data(card, template))


@router.post("/cards/{card_id}/upgrade")
def upgrade_card(
    card_id: int,
    payload: CardUpgradeRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    card, template = _owned_card(db, player.id, card_id)
    cost = sum(level * 100 for level in range(card.level, card.level + payload.levels))
    if player.gold < cost:
        abort(409, "金币不足")
    player.gold -= cost
    card.level += payload.levels
    db.commit()
    return ok(_card_data(card, template), "卡牌已升级")


@router.get("/cards/{card_id}/effects")
def get_card_effects(
    card_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    card, template = _owned_card(db, player.id, card_id)
    return ok({"card_id": card.id, "effect": template.effect_json, "upgrade": template.upgrade_json})
