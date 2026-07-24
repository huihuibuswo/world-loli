from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import ok
from app.db import get_db
from app.models import Player
from app.services.opening_story_service import complete_opening, opening_data, start_opening


router = APIRouter(prefix="/opening", tags=["opening"])


@router.get("")
def get_opening(
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(opening_data(db, player))


@router.post("/start")
def post_start_opening(
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(start_opening(db, player), "序章已开始")


@router.post("/complete")
def post_complete_opening(
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(complete_opening(db, player), "序章已完成")
