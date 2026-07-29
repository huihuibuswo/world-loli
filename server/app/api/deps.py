from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.core.security import get_current_user
from app.db import get_db
from app.models import Player, User


def get_current_player(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Player:
    player = db.scalar(select(Player).where(Player.user_id == user.id).order_by(Player.id))
    if player is None:
        abort(404, "玩家角色不存在")
    return player


def player_data(player: Player) -> dict:
    return {
        "id": player.id,
        "name": player.name,
        "avatar_gender": player.avatar_gender,
        "level": player.level,
        "exp": player.exp,
        "hp": player.hp,
        "attack": player.attack,
        "defense": player.defense,
        "gold": player.gold,
        "current_map": player.current_map,
        "position_x": player.position_x,
        "position_y": player.position_y,
        "day_index": player.day_index,
        "minute_of_day": player.minute_of_day,
    }
