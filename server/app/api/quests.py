from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import Player, PlayerQuest, Quest


router = APIRouter(prefix="/quests", tags=["quests"])


def _quest_data(quest: Quest, progress: PlayerQuest | None) -> dict:
    return {
        "id": quest.id,
        "title": quest.title,
        "description": quest.description,
        "type": quest.type,
        "reward": quest.reward_json,
        "status": progress.status if progress else "not_started",
        "progress": progress.progress if progress else {},
    }


@router.get("")
def list_quests(
    player: Player = Depends(get_current_player), db: Session = Depends(get_db)
) -> dict:
    quests = db.scalars(select(Quest).order_by(Quest.id)).all()
    progress = {
        item.quest_id: item
        for item in db.scalars(
            select(PlayerQuest).where(PlayerQuest.player_id == player.id)
        ).all()
    }
    return ok([_quest_data(quest, progress.get(quest.id)) for quest in quests])


@router.post("/{quest_id}/accept")
def accept_quest(
    quest_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    quest = db.get(Quest, quest_id)
    if quest is None:
        abort(404, "任务不存在")
    item = db.get(PlayerQuest, (player.id, quest.id))
    if item is not None and item.status != "not_started":
        abort(409, "任务已经领取")
    if item is None:
        item = PlayerQuest(player_id=player.id, quest_id=quest.id, status="active", progress={})
        db.add(item)
    else:
        item.status = "active"
    db.commit()
    return ok(_quest_data(quest, item), "任务已领取")


@router.post("/{quest_id}/complete")
def complete_quest(
    quest_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    quest = db.get(Quest, quest_id)
    item = db.get(PlayerQuest, (player.id, quest_id))
    if quest is None or item is None:
        abort(404, "任务不存在或尚未领取")
    if item.status == "completed":
        abort(409, "任务已经完成")
    if item.status != "active" or not bool((item.progress or {}).get("ready")):
        abort(409, "任务条件尚未完成")
    player.gold += max(0, min(int((quest.reward_json or {}).get("gold", 0)), 1_000_000))
    item.status = "completed"
    db.commit()
    return ok(_quest_data(quest, item), "任务已完成")


@router.get("/{quest_id}/progress")
def quest_progress(
    quest_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    quest = db.get(Quest, quest_id)
    if quest is None:
        abort(404, "任务不存在")
    item = db.get(PlayerQuest, (player.id, quest_id))
    return ok(_quest_data(quest, item))
