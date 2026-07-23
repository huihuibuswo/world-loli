from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import ActiveBattle, MapData, NpcTemplate, Player
from app.schemas import MapEnterRequest, NpcChatRequest, NpcInteractionRequest
from app.services.ai_profile import get_npc_ai_profile
from app.services.battle_service import battle_data, create_battle
from app.services.npc_ai_service import chat_with_npc, get_chat_state


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
    reward = item.reward or {}
    ai_profile = get_npc_ai_profile(item)
    dialogue = reward.get("dialogue")
    if not isinstance(dialogue, list) or not dialogue:
        dialogue = [item.story]
    return {
        "id": item.id,
        "name": item.name,
        "type": item.type,
        "story": item.story,
        "battle_deck": item.battle_deck,
        "reward": reward,
        "is_card_spirit": item.is_card_spirit,
        "sprite": reward.get("sprite", "npc-trainer"),
        "portrait": reward.get("portrait"),
        "dialogue": [str(line) for line in dialogue if str(line).strip()],
        "actions": reward.get("actions", ["dialog", "battle"]),
        "ai": {
            "dialogue_enabled": ai_profile.dialogue_enabled,
            "battle_enabled": ai_profile.battle_enabled,
            "fallback_replies": list(ai_profile.fallback_replies),
        },
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
    if player.current_map == item.id:
        abort(409, "角色已经在该地图中")
    if player.level < item.level_limit:
        abort(403, "角色等级不足，无法进入该区域")
    active_battle = db.scalar(
        select(ActiveBattle.id).where(
            ActiveBattle.player_id == player.id,
            ActiveBattle.status == "active",
        )
    )
    if active_battle is not None:
        abort(409, "战斗中无法切换地图")

    current_map = db.get(MapData, player.current_map) if player.current_map else None
    portal = next(
        (
            obj
            for obj in ((current_map.resource_json or {}).get("objects", []) if current_map else [])
            if isinstance(obj, dict)
            and obj.get("type") == "map_portal"
            and obj.get("target_map_id") == item.id
        ),
        None,
    )
    if portal is None:
        abort(403, "当前地图没有通往该区域的出口")

    spawn = (item.resource_json or {}).get("spawn", {})
    player.current_map = item.id
    player.position_x = float(portal.get("spawn_x", spawn.get("x", 0)))
    player.position_y = float(portal.get("spawn_y", spawn.get("y", 0)))
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


@router.get("/npc/{npc_id}/chat")
def get_npc_chat(
    npc_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(NpcTemplate, npc_id)
    if item is None:
        abort(404, "NPC不存在")
    return ok(get_chat_state(db, player, item))


@router.post("/npc/{npc_id}/chat")
def post_npc_chat(
    npc_id: int,
    payload: NpcChatRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    item = db.get(NpcTemplate, npc_id)
    if item is None:
        abort(404, "NPC不存在")
    return ok(chat_with_npc(db, player, item, payload), "NPC 已回应")


@router.post("/npc/dialog")
def npc_dialog(payload: NpcInteractionRequest, db: Session = Depends(get_db)) -> dict:
    item = db.get(NpcTemplate, payload.npc_id)
    if item is None:
        abort(404, "NPC不存在")
    dialogue = (item.reward or {}).get("dialogue")
    if not isinstance(dialogue, list) or not dialogue:
        dialogue = [item.story]
    return ok({"npc_id": item.id, "speaker": item.name, "lines": dialogue})


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
