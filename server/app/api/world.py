from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import MapData, NpcTemplate, Player
from app.schemas import MapEnterRequest, NpcInteractionRequest
from app.services.battle_service import battle_data, create_battle


router = APIRouter(tags=["world"])


def _map_data(item: MapData) -> dict:
    return {
        "id": item.id,
        "map_name": item.map_name,
        "map_type": item.map_type,
        "level_limit": item.level_limit,
        "resource": item.resource_json,
    }


def _npc_data(item: NpcTemplate) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "type": item.type,
        "story": item.story,
        "battle_deck": item.battle_deck,
        "reward": item.reward,
        "is_card_spirit": item.is_card_spirit,
    }


@router.get("/map/{map_id}")
def get_map(map_id: int, db: Session = Depends(get_db)) -> dict:
    item = db.get(MapData, map_id)
    if item is None:
        abort(404, "地图不存在")
    return ok(_map_data(item))


@router.get("/map/{map_id}/objects")
def get_map_objects(map_id: int, db: Session = Depends(get_db)) -> dict:
    item = db.get(MapData, map_id)
    if item is None:
        abort(404, "地图不存在")
    return ok((item.resource_json or {}).get("objects", []))


@router.post("/map/enter")
def enter_map(
    payload: MapEnterRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(MapData, payload.map_id)
    if item is None:
        abort(404, "地图不存在")
    if player.level < item.level_limit:
        abort(403, "角色等级不足，无法进入该区域")
    spawn = (item.resource_json or {}).get("spawn", {})
    player.current_map = item.id
    player.position_x = float(spawn.get("x", 0))
    player.position_y = float(spawn.get("y", 0))
    db.commit()
    return ok(
        {"map": _map_data(item), "position_x": player.position_x, "position_y": player.position_y},
        "已进入地图",
    )


@router.get("/npc/{npc_id}")
def get_npc(npc_id: int, db: Session = Depends(get_db)) -> dict:
    item = db.get(NpcTemplate, npc_id)
    if item is None:
        abort(404, "NPC不存在")
    return ok(_npc_data(item))


@router.post("/npc/dialog")
def npc_dialog(payload: NpcInteractionRequest, db: Session = Depends(get_db)) -> dict:
    item = db.get(NpcTemplate, payload.npc_id)
    if item is None:
        abort(404, "NPC不存在")
    return ok({"npc_id": item.id, "speaker": item.name, "text": item.story})


@router.post("/npc/action")
def npc_action(payload: NpcInteractionRequest, db: Session = Depends(get_db)) -> dict:
    item = db.get(NpcTemplate, payload.npc_id)
    if item is None:
        abort(404, "NPC不存在")
    actions = (item.reward or {}).get("actions", ["dialog", "battle"])
    if payload.action and payload.action not in actions:
        abort(422, "该NPC不支持此操作")
    return ok({"npc_id": item.id, "available_actions": actions, "selected": payload.action})


@router.post("/npc/battle", status_code=201)
def npc_battle(
    payload: NpcInteractionRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(battle_data(create_battle(db, player, payload.npc_id)), "战斗已创建")
