from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_player, player_data
from app.core.responses import abort, ok
from app.db import get_db
from app.models import MapData, Player
from app.schemas import LocationRequest, PlayerUpdateRequest


router = APIRouter(prefix="/player", tags=["player"])


@router.get("/profile")
def get_profile(player: Player = Depends(get_current_player)) -> dict:
    return ok(player_data(player))


@router.put("/profile")
def update_profile(
    payload: PlayerUpdateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    player.name = payload.name.strip()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        abort(409, "角色名称已存在")
    return ok(player_data(player), "角色信息已更新")


@router.get("/location")
def get_location(player: Player = Depends(get_current_player)) -> dict:
    return ok(
        {
            "map_id": player.current_map,
            "position_x": player.position_x,
            "position_y": player.position_y,
        }
    )


@router.post("/location")
def save_location(
    payload: LocationRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    if player.current_map != payload.map_id:
        abort(409, "请先通过地图进入接口切换区域")
    map_data = db.scalar(select(MapData).where(MapData.id == payload.map_id))
    if map_data is None:
        abort(404, "地图不存在")
    bounds = (map_data.resource_json or {}).get("bounds")
    if bounds and not (
        float(bounds.get("min_x", 0)) <= payload.position_x <= float(bounds.get("max_x", 0))
        and float(bounds.get("min_y", 0)) <= payload.position_y <= float(bounds.get("max_y", 0))
    ):
        abort(422, "坐标超出地图边界")
    player.position_x = payload.position_x
    player.position_y = payload.position_y
    db.commit()
    return ok(
        {"map_id": player.current_map, "position_x": player.position_x, "position_y": player.position_y},
        "位置已保存",
    )
