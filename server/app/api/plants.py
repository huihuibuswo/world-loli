from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import (
    AffectionRecord,
    Inventory,
    MapData,
    PlantTemplate,
    Player,
    PlayerCardSpirit,
    PlayerPlantNode,
    SpiritGiftPreference,
    SpiritGiftRecord,
)
from app.schemas import PlantCollectRequest, SpiritGiftRequest
from app.services.quest_progress_service import record_quest_objective


router = APIRouter(tags=["plants"])
MAX_PLANT_STACK = 99
DAILY_GIFT_LIMIT = 5
SHANGHAI = ZoneInfo("Asia/Shanghai")
PREFERENCE_RANK = {"disliked": 0, "neutral": 1, "liked": 2, "favorite": 3}
PREFERENCE_FEEDBACK = {
    "favorite": "这是她最喜欢的礼物！",
    "liked": "她看起来很喜欢这份礼物。",
    "neutral": "她收下了你的礼物。",
    "disliked": "她礼貌地收下了礼物，似乎不太合口味。",
}


def _plant_data(template: PlantTemplate, amount: int | None = None) -> dict:
    data = {
        "id": template.id,
        "name": template.name,
        "rarity": template.rarity,
        "base_affection": template.base_affection,
        "tags": template.tags or [],
        "description": template.description,
        "icon": template.icon,
        "respawn_seconds": template.respawn_seconds,
    }
    if amount is not None:
        data["amount"] = amount
    return data


def _map_plant_node(map_data: MapData, node_id: str) -> dict | None:
    return next(
        (
            item
            for item in (map_data.resource_json or {}).get("objects", [])
            if isinstance(item, dict)
            and item.get("type") == "collectible_plant"
            and item.get("node_id") == node_id
        ),
        None,
    )


def _preference(
    template: PlantTemplate, preferences: list[SpiritGiftPreference]
) -> tuple[str, str | None]:
    matched = [
        item
        for item in preferences
        if item.plant_template_id == template.id or (item.tag and item.tag in (template.tags or []))
    ]
    if not matched:
        return "neutral", None
    best = max(matched, key=lambda item: PREFERENCE_RANK[item.preference])
    return best.preference, best.dialogue


def _daily_window(now: datetime) -> tuple[datetime, datetime]:
    local_now = now.astimezone(SHANGHAI)
    start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_local.astimezone(UTC), (start_local + timedelta(days=1)).astimezone(UTC)


@router.get("/map/{map_id}/plants")
def list_map_plants(
    map_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    if player.current_map != map_id:
        abort(409, "只能查看当前地图的植物")
    map_data = db.get(MapData, map_id)
    if map_data is None:
        abort(404, "地图不存在")
    nodes = [
        item
        for item in (map_data.resource_json or {}).get("objects", [])
        if isinstance(item, dict) and item.get("type") == "collectible_plant"
    ]
    template_ids = {int(item["template_id"]) for item in nodes if item.get("template_id")}
    templates = {
        item.id: item
        for item in db.scalars(select(PlantTemplate).where(PlantTemplate.id.in_(template_ids))).all()
    }
    states = {
        item.node_id: item
        for item in db.scalars(
            select(PlayerPlantNode).where(
                PlayerPlantNode.player_id == player.id,
                PlayerPlantNode.map_id == map_id,
            )
        ).all()
    }
    now = datetime.now(UTC)
    result = []
    for node in nodes:
        template = templates.get(int(node.get("template_id", 0)))
        if template is None:
            continue
        state = states.get(str(node["node_id"]))
        available_at = state.available_at if state else None
        result.append(
            {
                **node,
                **_plant_data(template),
                "template_id": template.id,
                "available": available_at is None or available_at <= now,
                "available_at": available_at,
            }
        )
    return ok(result)


@router.get("/plants/inventory")
def list_plant_inventory(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    rows = db.execute(
        select(Inventory, PlantTemplate)
        .join(PlantTemplate, PlantTemplate.id == Inventory.item_id)
        .where(
            Inventory.player_id == player.id,
            Inventory.item_type == "plant",
            Inventory.amount > 0,
        )
        .order_by(PlantTemplate.rarity.desc(), PlantTemplate.id)
    ).all()
    return ok([_plant_data(template, inventory.amount) for inventory, template in rows])


@router.post("/plants/collect")
def collect_plant(
    payload: PlantCollectRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    locked_player = db.scalar(select(Player).where(Player.id == player.id).with_for_update())
    if locked_player is None:
        abort(404, "角色不存在")
    if locked_player.current_map != payload.map_id:
        abort(409, "该植物不在当前地图")
    map_data = db.get(MapData, payload.map_id)
    node = _map_plant_node(map_data, payload.node_id) if map_data else None
    if node is None or not node.get("template_id"):
        abort(404, "采集点不存在")
    template = db.get(PlantTemplate, int(node["template_id"]))
    if template is None:
        abort(404, "植物不存在")

    state = db.scalar(
        select(PlayerPlantNode)
        .where(
            PlayerPlantNode.player_id == player.id,
            PlayerPlantNode.map_id == payload.map_id,
            PlayerPlantNode.node_id == payload.node_id,
        )
        .with_for_update()
    )
    now = datetime.now(UTC)
    if state and state.available_at > now:
        abort(409, "植物尚未刷新")

    inventory = db.scalar(
        select(Inventory)
        .where(
            Inventory.player_id == player.id,
            Inventory.item_id == template.id,
            Inventory.item_type == "plant",
        )
        .with_for_update()
    )
    if inventory and inventory.amount >= MAX_PLANT_STACK:
        abort(409, "该植物已达到背包堆叠上限，请先整理背包")
    if inventory is None:
        inventory = Inventory(
            player_id=player.id, item_id=template.id, item_type="plant", amount=1
        )
        db.add(inventory)
    else:
        inventory.amount += 1

    available_at = now + timedelta(seconds=template.respawn_seconds)
    if state is None:
        state = PlayerPlantNode(
            player_id=player.id,
            map_id=payload.map_id,
            node_id=payload.node_id,
            plant_template_id=template.id,
            available_at=available_at,
        )
        db.add(state)
    else:
        state.plant_template_id = template.id
        state.available_at = available_at
    record_quest_objective(db, player.id, "collect_plant")
    db.commit()
    return ok(
        {
            "map_id": payload.map_id,
            "node_id": payload.node_id,
            "available": False,
            "available_at": available_at,
            "plant": _plant_data(template, inventory.amount),
        },
        f"获得 {template.name} ×1",
    )


def _owned_spirit(db: Session, player_id: int, spirit_id: int, *, lock: bool = False):
    statement = select(PlayerCardSpirit).where(
        PlayerCardSpirit.id == spirit_id, PlayerCardSpirit.player_id == player_id
    )
    if lock:
        statement = statement.with_for_update()
    spirit = db.scalar(statement)
    if spirit is None:
        abort(404, "卡牌精灵不存在")
    return spirit


@router.get("/spirits/{spirit_id}/gifts")
def gift_options(
    spirit_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit = _owned_spirit(db, player.id, spirit_id)
    preferences = db.scalars(
        select(SpiritGiftPreference).where(
            SpiritGiftPreference.spirit_template_id == spirit.spirit_template_id
        )
    ).all()
    rows = db.execute(
        select(Inventory, PlantTemplate)
        .join(PlantTemplate, PlantTemplate.id == Inventory.item_id)
        .where(
            Inventory.player_id == player.id,
            Inventory.item_type == "plant",
            Inventory.amount > 0,
        )
    ).all()
    start, end = _daily_window(datetime.now(UTC))
    used = db.scalar(
        select(func.count(SpiritGiftRecord.id)).where(
            SpiritGiftRecord.player_card_spirit_id == spirit.id,
            SpiritGiftRecord.gifted_at >= start,
            SpiritGiftRecord.gifted_at < end,
        )
    ) or 0
    plants = []
    for inventory, template in rows:
        preference, _ = _preference(template, list(preferences))
        plants.append({**_plant_data(template, inventory.amount), "preference": preference})
    plants.sort(key=lambda item: (-PREFERENCE_RANK[item["preference"]], item["id"]))
    return ok({"remaining_gifts": max(0, DAILY_GIFT_LIMIT - used), "plants": plants})


@router.post("/spirits/{spirit_id}/gifts")
def give_gift(
    spirit_id: int,
    payload: SpiritGiftRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    spirit = _owned_spirit(db, player.id, spirit_id, lock=True)
    if spirit.affection >= 100:
        abort(409, "羁绊已达到上限")
    template = db.get(PlantTemplate, payload.plant_template_id)
    if template is None:
        abort(404, "植物不存在")
    inventory = db.scalar(
        select(Inventory)
        .where(
            Inventory.player_id == player.id,
            Inventory.item_id == template.id,
            Inventory.item_type == "plant",
        )
        .with_for_update()
    )
    if inventory is None or inventory.amount < 1:
        abort(409, "背包中没有该植物")

    now = datetime.now(UTC)
    start, end = _daily_window(now)
    used = db.scalar(
        select(func.count(SpiritGiftRecord.id)).where(
            SpiritGiftRecord.player_card_spirit_id == spirit.id,
            SpiritGiftRecord.gifted_at >= start,
            SpiritGiftRecord.gifted_at < end,
        )
    ) or 0
    if used >= DAILY_GIFT_LIMIT:
        abort(429, "该卡灵今天已经收下 5 份植物礼物")

    preferences = list(
        db.scalars(
            select(SpiritGiftPreference).where(
                SpiritGiftPreference.spirit_template_id == spirit.spirit_template_id
            )
        ).all()
    )
    preference, special_dialogue = _preference(template, preferences)
    raw_gain = 1 if preference == "disliked" else template.base_affection + {
        "favorite": 2,
        "liked": 1,
        "neutral": 0,
    }[preference]
    affection_gained = min(6, 100 - spirit.affection, max(1, raw_gain))
    spirit.affection += affection_gained
    inventory.amount -= 1
    record = db.scalar(
        select(AffectionRecord).where(AffectionRecord.player_card_spirit_id == spirit.id)
    )
    if record is None:
        record = AffectionRecord(
            player_card_spirit_id=spirit.id,
            affection_value=spirit.affection,
            interaction_count=0,
        )
        db.add(record)
    else:
        record.affection_value = spirit.affection
    db.add(
        SpiritGiftRecord(
            player_id=player.id,
            player_card_spirit_id=spirit.id,
            plant_template_id=template.id,
            affection_gained=affection_gained,
            gifted_at=now,
        )
    )
    db.commit()
    dialogue = special_dialogue or PREFERENCE_FEEDBACK[preference]
    return ok(
        {
            "spirit_id": spirit.id,
            "plant_template_id": template.id,
            "preference": preference,
            "affection_gained": affection_gained,
            "affection": spirit.affection,
            "remaining_amount": inventory.amount,
            "remaining_gifts": DAILY_GIFT_LIMIT - used - 1,
            "dialogue": dialogue,
        },
        "礼物已送出",
    )
