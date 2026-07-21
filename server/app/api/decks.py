from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import CardTemplate, Deck, DeckCard, Player, PlayerCard
from app.schemas import DeckCardRequest, DeckCreateRequest, DeckUpdateRequest


router = APIRouter(prefix="/decks", tags=["decks"])


def _owned_deck(db: Session, player_id: int, deck_id: int) -> Deck:
    deck = db.scalar(select(Deck).where(Deck.id == deck_id, Deck.player_id == player_id))
    if deck is None:
        abort(404, "套牌不存在")
    return deck


def _deck_data(db: Session, deck: Deck) -> dict:
    rows = db.execute(
        select(DeckCard, PlayerCard, CardTemplate)
        .join(PlayerCard, PlayerCard.id == DeckCard.card_id)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(DeckCard.deck_id == deck.id)
        .order_by(DeckCard.card_id)
    ).all()
    return {
        "id": deck.id,
        "name": deck.name,
        "is_active": deck.is_active,
        "cards": [
            {
                "card_id": deck_card.card_id,
                "template_id": template.id,
                "name": template.name,
                "cost": template.cost,
                "level": card.level,
                "amount": deck_card.amount,
            }
            for deck_card, card, template in rows
        ],
    }


@router.get("")
def list_decks(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    decks = db.scalars(
        select(Deck).where(Deck.player_id == player.id).order_by(Deck.id)
    ).all()
    return ok([_deck_data(db, deck) for deck in decks])


@router.post("", status_code=201)
def create_deck(
    payload: DeckCreateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    if payload.is_active:
        db.execute(update(Deck).where(Deck.player_id == player.id).values(is_active=False))
    deck = Deck(player_id=player.id, name=payload.name.strip(), is_active=payload.is_active)
    db.add(deck)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        abort(409, "套牌名称已存在")
    return ok(_deck_data(db, deck), "套牌已创建")


@router.put("/{deck_id}")
def update_deck(
    deck_id: int,
    payload: DeckUpdateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    deck = _owned_deck(db, player.id, deck_id)
    if payload.name is not None:
        deck.name = payload.name.strip()
    if payload.is_active is not None:
        if payload.is_active:
            db.execute(update(Deck).where(Deck.player_id == player.id).values(is_active=False))
        deck.is_active = payload.is_active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        abort(409, "套牌名称已存在")
    return ok(_deck_data(db, deck), "套牌已更新")


@router.delete("/{deck_id}", status_code=204)
def delete_deck(
    deck_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> Response:
    deck = _owned_deck(db, player.id, deck_id)
    db.delete(deck)
    db.commit()
    return Response(status_code=204)


@router.post("/{deck_id}/cards")
def add_deck_card(
    deck_id: int,
    payload: DeckCardRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    deck = _owned_deck(db, player.id, deck_id)
    card = db.scalar(
        select(PlayerCard).where(PlayerCard.id == payload.card_id, PlayerCard.player_id == player.id)
    )
    if card is None:
        abort(404, "卡牌不存在")
    if payload.amount > card.count:
        abort(409, "加入数量超过拥有数量")
    item = db.get(DeckCard, (deck.id, card.id))
    if item is None:
        item = DeckCard(deck_id=deck.id, card_id=card.id, player_id=player.id, amount=payload.amount)
        db.add(item)
    else:
        item.amount = payload.amount
    db.commit()
    return ok(_deck_data(db, deck), "套牌卡牌已更新")


@router.delete("/{deck_id}/cards")
def remove_deck_card(
    deck_id: int,
    payload: DeckCardRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    deck = _owned_deck(db, player.id, deck_id)
    result = db.execute(
        delete(DeckCard).where(DeckCard.deck_id == deck.id, DeckCard.card_id == payload.card_id)
    )
    if result.rowcount == 0:
        abort(404, "套牌中不存在该卡牌")
    db.commit()
    return ok(_deck_data(db, deck), "卡牌已移出套牌")
