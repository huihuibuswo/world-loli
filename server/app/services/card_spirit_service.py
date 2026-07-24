from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    CardSpiritTemplate,
    NpcTemplate,
    PlayerCardSpirit,
    PlayerCardSpiritFragment,
)


FRAGMENT_TARGET = 30
MONSTER_FRAGMENT_DROPS = {"normal": 1, "elite": 2, "boss": 3}


def _fragment_data(
    fragment: PlayerCardSpiritFragment,
    template: CardSpiritTemplate,
    owned_spirit_id: int | None,
) -> dict[str, Any]:
    return {
        "template_id": template.id,
        "name": template.name,
        "race": template.race,
        "rarity": template.rarity,
        "type": template.type,
        "story": template.story,
        "avatar": template.avatar,
        "fragment_count": fragment.amount,
        "fragment_target": FRAGMENT_TARGET,
        "can_compose": owned_spirit_id is None and fragment.amount >= FRAGMENT_TARGET,
        "owned_spirit_id": owned_spirit_id,
    }


def list_spirit_fragments(db: Session, player_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        select(PlayerCardSpiritFragment, CardSpiritTemplate, PlayerCardSpirit.id)
        .join(
            CardSpiritTemplate,
            CardSpiritTemplate.id == PlayerCardSpiritFragment.spirit_template_id,
        )
        .outerjoin(
            PlayerCardSpirit,
            and_(
                PlayerCardSpirit.player_id == player_id,
                PlayerCardSpirit.spirit_template_id == PlayerCardSpiritFragment.spirit_template_id,
            ),
        )
        .where(PlayerCardSpiritFragment.player_id == player_id)
        .order_by(CardSpiritTemplate.id)
    ).all()
    return [_fragment_data(fragment, template, owned_id) for fragment, template, owned_id in rows]


def grant_monster_fragments(
    db: Session,
    player_id: int,
    enemy: NpcTemplate,
) -> dict[str, Any] | None:
    config = enemy.battle_deck or {}
    rank = config.get("monster_rank")
    spirit_template_id = config.get("spirit_template_id")
    if rank is None and spirit_template_id is None:
        return None
    if rank not in MONSTER_FRAGMENT_DROPS or not isinstance(spirit_template_id, int):
        abort(500, f"{enemy.name} 的怪物卡灵碎片配置无效")
    template = db.get(CardSpiritTemplate, spirit_template_id)
    if template is None:
        abort(500, f"{enemy.name} 的怪物卡灵模板不存在")

    drop_amount = MONSTER_FRAGMENT_DROPS[rank]
    current_amount = db.scalar(
        pg_insert(PlayerCardSpiritFragment)
        .values(
            player_id=player_id,
            spirit_template_id=template.id,
            amount=drop_amount,
        )
        .on_conflict_do_update(
            index_elements=[
                PlayerCardSpiritFragment.player_id,
                PlayerCardSpiritFragment.spirit_template_id,
            ],
            set_={
                "amount": PlayerCardSpiritFragment.amount + drop_amount,
                "updated_at": func.now(),
            },
        )
        .returning(PlayerCardSpiritFragment.amount)
    )
    if current_amount is None:
        abort(500, "怪物卡灵碎片发放失败")
    return {
        "template_id": template.id,
        "name": template.name,
        "fragment_delta": drop_amount,
        "fragment_count": current_amount,
        "fragment_target": FRAGMENT_TARGET,
        "can_compose": current_amount >= FRAGMENT_TARGET,
    }


def compose_spirit(
    db: Session,
    player_id: int,
    spirit_template_id: int,
) -> dict[str, Any]:
    fragment = db.scalar(
        select(PlayerCardSpiritFragment)
        .where(
            PlayerCardSpiritFragment.player_id == player_id,
            PlayerCardSpiritFragment.spirit_template_id == spirit_template_id,
        )
        .with_for_update()
    )
    owned = db.scalar(
        select(PlayerCardSpirit).where(
            PlayerCardSpirit.player_id == player_id,
            PlayerCardSpirit.spirit_template_id == spirit_template_id,
        )
    )
    if owned is not None:
        return {
            "spirit_id": owned.id,
            "template_id": spirit_template_id,
            "fragment_count": fragment.amount if fragment is not None else 0,
            "fragment_target": FRAGMENT_TARGET,
            "composed": False,
        }
    if fragment is None or fragment.amount < FRAGMENT_TARGET:
        abort(409, f"卡灵碎片不足，需要集齐 {FRAGMENT_TARGET} 枚")

    spirit_id = db.scalar(
        pg_insert(PlayerCardSpirit)
        .values(player_id=player_id, spirit_template_id=spirit_template_id)
        .on_conflict_do_nothing(
            index_elements=[PlayerCardSpirit.player_id, PlayerCardSpirit.spirit_template_id]
        )
        .returning(PlayerCardSpirit.id)
    )
    if spirit_id is None:
        owned = db.scalar(
            select(PlayerCardSpirit).where(
                PlayerCardSpirit.player_id == player_id,
                PlayerCardSpirit.spirit_template_id == spirit_template_id,
            )
        )
        if owned is None:
            abort(409, "卡灵合成状态已变化，请刷新后重试")
        return {
            "spirit_id": owned.id,
            "template_id": spirit_template_id,
            "fragment_count": fragment.amount,
            "fragment_target": FRAGMENT_TARGET,
            "composed": False,
        }

    fragment.amount -= FRAGMENT_TARGET
    return {
        "spirit_id": spirit_id,
        "template_id": spirit_template_id,
        "fragment_count": fragment.amount,
        "fragment_target": FRAGMENT_TARGET,
        "composed": True,
    }
