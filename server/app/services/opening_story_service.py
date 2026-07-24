from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import MapData, NpcTemplate, Player, PlayerQuest, PlayerStoryProgress, Quest


STORY_KEY = "opening_moon_scar"
STORY_TITLE = "雾中月痕"
LUNA_NAME = "狼娘·露娜"
VILLAGE_NAME = "晨曦村"
FOREST_NAME = "微光森林"
TASK_TITLES = ("村道补给", "林缘踏查", "实战准备")
STAGES = {"arrival", "prepare", "forest_signal", "return_village", "complete"}


def _progress(db: Session, player_id: int, *, lock: bool = False) -> PlayerStoryProgress | None:
    statement = select(PlayerStoryProgress).where(
        PlayerStoryProgress.player_id == player_id,
        PlayerStoryProgress.story_key == STORY_KEY,
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def _task_rows(db: Session, player_id: int) -> list[tuple[Quest, PlayerQuest | None]]:
    quests = db.scalars(select(Quest).where(Quest.title.in_(TASK_TITLES))).all()
    by_title = {quest.title: quest for quest in quests}
    if set(by_title) != set(TASK_TITLES):
        abort(500, "序章依赖的村长任务配置不完整")
    progress = {
        item.quest_id: item
        for item in db.scalars(
            select(PlayerQuest).where(
                PlayerQuest.player_id == player_id,
                PlayerQuest.quest_id.in_([quest.id for quest in quests]),
            )
        ).all()
    }
    return [(by_title[title], progress.get(by_title[title].id)) for title in TASK_TITLES]


def _task_ready(progress: PlayerQuest | None) -> bool:
    return progress is not None and (
        progress.status == "completed" or bool((progress.progress or {}).get("ready"))
    )


def _effective_stage(
    progress: PlayerStoryProgress | None,
    tasks: list[tuple[Quest, PlayerQuest | None]],
) -> str:
    if progress is None:
        return "arrival"
    stage = progress.stage if progress.stage in STAGES else "arrival"
    if stage == "prepare" and all(_task_ready(item) for _, item in tasks):
        return "forest_signal"
    return stage


def _task_data(quest: Quest, progress: PlayerQuest | None) -> dict[str, Any]:
    state = progress.progress if progress else {}
    return {
        "id": quest.id,
        "title": quest.title,
        "description": quest.description,
        "status": progress.status if progress else "not_started",
        "ready": _task_ready(progress),
        "current": max(0, int((state or {}).get("current", 0))),
        "target": max(1, int((state or {}).get("target", 1))),
    }


def _objective(stage: str, current_map_name: str | None) -> dict[str, str]:
    if stage == "arrival":
        return {
            "title": "抵达晨曦村",
            "description": "听村长说明入村准备，开始序章。",
        }
    if stage == "prepare":
        return {
            "title": "完成入村准备",
            "description": "准备暖茶、完成训练切磋，并记录一次植物采集。",
        }
    if stage == "forest_signal":
        return {
            "title": "调查月光空地",
            "description": "前往微光森林西北侧的月光空地，与狼娘·露娜交谈。",
        }
    if stage == "return_village":
        return {
            "title": "带回月痕线索",
            "description": "返回晨曦村，向村长汇报露娜与共鸣碎片。"
            if current_map_name != VILLAGE_NAME
            else "调查线索已经齐全，可以向村长完成汇报。",
        }
    return {
        "title": "追踪下一道月痕",
        "description": "序章已完成。森林向导正在确认第二处雾流逆转的位置。",
    }


def opening_data(db: Session, player: Player) -> dict[str, Any]:
    progress = _progress(db, player.id)
    tasks = _task_rows(db, player.id)
    stage = _effective_stage(progress, tasks)
    current_map = db.get(MapData, player.current_map) if player.current_map else None
    luna = db.scalar(select(NpcTemplate).where(NpcTemplate.name == LUNA_NAME))
    return {
        "story_key": STORY_KEY,
        "title": STORY_TITLE,
        "stage": stage,
        "started": progress is not None,
        "completed": stage == "complete",
        "completed_at": progress.completed_at if progress else None,
        "objective": _objective(stage, current_map.map_name if current_map else None),
        "tasks": [_task_data(quest, item) for quest, item in tasks],
        "luna_enemy_id": luna.id if luna is not None else None,
        "can_battle_luna": stage == "forest_signal"
        and current_map is not None
        and current_map.map_name == FOREST_NAME,
        "can_complete": stage == "return_village"
        and current_map is not None
        and current_map.map_name == VILLAGE_NAME,
        "intro_lines": [
            "微光森林深处，雾逆着树梢的风向流动。",
            "银色狼耳少女停在一处残缺的月牙刻痕前。",
            "“不是野兽的味道……有人把不属于森林的东西埋进来了。”",
            "同一时刻，你沿着东侧村道抵达晨曦村。",
        ],
    }


def start_opening(db: Session, player: Player) -> dict[str, Any]:
    progress = _progress(db, player.id, lock=True)
    if progress is None:
        progress = PlayerStoryProgress(
            player_id=player.id,
            story_key=STORY_KEY,
            stage="prepare",
            data_json={},
        )
        db.add(progress)
    tasks = _task_rows(db, player.id)
    for quest, item in tasks:
        if item is None:
            db.add(
                PlayerQuest(
                    player_id=player.id,
                    quest_id=quest.id,
                    status="active",
                    progress={},
                )
            )
        elif item.status == "not_started":
            item.status = "active"
    db.commit()
    return opening_data(db, player)


def validate_story_battle(
    db: Session,
    player: Player,
    enemy: NpcTemplate,
) -> None:
    gate = str((enemy.reward or {}).get("story_gate", ""))
    if not gate:
        return
    if gate != STORY_KEY:
        abort(403, "该剧情战斗尚未开放")
    progress = _progress(db, player.id, lock=True)
    tasks = _task_rows(db, player.id)
    stage = _effective_stage(progress, tasks)
    current_map = db.get(MapData, player.current_map) if player.current_map else None
    if progress is None or stage != "forest_signal":
        abort(409, "请先完成晨曦村的入村准备")
    if current_map is None or current_map.map_name != FOREST_NAME:
        abort(409, "需要在微光森林的月光空地发起这场战斗")
    if enemy.name != LUNA_NAME:
        abort(403, "剧情战斗目标不匹配")
    progress.stage = "forest_signal"


def mark_opening_battle_complete(
    db: Session,
    player_id: int,
    enemy: NpcTemplate,
    result: str,
) -> dict[str, Any] | None:
    if enemy.name != LUNA_NAME or str((enemy.reward or {}).get("story_gate", "")) != STORY_KEY:
        return None
    progress = _progress(db, player_id, lock=True)
    if progress is None or result != "victory":
        return None
    if progress.stage == "complete":
        return {"story_key": STORY_KEY, "stage": "complete"}
    progress.stage = "return_village"
    progress.data_json = {**(progress.data_json or {}), "luna_battle_completed": True}
    return {
        "story_key": STORY_KEY,
        "stage": "return_village",
        "message": "露娜留下了三枚共鸣碎片。返回晨曦村向村长汇报。",
    }


def complete_opening(db: Session, player: Player) -> dict[str, Any]:
    progress = _progress(db, player.id, lock=True)
    if progress is None:
        abort(409, "序章尚未开始")
    if progress.stage == "complete":
        result = opening_data(db, player)
        result["completed_now"] = False
        result["gold_reward"] = 0
        return result
    current_map = db.get(MapData, player.current_map) if player.current_map else None
    if progress.stage != "return_village":
        abort(409, "尚未取得露娜的月痕线索")
    if current_map is None or current_map.map_name != VILLAGE_NAME:
        abort(409, "请先返回晨曦村向村长汇报")

    total_gold = 0
    for quest, item in _task_rows(db, player.id):
        if item is None or not _task_ready(item):
            abort(409, f"任务「{quest.title}」尚未完成")
        if item.status != "completed":
            total_gold += max(0, min(int((quest.reward_json or {}).get("gold", 0)), 1_000_000))
            item.status = "completed"
    player.gold += total_gold
    progress.stage = "complete"
    progress.completed_at = datetime.now(UTC)
    progress.data_json = {
        **(progress.data_json or {}),
        "main_quest": "月痕追迹",
    }
    db.commit()
    result = opening_data(db, player)
    result["completed_now"] = True
    result["gold_reward"] = total_gold
    result["main_quest"] = "月痕追迹"
    return result
