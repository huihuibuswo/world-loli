from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    CardSpiritTemplate,
    CardTemplate,
    Inventory,
    ItemTemplate,
    NpcFirstVictoryReward,
    NpcGiftRecord,
    NpcTemplate,
    PlantTemplate,
    PlayerCard,
    PlayerCardSpirit,
    PlayerNpcAffection,
    PlayerNpcAffectionReward,
)


MAX_AFFECTION = 100
DAILY_GIFT_LIMIT = 5
SHANGHAI = ZoneInfo("Asia/Shanghai")
LEVEL_THRESHOLDS = (0, 20, 40, 60, 80)
PREFERENCE_RANK = {"disliked": 0, "neutral": 1, "liked": 2, "favorite": 3}
DEFAULT_GIFT_DIALOGUE = {
    "favorite": "这正是我喜欢的。谢谢你特意记住。",
    "liked": "很合我的心意，谢谢。",
    "neutral": "谢谢，我会好好收下。",
    "disliked": "谢谢你的心意，我收下了。",
}


def affection_level(points: int) -> int:
    value = max(0, min(MAX_AFFECTION, points))
    return 1 + max(index for index, threshold in enumerate(LEVEL_THRESHOLDS) if value >= threshold)


def _profile(npc: NpcTemplate) -> dict[str, Any]:
    value = (npc.reward or {}).get("affection_profile")
    return value if isinstance(value, dict) else {}


def _daily_window(now: datetime) -> tuple[datetime, datetime]:
    local_now = now.astimezone(SHANGHAI)
    start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_local.astimezone(UTC), (start_local + timedelta(days=1)).astimezone(UTC)


def _ensure_progress(
    db: Session,
    player_id: int,
    npc_id: int,
    *,
    lock: bool,
) -> PlayerNpcAffection:
    db.execute(
        pg_insert(PlayerNpcAffection)
        .values(player_id=player_id, npc_id=npc_id)
        .on_conflict_do_nothing(
            index_elements=[PlayerNpcAffection.player_id, PlayerNpcAffection.npc_id]
        )
    )
    statement = select(PlayerNpcAffection).where(
        PlayerNpcAffection.player_id == player_id,
        PlayerNpcAffection.npc_id == npc_id,
    )
    if lock:
        statement = statement.with_for_update()
    progress = db.scalar(statement)
    if progress is None:
        abort(500, "NPC 好感进度创建失败")
    return progress


def _claimed_levels(db: Session, player_id: int, npc_id: int) -> list[int]:
    return list(
        db.scalars(
            select(PlayerNpcAffectionReward.milestone_level)
            .where(
                PlayerNpcAffectionReward.player_id == player_id,
                PlayerNpcAffectionReward.npc_id == npc_id,
            )
            .order_by(PlayerNpcAffectionReward.milestone_level)
        ).all()
    )


def affection_data(
    db: Session,
    player_id: int,
    npc_id: int,
    progress: PlayerNpcAffection | None = None,
) -> dict[str, Any]:
    if progress is None:
        progress = db.get(PlayerNpcAffection, (player_id, npc_id))
    points = progress.points if progress is not None else 0
    level = affection_level(points)
    current_threshold = LEVEL_THRESHOLDS[level - 1]
    next_threshold = LEVEL_THRESHOLDS[level] if level < 5 else None
    level_progress = (
        1.0
        if next_threshold is None
        else (points - current_threshold) / (next_threshold - current_threshold)
    )
    return {
        "npc_id": npc_id,
        "points": points,
        "level": level,
        "max_points": MAX_AFFECTION,
        "current_level_points": current_threshold,
        "next_level_points": next_threshold,
        "points_to_next": max(0, next_threshold - points) if next_threshold is not None else 0,
        "level_progress": round(level_progress, 4),
        "conversation_count": progress.conversation_count if progress is not None else 0,
        "battle_count": progress.battle_count if progress is not None else 0,
        "claimed_milestones": _claimed_levels(db, player_id, npc_id),
    }


def _grant_card(
    db: Session,
    player_id: int,
    template: CardTemplate,
) -> None:
    owned = db.scalar(
        select(PlayerCard)
        .where(
            PlayerCard.player_id == player_id,
            PlayerCard.card_template_id == template.id,
            PlayerCard.level == 1,
        )
        .with_for_update()
    )
    if owned is None:
        db.add(PlayerCard(player_id=player_id, card_template_id=template.id))
    else:
        owned.count += 1


def _grant_milestone(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
    milestone_level: int,
) -> dict[str, Any] | None:
    profile = _profile(npc)
    reward_type: Literal["card", "card_spirit"]
    card_template: CardTemplate | None = None
    spirit_template: CardSpiritTemplate | None = None
    if milestone_level < 5:
        template_id = (npc.reward or {}).get("first_victory_card_template_id")
        card_template = db.get(CardTemplate, int(template_id)) if template_id else None
        if card_template is None:
            abort(500, f"{npc.name} 的专属卡牌奖励未配置")
        reward_type = "card"
    else:
        template_id = profile.get("card_spirit_template_id")
        spirit_template = db.get(CardSpiritTemplate, int(template_id)) if template_id else None
        if spirit_template is None:
            abort(500, f"{npc.name} 的卡灵奖励未配置")
        reward_type = "card_spirit"

    reward_id = db.scalar(
        pg_insert(PlayerNpcAffectionReward)
        .values(
            player_id=player_id,
            npc_id=npc.id,
            milestone_level=milestone_level,
            reward_type=reward_type,
            card_template_id=card_template.id if card_template else None,
            spirit_template_id=spirit_template.id if spirit_template else None,
        )
        .on_conflict_do_nothing(
            index_elements=[
                PlayerNpcAffectionReward.player_id,
                PlayerNpcAffectionReward.npc_id,
                PlayerNpcAffectionReward.milestone_level,
            ]
        )
        .returning(PlayerNpcAffectionReward.id)
    )
    if reward_id is None:
        return None

    if card_template is not None:
        _grant_card(db, player_id, card_template)
        if milestone_level == 1:
            db.execute(
                pg_insert(NpcFirstVictoryReward)
                .values(
                    player_id=player_id,
                    npc_id=npc.id,
                    card_template_id=card_template.id,
                )
                .on_conflict_do_nothing(
                    index_elements=[
                        NpcFirstVictoryReward.player_id,
                        NpcFirstVictoryReward.npc_id,
                    ]
                )
            )
        return {
            "milestone_level": milestone_level,
            "type": "card",
            "template_id": card_template.id,
            "name": card_template.name,
            "count": 1,
        }

    assert spirit_template is not None
    db.execute(
        pg_insert(PlayerCardSpirit)
        .values(player_id=player_id, spirit_template_id=spirit_template.id)
        .on_conflict_do_nothing(
            index_elements=[PlayerCardSpirit.player_id, PlayerCardSpirit.spirit_template_id]
        )
    )
    return {
        "milestone_level": milestone_level,
        "type": "card_spirit",
        "template_id": spirit_template.id,
        "name": spirit_template.name,
        "count": 1,
    }


def apply_affection(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
    source: Literal["chat", "battle", "gift"],
    *,
    gift_points: int = 0,
) -> dict[str, Any]:
    progress = _ensure_progress(db, player_id, npc.id, lock=True)
    before = progress.points
    old_level = affection_level(before)
    first_battle = source == "battle" and progress.battle_count == 0
    if source == "chat":
        requested_gain = 2
        progress.conversation_count += 1
    elif source == "battle":
        requested_gain = max(0, 1 - before) if first_battle else 5
        progress.battle_count += 1
    else:
        requested_gain = max(0, gift_points)

    progress.points = min(MAX_AFFECTION, before + requested_gain)
    new_level = affection_level(progress.points)
    milestone_levels = list(range(max(2, old_level + 1), new_level + 1))
    if first_battle and new_level >= 1:
        milestone_levels.insert(0, 1)
    rewards = [
        reward
        for level in milestone_levels
        if (reward := _grant_milestone(db, player_id, npc, level)) is not None
    ]
    return {
        "points_before": before,
        "points_after": progress.points,
        "points_gained": progress.points - before,
        "old_level": old_level,
        "new_level": new_level,
        "leveled_up": new_level > old_level,
        "rewards": rewards,
        "affection": affection_data(db, player_id, npc.id, progress),
    }


def _preference(
    template: PlantTemplate | ItemTemplate,
    npc: NpcTemplate,
    *,
    template_kind: Literal["plant", "item"],
) -> tuple[str, str]:
    profile = _profile(npc)
    names = {
        key: {str(value) for value in profile.get(f"{key}_{template_kind}_names", [])}
        for key in ("favorite", "liked", "disliked")
    }
    tags = {
        key: {str(value) for value in profile.get(f"{key}_tags", [])}
        for key in ("favorite", "liked", "disliked")
    }
    plant_tags = {str(value) for value in (template.tags or [])}
    matched = [
        preference
        for preference in ("favorite", "liked", "disliked")
        if template.name in names[preference] or plant_tags.intersection(tags[preference])
    ]
    preference = max(matched, key=lambda item: PREFERENCE_RANK[item]) if matched else "neutral"
    dialogue = profile.get("gift_dialogue")
    custom = dialogue.get(preference) if isinstance(dialogue, dict) else None
    return preference, str(custom or DEFAULT_GIFT_DIALOGUE[preference])


def npc_gift_options(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    start, end = _daily_window(now)
    used = db.scalar(
        select(func.count(NpcGiftRecord.id)).where(
            NpcGiftRecord.player_id == player_id,
            NpcGiftRecord.npc_id == npc.id,
            NpcGiftRecord.gifted_at >= start,
            NpcGiftRecord.gifted_at < end,
        )
    ) or 0
    rows = db.execute(
        select(Inventory, PlantTemplate)
        .join(PlantTemplate, PlantTemplate.id == Inventory.item_id)
        .where(
            Inventory.player_id == player_id,
            Inventory.item_type == "plant",
            Inventory.amount > 0,
        )
    ).all()
    plants = []
    for inventory, template in rows:
        preference, _ = _preference(template, npc, template_kind="plant")
        plants.append(
            {
                "id": template.id,
                "name": template.name,
                "rarity": template.rarity,
                "base_affection": template.base_affection,
                "tags": template.tags or [],
                "description": template.description,
                "icon": template.icon,
                "respawn_seconds": template.respawn_seconds,
                "amount": inventory.amount,
                "preference": preference,
            }
        )
    plants.sort(key=lambda item: (-PREFERENCE_RANK[item["preference"]], item["id"]))
    item_rows = db.execute(
        select(Inventory, ItemTemplate)
        .join(ItemTemplate, ItemTemplate.id == Inventory.item_id)
        .where(
            Inventory.player_id == player_id,
            Inventory.item_type == "item",
            Inventory.amount > 0,
        )
    ).all()
    items = []
    for inventory, template in item_rows:
        preference, _ = _preference(template, npc, template_kind="item")
        items.append(
            {
                "id": template.id,
                "name": template.name,
                "category": template.category,
                "rarity": template.rarity,
                "base_affection": template.base_affection,
                "tags": template.tags or [],
                "description": template.description,
                "icon": template.icon,
                "amount": inventory.amount,
                "preference": preference,
            }
        )
    items.sort(key=lambda item: (-PREFERENCE_RANK[item["preference"]], item["id"]))
    return {
        "remaining_gifts": max(0, DAILY_GIFT_LIMIT - used),
        "plants": plants,
        "items": items,
    }


def give_npc_gift(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
    plant_template_id: int | None = None,
    item_template_id: int | None = None,
) -> dict[str, Any]:
    progress = _ensure_progress(db, player_id, npc.id, lock=True)
    if progress.points >= MAX_AFFECTION:
        abort(409, "与该 NPC 的好感已达到上限")

    is_item = item_template_id is not None
    template = (
        db.get(ItemTemplate, item_template_id)
        if is_item
        else db.get(PlantTemplate, plant_template_id)
    )
    if template is None:
        abort(404, "礼物不存在")
    item_type = "item" if is_item else "plant"
    inventory = db.scalar(
        select(Inventory)
        .where(
            Inventory.player_id == player_id,
            Inventory.item_id == template.id,
            Inventory.item_type == item_type,
        )
        .with_for_update()
    )
    if inventory is None or inventory.amount < 1:
        abort(409, "背包中没有该礼物")

    now = datetime.now(UTC)
    start, end = _daily_window(now)
    used = db.scalar(
        select(func.count(NpcGiftRecord.id)).where(
            NpcGiftRecord.player_id == player_id,
            NpcGiftRecord.npc_id == npc.id,
            NpcGiftRecord.gifted_at >= start,
            NpcGiftRecord.gifted_at < end,
        )
    ) or 0
    if used >= DAILY_GIFT_LIMIT:
        abort(429, "该 NPC 今天已经收下 5 份礼物")

    preference, dialogue = _preference(
        template,
        npc,
        template_kind="item" if is_item else "plant",
    )
    raw_gain = 1 if preference == "disliked" else template.base_affection + {
        "favorite": 2,
        "liked": 1,
        "neutral": 0,
    }[preference]
    gain = min(6, MAX_AFFECTION - progress.points, max(1, raw_gain))
    inventory.amount -= 1
    db.add(
        NpcGiftRecord(
            player_id=player_id,
            npc_id=npc.id,
            plant_template_id=None if is_item else template.id,
            item_template_id=template.id if is_item else None,
            preference=preference,
            affection_gained=gain,
            gifted_at=now,
        )
    )
    change = apply_affection(db, player_id, npc, "gift", gift_points=gain)
    return {
        "npc_id": npc.id,
        "gift_type": item_type,
        "plant_template_id": None if is_item else template.id,
        "item_template_id": template.id if is_item else None,
        "preference": preference,
        "remaining_amount": inventory.amount,
        "remaining_gifts": DAILY_GIFT_LIMIT - used - 1,
        "dialogue": dialogue,
        "affection_change": change,
        "affection": change["affection"],
        "rewards": change["rewards"],
    }
