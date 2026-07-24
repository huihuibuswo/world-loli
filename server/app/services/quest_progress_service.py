from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PlayerQuest, Quest


def record_quest_objective(
    db: Session,
    player_id: int,
    objective: str,
    *,
    amount: int = 1,
    target_name_field: str | None = None,
    target_name: str | None = None,
    absolute: bool = False,
) -> None:
    rows = db.execute(
        select(PlayerQuest, Quest)
        .join(Quest, Quest.id == PlayerQuest.quest_id)
        .where(
            PlayerQuest.player_id == player_id,
            PlayerQuest.status == "active",
        )
        .with_for_update(of=PlayerQuest)
    ).all()
    for progress, quest in rows:
        config = quest.reward_json or {}
        if config.get("objective") != objective:
            continue
        if target_name_field and str(config.get(target_name_field, "")) != str(target_name or ""):
            continue
        target = max(1, int(config.get("amount", 1)))
        current = max(0, int((progress.progress or {}).get("current", 0)))
        current = max(current, amount) if absolute else current + max(0, amount)
        progress.progress = {
            **(progress.progress or {}),
            "objective": objective,
            "current": min(target, current),
            "target": target,
            "ready": current >= target,
        }
