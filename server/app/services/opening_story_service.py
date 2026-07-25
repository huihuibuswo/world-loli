from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    CardSpiritTemplate,
    CardTemplate,
    Deck,
    DeckCard,
    MapData,
    NpcTemplate,
    Player,
    PlayerCard,
    PlayerCardSpirit,
    PlayerQuest,
    PlayerStoryProgress,
    Quest,
)


STORY_KEY = "opening_moon_scar"
STORY_TITLE = "雾中月痕"
LUNA_NAME = "狼娘·露娜"
LUNA_CARD_NAME = "月牙撕裂"
VILLAGE_NAME = "晨曦村"
FOREST_NAME = "微光森林"
TASK_TITLES = ("村道补给", "林缘踏查", "实战准备")
STAGES = {"arrival", "prepare", "forest_signal", "return_village", "complete"}
LUNA_BATTLE_DIALOGUE = [
    {"speaker": "露娜", "text": "别靠近！你身上的共鸣正在牵动失控月痕……你也是污染源吗？"},
    {"speaker": "主角", "text": "我没有卡灵，也不是污染源。我的基础卡牌形成了稳定回路，也许能替你承接这股力量。"},
    {"speaker": "露娜", "text": "那就让我亲自确认。若你的共鸣真能稳住月痕，我会回应它。"},
]
LUNA_CONTRACT_DIALOGUE = [
    {"speaker": "露娜", "text": "停下……那道月痕还在吞噬我的意识。"},
    {"speaker": "主角", "text": "我的卡组里没有卡灵，但这份力量至少还能替你稳住它。"},
    {"speaker": "露娜", "text": "没有卡灵，却能回应我的月光……原来你不是污染森林的人。"},
    {"speaker": "露娜", "text": "收下我的月痕吧。不是战利品，是我自己的选择。"},
    {"speaker": "露娜", "text": "你的共鸣，我回应了。从现在起，我会以完整卡灵与你并肩。下一次，让我们站在同一边。"},
]


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
            "title": "汇报月痕契约",
            "description": "返回晨曦村，向村长汇报露娜与失控月痕。"
            if current_map_name != VILLAGE_NAME
            else "露娜已经成为你的卡灵，可以向村长说明月光空地的真相。",
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
            "失控的月痕正侵入她的意识，她却仍挡在通往村庄的方向。",
            "“不是野兽的味道……有人把不属于森林的东西埋进来了。”",
            "同一时刻，你沿着东侧村道抵达晨曦村。",
        ],
    }


def opening_battle_intro(enemy: NpcTemplate) -> dict[str, Any] | None:
    if (
        enemy.name != LUNA_NAME
        or str((enemy.reward or {}).get("story_gate", "")) != STORY_KEY
    ):
        return None
    return {
        "story_key": STORY_KEY,
        "event": "luna_resonance",
        "message": "玩家的基础卡牌与失控月痕产生共鸣，露娜决定亲自确认这份回应。",
        "dialogue": LUNA_BATTLE_DIALOGUE,
    }


def _grant_luna_contract(db: Session, player_id: int) -> dict[str, Any]:
    spirit_template = db.scalar(
        select(CardSpiritTemplate).where(CardSpiritTemplate.name == LUNA_NAME)
    )
    card_template = db.scalar(select(CardTemplate).where(CardTemplate.name == LUNA_CARD_NAME))
    if spirit_template is None or card_template is None:
        abort(500, "露娜契约依赖的卡灵或卡牌模板不存在")
    if card_template.source_spirit_id != spirit_template.id:
        abort(500, "月牙撕裂未绑定露娜卡灵模板")

    active_deck = db.scalar(
        select(Deck)
        .where(Deck.player_id == player_id, Deck.is_active.is_(True))
        .with_for_update()
    )
    if active_deck is None:
        abort(409, "请先设置一副启用套牌再完成露娜契约")

    spirit_id = db.scalar(
        pg_insert(PlayerCardSpirit)
        .values(player_id=player_id, spirit_template_id=spirit_template.id)
        .on_conflict_do_nothing(
            index_elements=[PlayerCardSpirit.player_id, PlayerCardSpirit.spirit_template_id]
        )
        .returning(PlayerCardSpirit.id)
    )
    spirit_created = spirit_id is not None
    if spirit_id is None:
        spirit_id = db.scalar(
            select(PlayerCardSpirit.id).where(
                PlayerCardSpirit.player_id == player_id,
                PlayerCardSpirit.spirit_template_id == spirit_template.id,
            )
        )
    if spirit_id is None:
        abort(500, "露娜卡灵发放失败")

    card_row = db.execute(
        pg_insert(PlayerCard)
        .values(
            player_id=player_id,
            card_template_id=card_template.id,
            level=1,
            count=2,
        )
        .on_conflict_do_update(
            index_elements=[PlayerCard.player_id, PlayerCard.card_template_id, PlayerCard.level],
            set_={"count": func.greatest(PlayerCard.count, 2)},
        )
        .returning(PlayerCard.id, PlayerCard.count)
    ).one_or_none()
    if card_row is None:
        abort(500, "月牙撕裂发放失败")
    card_id, card_count = card_row

    previous_deck_amount = db.scalar(
        select(DeckCard.amount)
        .where(DeckCard.deck_id == active_deck.id, DeckCard.card_id == card_id)
        .with_for_update()
    )
    deck_amount = db.scalar(
        pg_insert(DeckCard)
        .values(
            deck_id=active_deck.id,
            card_id=card_id,
            player_id=player_id,
            amount=2,
        )
        .on_conflict_do_update(
            index_elements=[DeckCard.deck_id, DeckCard.card_id],
            set_={"amount": func.greatest(DeckCard.amount, 2)},
        )
        .returning(DeckCard.amount)
    )
    if deck_amount is None:
        abort(500, "月牙撕裂加入启用套牌失败")

    return {
        "spirit": {
            "id": spirit_id,
            "template_id": spirit_template.id,
            "name": spirit_template.name,
            "created": spirit_created,
        },
        "card": {
            "id": card_id,
            "template_id": card_template.id,
            "name": card_template.name,
            "count": card_count,
            "deck_amount": deck_amount,
            "added_to_active_deck": previous_deck_amount is None or previous_deck_amount < 2,
        },
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
    contract_reward = _grant_luna_contract(db, player_id)
    progress.stage = "return_village"
    progress.data_json = {
        **(progress.data_json or {}),
        "luna_battle_completed": True,
        "luna_contract_completed": True,
        "luna_contract_version": 1,
    }
    return {
        "story_key": STORY_KEY,
        "stage": "return_village",
        "event": "luna_contract",
        "reward_kind": "fixed_newbie_reward",
        "message": "固定新手奖励已到账：完整「狼娘·露娜」卡灵与「月牙撕裂」×2 已直接加入你的收藏和启用套牌。",
        "dialogue": LUNA_CONTRACT_DIALOGUE,
        "contract_reward": contract_reward,
    }


def complete_opening(db: Session, player: Player) -> dict[str, Any]:
    progress = _progress(db, player.id, lock=True)
    if progress is None:
        abort(409, "序章尚未开始")
    contract_reward = None
    if progress.stage in {"return_village", "complete"} and not bool(
        (progress.data_json or {}).get("luna_contract_completed")
    ):
        contract_reward = _grant_luna_contract(db, player.id)
        progress.data_json = {
            **(progress.data_json or {}),
            "luna_battle_completed": True,
            "luna_contract_completed": True,
            "luna_contract_version": 1,
        }
    if progress.stage == "complete":
        db.commit()
        result = opening_data(db, player)
        result["completed_now"] = False
        result["gold_reward"] = 0
        if contract_reward is not None:
            result["contract_reward"] = contract_reward
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
    if contract_reward is not None:
        result["contract_reward"] = contract_reward
    return result
