from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.decks import _deck_data
from app.api.deps import get_current_player, player_data
from app.core.responses import ok
from app.db import get_db
from app.models import Deck, Player, PlayerCard, PlayerCardSpirit, PlayerQuest
from app.schemas import SaveGameRequest


router = APIRouter(prefix="/save", tags=["save"])


def _snapshot(db: Session, player: Player) -> dict:
    decks = db.scalars(select(Deck).where(Deck.player_id == player.id).order_by(Deck.id)).all()
    spirits = db.scalars(
        select(PlayerCardSpirit)
        .where(PlayerCardSpirit.player_id == player.id)
        .order_by(PlayerCardSpirit.id)
    ).all()
    cards = db.scalars(
        select(PlayerCard).where(PlayerCard.player_id == player.id).order_by(PlayerCard.id)
    ).all()
    quests = db.scalars(
        select(PlayerQuest).where(PlayerQuest.player_id == player.id).order_by(PlayerQuest.quest_id)
    ).all()
    return {
        "player": player_data(player),
        "spirits": [
            {
                "id": item.id,
                "spirit_template_id": item.spirit_template_id,
                "level": item.level,
                "exp": item.exp,
                "affection": item.affection,
                "awaken_level": item.awaken_level,
            }
            for item in spirits
        ],
        "cards": [
            {
                "id": item.id,
                "card_template_id": item.card_template_id,
                "level": item.level,
                "count": item.count,
            }
            for item in cards
        ],
        "decks": [_deck_data(db, deck) for deck in decks],
        "quests": [
            {"quest_id": item.quest_id, "status": item.status, "progress": item.progress}
            for item in quests
        ],
    }


@router.get("")
def load_save(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    return ok(_snapshot(db, player))


@router.post("")
def save_game(
    payload: SaveGameRequest | None = Body(default=None),
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    if payload is not None:
        if payload.day_index is not None:
            player.day_index = payload.day_index
        if payload.minute_of_day is not None:
            player.minute_of_day = payload.minute_of_day
    db.commit()
    db.refresh(player)
    return ok(_snapshot(db, player), "存档已同步")
