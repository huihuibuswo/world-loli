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
GUIDE_NAME = "森林向导"
CHIEF_NAME = "晨曦村村长"
SHADOW_NAME = "雾痕兽影"
VILLAGE_NAME = "晨曦村"
FOREST_NAME = "微光森林"
TASK_TITLES = ("村道补给", "林缘踏查", "实战准备")
STAGES = {"arrival", "meet_chief", "prepare", "forest_signal", "return_village", "complete"}
MOON_TRACE_STAGES = {
    "moon_trace_accept",
    "moon_trace_guide",
    "moon_trace_evidence",
    "moon_trace_battle",
    "moon_trace_return",
    "moon_trace_stage1_complete",
}
EVIDENCE = {
    "moonlight_flora": {
        "name": "异常闭合的月光植物",
        "description": "花瓣在雾流逆转时同时闭合，根部没有自然病变。",
    },
    "broken_wolf_tracks": {
        "name": "突然中断的狼族足迹",
        "description": "足迹在开阔地中央消失，没有折返或跃离痕迹。",
    },
    "broken_moon_mist_core": {
        "name": "附着断月纹的雾核",
        "description": "雾核表面排列着无法自然形成的断月纹。",
    },
}
LUNA_BATTLE_DIALOGUE = [
    {"speaker": "露娜", "text": "别靠近！你身上的月牙共鸣正在牵动我的旧伤。你和雾袭者是什么关系？"},
    {"speaker": "主角", "text": "我刚离开晨曦村，也在追查逆流的雾。你已经受伤了，先停下来。"},
    {"speaker": "露娜", "text": "相同的纹路刚刚伤了我和狼族领地。用你的基础卡牌证明这道回路没有污染。"},
]
LUNA_CONTRACT_DIALOGUE = [
    {"speaker": "露娜", "text": "咳……旧伤裂开了。月痕还在吞噬我的意识……"},
    {"speaker": "主角", "text": "别再动了。我会用基础卡牌的共鸣先稳住它。"},
    {"speaker": "露娜", "text": "你的回路没有污染……是我认错了人。可我已经走不回安全的地方。"},
    {"speaker": "露娜", "text": "收下这道月痕。它会化成我的卡灵投影，代替现在的我与你并肩。"},
    {"speaker": "露娜", "text": "污染源还在森林深处……替我追下去。这是我交给你的长期委托——月痕追迹。"},
    {"speaker": "主角", "text": "先别说了。我带你回晨曦村疗伤。"},
    {"speaker": "露娜", "text": "那就……拜托你了。"},
]
OPENING_COMPLETION_DIALOGUE = [
    {"speaker": "村长", "text": "先救人，再谈月痕。向导，把东侧疗养间打开。"},
    {"speaker": "森林向导", "text": "她会留在疗养点稳定旧伤，短时间内不能再进入森林。"},
    {"speaker": "露娜", "text": "实体的我会留在这里疗养。卡灵投影仍会代替现在的我与你并肩。"},
    {"speaker": "露娜", "text": "等我醒来，到疗养点找我。第二处逆流雾源还需要确认。"},
    {"speaker": "系统", "text": "序章《雾中月痕》完成。长期主线《月痕追迹》已发布。"},
]
SHADOW_BATTLE_DIALOGUE = [
    {"speaker": "系统", "text": "三处证据同时发出银白微光，雾核凝成一头没有气味的兽影。"},
    {"speaker": "主角", "text": "它在模仿狼族的力量。击散它，才能留下完整的断月纹记录。"},
]
SHADOW_VICTORY_DIALOGUE = [
    {"speaker": "系统", "text": "雾痕兽影崩解，留下无法自然形成的断月纹排列。调查记录已保存。"},
    {"speaker": "主角", "text": "证据已经足够。该回晨曦村向露娜回报了。"},
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


def _moon_trace_stage(progress: PlayerStoryProgress | None) -> str | None:
    if progress is None or progress.stage != "complete":
        return None
    value = str((progress.data_json or {}).get("moon_trace_stage", "moon_trace_accept"))
    return value if value in MOON_TRACE_STAGES else "moon_trace_accept"


def _moon_trace_objective(stage: str, evidence_count: int) -> dict[str, str]:
    if stage == "moon_trace_accept":
        return {
            "title": "与疗养中的露娜交谈",
            "description": "前往晨曦村东侧疗养点，接取《逆流雾源》。",
        }
    if stage == "moon_trace_guide":
        return {
            "title": "向森林向导确认雾流",
            "description": "请向导标记第二处雾流逆转位置。",
        }
    if stage == "moon_trace_evidence":
        return {
            "title": f"调查三处固定证据（{evidence_count}/3）",
            "description": "前往微光森林调查月光植物、狼族足迹与断月雾核。",
        }
    if stage == "moon_trace_battle":
        return {
            "title": "击败雾痕兽影",
            "description": "三处证据已经共鸣。击败污染凝成的兽影并保存调查记录。",
        }
    if stage == "moon_trace_return":
        return {
            "title": "返回晨曦村向露娜回报",
            "description": "把断月纹调查记录交给疗养中的露娜。",
        }
    return {
        "title": "追查操纵断月纹的人",
        "description": "《逆流雾源》已完成。露娜疗养期间，继续追查幕后操纵者。",
    }


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
    if stage == "meet_chief":
        return {
            "title": "与晨曦村村长对话",
            "description": "前往村庄中央与村长交谈，领取三项入村准备。",
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
            "title": "带露娜返回晨曦村疗伤",
            "description": "护送负伤的实体露娜返回晨曦村疗养点。"
            if current_map_name != VILLAGE_NAME
            else "露娜已抵达晨曦村。请让村长和向导安排疗养。",
        }
    return {
        "title": "月痕追迹",
        "description": "序章已完成。前往疗养点继续露娜托付的长期调查。",
    }


def opening_data(db: Session, player: Player) -> dict[str, Any]:
    progress = _progress(db, player.id)
    tasks = _task_rows(db, player.id)
    stage = _effective_stage(progress, tasks)
    current_map = db.get(MapData, player.current_map) if player.current_map else None
    luna = db.scalar(select(NpcTemplate).where(NpcTemplate.name == LUNA_NAME))
    shadow = db.scalar(select(NpcTemplate).where(NpcTemplate.name == SHADOW_NAME))
    data = progress.data_json if progress else {}
    moon_stage = _moon_trace_stage(progress)
    evidence_ids = sorted(
        item for item in (data or {}).get("moon_trace_evidence", []) if item in EVIDENCE
    )
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
        "shadow_enemy_id": shadow.id if shadow is not None else None,
        "can_battle_luna": stage == "forest_signal"
        and current_map is not None
        and current_map.map_name == FOREST_NAME,
        "can_complete": stage == "return_village"
        and current_map is not None
        and current_map.map_name == VILLAGE_NAME,
        "intro_lines": [
            "微光森林深处，雾逆着树梢的风向流动。",
            "银色狼耳少女捂着受伤的肩侧，踉跄着停在残缺月牙刻痕前。",
            "断月纹仍在追赶她，失控月痕正沿旧伤侵入意识。",
            "“不是野兽的味道……断月纹还在追我。”",
            "同一时刻，你沿着东侧村道抵达晨曦村。",
        ],
        "main_quest": (
            {
                "title": "月痕追迹",
                "chapter": "逆流雾源",
                "stage": moon_stage,
                "objective": _moon_trace_objective(moon_stage, len(evidence_ids)),
                "evidence": [
                    {
                        "id": evidence_id,
                        **EVIDENCE[evidence_id],
                        "completed": evidence_id in evidence_ids,
                    }
                    for evidence_id in EVIDENCE
                ],
                "evidence_count": len(evidence_ids),
                "evidence_target": len(EVIDENCE),
                "shadow_completed": bool((data or {}).get("moon_trace_shadow_completed")),
                "stage1_completed": moon_stage == "moon_trace_stage1_complete",
            }
            if moon_stage is not None
            else None
        ),
    }


def opening_battle_intro(enemy: NpcTemplate) -> dict[str, Any] | None:
    if str((enemy.reward or {}).get("story_gate", "")) != STORY_KEY:
        return None
    if enemy.name == SHADOW_NAME:
        return {
            "story_key": STORY_KEY,
            "event": "moon_trace_shadow",
            "message": "三处固定证据共鸣，污染凝成了雾痕兽影。",
            "dialogue": SHADOW_BATTLE_DIALOGUE,
        }
    if enemy.name != LUNA_NAME:
        return None
    return {
        "story_key": STORY_KEY,
        "event": "luna_resonance",
        "message": "负伤露娜把玩家误认为污染源，要求用基础卡牌的稳定回路证明清白。",
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
            stage="meet_chief",
            data_json={},
        )
        db.add(progress)
    db.commit()
    return opening_data(db, player)


def opening_npc_context(
    db: Session,
    player: Player,
    npc: NpcTemplate,
) -> dict[str, Any] | None:
    progress = _progress(db, player.id)
    opening_stage = _effective_stage(progress, _task_rows(db, player.id))
    moon_stage = _moon_trace_stage(progress)
    if npc.name == CHIEF_NAME and opening_stage == "meet_chief":
        return {
            "dialogue": [
                "先确认一下，你没有受伤吧？东侧森林这几天不太安稳。",
                "入村前，先熟悉这里的补给、训练和林缘记录。完成这三项准备，你才有能力调查那股逆流的雾。",
                "去吧。村里的人会协助你，做完后再来告诉我你在东边看见了什么。",
            ],
            "actions": ["dialog"],
            "story_action": {
                "action": "accept_village_preparation",
                "label": "领取三项入村准备",
            },
        }
    if npc.name == LUNA_NAME and opening_stage == "forest_signal":
        return {
            "dialogue": [
                "你身上有那道月痕的味道。别再往前——它正在牵动我的伤口。",
                "相同的断月纹刚刚袭击了我，也正在伤害狼族领地。",
                "如果你不是污染者，就用基础卡牌的稳定回路证明给我看。",
            ],
            "actions": ["dialog", "battle"],
            "story_action": None,
        }
    if npc.name == LUNA_NAME and moon_stage is not None:
        if moon_stage == "moon_trace_accept":
            dialogue = [
                "旧伤已经暂时稳定，但我还不能离开疗养点。",
                "第二处逆流雾源还在。替我确认三件事：花、足迹，还有那枚雾核。",
                "先去找森林向导。他能标出雾流第二次逆转的位置。",
            ]
            action = {"action": "accept_stage1", "label": "接取《逆流雾源》"}
        elif moon_stage == "moon_trace_return":
            dialogue = [
                "你带回来的记录里有断月纹的排列。把雾痕兽影消散前的变化告诉我。",
                "这不是野兽留下的痕迹。有人在用断月纹模仿狼族的力量。",
                "等我能重新站起来，我们再追那个没有气味的人。",
            ]
            action = {"action": "report_stage1", "label": "提交调查记录"}
        elif moon_stage == "moon_trace_stage1_complete":
            dialogue = [
                "《逆流雾源》的记录已经交给向导。",
                "污染不是自然形成的。下一步，是追查操纵断月纹的人。",
            ]
            action = None
        else:
            dialogue = [
                "卡灵投影会代替现在的我与你并肩，实体的我还需要留在这里疗养。",
                "按我们确认的步骤行动。不要追逐声音，只记录能被重复观察的证据。",
            ]
            action = None
        return {"dialogue": dialogue, "actions": ["dialog"], "story_action": action}
    if npc.name == GUIDE_NAME and moon_stage == "moon_trace_guide":
        return {
            "dialogue": [
                "我确认过了：风往东，第二处雾流却在月光空地以南逆转。",
                "我会标出三处固定证据。逐一核对，不要被林中的狼嚎带偏。",
            ],
            "actions": ["dialog"],
            "story_action": {"action": "confirm_guide", "label": "确认调查位置"},
        }
    if npc.name == SHADOW_NAME and moon_stage == "moon_trace_battle":
        return {
            "dialogue": [
                "雾核吞下三处证据的共鸣，凝成了一头没有气味的兽影。",
                "它并非真正的狼族。击散它，留下完整的断月纹记录。",
            ],
            "actions": ["dialog", "battle"],
            "story_action": None,
        }
    return None


def _require_npc(db: Session, npc_id: int | None, name: str) -> NpcTemplate:
    npc = db.get(NpcTemplate, npc_id) if npc_id is not None else None
    if npc is None or npc.name != name:
        abort(422, "剧情互动目标不匹配")
    return npc


def accept_village_preparation(
    db: Session,
    player: Player,
    *,
    npc_id: int,
) -> dict[str, Any]:
    progress = _progress(db, player.id, lock=True)
    if progress is None:
        abort(409, "请先观看冷开场并进入晨曦村")
    _require_npc(db, npc_id, CHIEF_NAME)

    current_map = db.get(MapData, player.current_map) if player.current_map else None
    if current_map is None or current_map.map_name != VILLAGE_NAME:
        abort(409, "请在晨曦村与村长交谈")
    if progress.stage != "meet_chief":
        if progress.stage in {"prepare", "forest_signal", "return_village", "complete"}:
            return opening_data(db, player)
        abort(409, "当前阶段不能领取入村准备任务")

    for quest, item in _task_rows(db, player.id):
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
    progress.stage = "prepare"
    db.commit()
    return opening_data(db, player)


def perform_opening_action(
    db: Session,
    player: Player,
    *,
    action: str,
    npc_id: int | None,
    evidence_id: str | None,
) -> dict[str, Any]:
    progress = _progress(db, player.id, lock=True)
    if progress is None or progress.stage != "complete":
        abort(409, "请先完成露娜返村疗养剧情")
    current_map = db.get(MapData, player.current_map) if player.current_map else None
    current_map_name = current_map.map_name if current_map else None
    data = dict(progress.data_json or {})
    moon_stage = _moon_trace_stage(progress)

    if action == "accept_stage1":
        _require_npc(db, npc_id, LUNA_NAME)
        if current_map_name != VILLAGE_NAME:
            abort(409, "请在晨曦村疗养点与露娜交谈")
        if moon_stage == "moon_trace_accept":
            data["moon_trace_stage"] = "moon_trace_guide"
            data["moon_trace_stage1_accepted"] = True
    elif action == "confirm_guide":
        _require_npc(db, npc_id, GUIDE_NAME)
        if current_map_name != VILLAGE_NAME:
            abort(409, "请在晨曦村向森林向导确认位置")
        if moon_stage == "moon_trace_guide":
            data["moon_trace_stage"] = "moon_trace_evidence"
            data["moon_trace_guide_confirmed"] = True
        elif moon_stage == "moon_trace_accept":
            abort(409, "请先向疗养中的露娜接取《逆流雾源》")
    elif action == "inspect_evidence":
        if evidence_id not in EVIDENCE:
            abort(422, "调查证据不存在")
        if current_map_name != FOREST_NAME:
            abort(409, "请前往微光森林调查证据")
        completed = {
            item for item in data.get("moon_trace_evidence", []) if item in EVIDENCE
        }
        if moon_stage not in {"moon_trace_evidence", "moon_trace_battle"}:
            if evidence_id in completed and moon_stage in {
                "moon_trace_return",
                "moon_trace_stage1_complete",
            }:
                return opening_data(db, player)
            abort(409, "当前阶段不能调查该证据")
        completed.add(evidence_id)
        data["moon_trace_evidence"] = sorted(completed)
        if len(completed) == len(EVIDENCE):
            data["moon_trace_stage"] = "moon_trace_battle"
            data["moon_trace_evidence_completed"] = True
    elif action == "report_stage1":
        _require_npc(db, npc_id, LUNA_NAME)
        if current_map_name != VILLAGE_NAME:
            abort(409, "请返回晨曦村疗养点向露娜回报")
        if moon_stage == "moon_trace_return":
            data["moon_trace_stage"] = "moon_trace_stage1_complete"
            data["moon_trace_stage1_completed"] = True
            data["moon_trace_next_objective"] = "追查操纵断月纹的人"
        elif moon_stage != "moon_trace_stage1_complete":
            abort(409, "请先完成雾痕兽影调查")
    else:
        abort(422, "未知的月痕追迹动作")

    progress.data_json = data
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
    if enemy.name == LUNA_NAME:
        if progress is None or stage != "forest_signal":
            abort(409, "请先完成晨曦村的入村准备")
        if current_map is None or current_map.map_name != FOREST_NAME:
            abort(409, "需要在微光森林的月光空地发起这场战斗")
        progress.stage = "forest_signal"
        return
    if enemy.name == SHADOW_NAME:
        if progress is None or _moon_trace_stage(progress) != "moon_trace_battle":
            abort(409, "请先完成三处固定证据调查")
        if current_map is None or current_map.map_name != FOREST_NAME:
            abort(409, "需要在微光森林发起雾痕兽影战斗")
        return
    abort(403, "剧情战斗目标不匹配")


def mark_opening_battle_complete(
    db: Session,
    player_id: int,
    enemy: NpcTemplate,
    result: str,
) -> dict[str, Any] | None:
    if str((enemy.reward or {}).get("story_gate", "")) != STORY_KEY:
        return None
    progress = _progress(db, player_id, lock=True)
    if progress is None or result != "victory":
        return None
    if enemy.name == SHADOW_NAME:
        moon_stage = _moon_trace_stage(progress)
        if moon_stage not in {
            "moon_trace_battle",
            "moon_trace_return",
            "moon_trace_stage1_complete",
        }:
            return None
        data = dict(progress.data_json or {})
        if moon_stage == "moon_trace_battle":
            data["moon_trace_stage"] = "moon_trace_return"
            data["moon_trace_shadow_completed"] = True
            data["moon_trace_investigation_record"] = "断月纹排列记录"
            progress.data_json = data
        return {
            "story_key": STORY_KEY,
            "stage": "complete",
            "event": "moon_trace_shadow",
            "message": "雾痕兽影已经消散，确定性调查记录已保存。返回晨曦村向露娜回报。",
            "dialogue": SHADOW_VICTORY_DIALOGUE,
        }
    if enemy.name != LUNA_NAME:
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
        "luna_injured": True,
        "luna_recovery_state": "returning_to_village",
        "luna_returning_to_village": True,
        "main_quest": "月痕追迹",
    }
    return {
        "story_key": STORY_KEY,
        "stage": "return_village",
        "event": "luna_contract",
        "reward_kind": "fixed_newbie_reward",
        "message": "露娜把自身月痕凝成共鸣卡灵投影。完整「狼娘·露娜」卡灵与「月牙撕裂」×2 已加入收藏和启用套牌；实体露娜仍需带回村疗伤。",
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
        "luna_injured": True,
        "luna_recovery_state": "recuperating",
        "luna_returning_to_village": False,
        "moon_trace_stage": "moon_trace_accept",
    }
    db.commit()
    result = opening_data(db, player)
    result["completed_now"] = True
    result["gold_reward"] = total_gold
    result["completion_dialogue"] = OPENING_COMPLETION_DIALOGUE
    if contract_reward is not None:
        result["contract_reward"] = contract_reward
    return result
