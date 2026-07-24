from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.responses import abort
from app.models import (
    Inventory,
    ItemTemplate,
    MapData,
    NpcPurchaseRecord,
    NpcShopItem,
    NpcTemplate,
    PlantTemplate,
    Player,
    PlayerCard,
    PlayerNpcAffection,
    PlayerPlantNode,
    PlayerQuest,
    Quest,
    CardTemplate,
)
from app.services.card_service import (
    card_data,
    card_has_upgrade,
    card_upgrade_cost,
    upgrade_player_card,
)
from app.services.npc_affection_service import affection_level
from app.services.quest_progress_service import record_quest_objective


SHANGHAI = ZoneInfo("Asia/Shanghai")


def _daily_window(now: datetime) -> tuple[datetime, datetime]:
    local_now = now.astimezone(SHANGHAI)
    start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_local.astimezone(UTC), (start_local + timedelta(days=1)).astimezone(UTC)


def _service_type(npc: NpcTemplate) -> str | None:
    value = (npc.reward or {}).get("service_type")
    return str(value) if value in {"shop", "quest", "guide", "training"} else None


def _player_affection_level(db: Session, player_id: int, npc_id: int) -> int:
    progress = db.get(PlayerNpcAffection, (player_id, npc_id))
    return affection_level(progress.points if progress else 0)


def _discount_percent(level: int) -> int:
    if level >= 5:
        return 8
    if level >= 2:
        return 3
    return 0


def _discounted_price(price: int, discount: int) -> int:
    return max(1, (price * (100 - discount) + 99) // 100)


def _item_data(template: ItemTemplate, amount: int = 0) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "rarity": template.rarity,
        "base_affection": template.base_affection,
        "tags": template.tags or [],
        "description": template.description,
        "icon": template.icon,
        "amount": amount,
    }


def shop_service_data(db: Session, player: Player, npc: NpcTemplate) -> dict:
    level = _player_affection_level(db, player.id, npc.id)
    discount = _discount_percent(level)
    rows = db.execute(
        select(NpcShopItem, ItemTemplate)
        .join(ItemTemplate, ItemTemplate.id == NpcShopItem.item_template_id)
        .where(NpcShopItem.npc_id == npc.id)
        .order_by(NpcShopItem.sort_order, NpcShopItem.id)
    ).all()
    shop_ids = [shop.id for shop, _ in rows]
    start, end = _daily_window(datetime.now(UTC))
    used = {
        shop_item_id: int(quantity or 0)
        for shop_item_id, quantity in db.execute(
            select(NpcPurchaseRecord.shop_item_id, func.sum(NpcPurchaseRecord.quantity))
            .where(
                NpcPurchaseRecord.player_id == player.id,
                NpcPurchaseRecord.shop_item_id.in_(shop_ids),
                NpcPurchaseRecord.purchased_at >= start,
                NpcPurchaseRecord.purchased_at < end,
            )
            .group_by(NpcPurchaseRecord.shop_item_id)
        ).all()
    } if shop_ids else {}
    inventory_amounts = {
        item_id: amount
        for item_id, amount in db.execute(
            select(Inventory.item_id, Inventory.amount).where(
                Inventory.player_id == player.id,
                Inventory.item_type == "item",
            )
        ).all()
    }
    items = []
    for shop, template in rows:
        purchased = used.get(shop.id, 0)
        items.append(
            {
                "shop_item_id": shop.id,
                **_item_data(template, inventory_amounts.get(template.id, 0)),
                "base_price": shop.price,
                "price": _discounted_price(shop.price, discount),
                "stock_limit": shop.stock_limit,
                "remaining_stock": max(0, shop.stock_limit - purchased),
                "unlock_level": shop.unlock_level,
                "unlocked": level >= shop.unlock_level,
            }
        )
    return {
        "kind": "shop",
        "title": "晨曦杂货铺" if npc.name == "杂货商" else "苏娜的锻造用品",
        "description": "挑选适合旅途与赠礼的物品。" if npc.name == "杂货商" else "购买稳定实用的锻造用品。",
        "gold": player.gold,
        "affection_level": level,
        "discount_percent": discount,
        "items": items,
    }


def purchase_shop_item(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
    shop_item_id: int,
    quantity: int,
) -> dict:
    if _service_type(npc) != "shop":
        abort(422, "该 NPC 不提供商店服务")
    player = db.scalar(select(Player).where(Player.id == player_id).with_for_update())
    if player is None:
        abort(404, "角色不存在")
    row = db.execute(
        select(NpcShopItem, ItemTemplate)
        .join(ItemTemplate, ItemTemplate.id == NpcShopItem.item_template_id)
        .where(NpcShopItem.id == shop_item_id, NpcShopItem.npc_id == npc.id)
        .with_for_update(of=NpcShopItem)
    ).one_or_none()
    if row is None:
        abort(404, "商品不存在")
    shop, template = row
    level = _player_affection_level(db, player.id, npc.id)
    if level < shop.unlock_level:
        abort(403, f"好感达到 Lv.{shop.unlock_level} 后解锁")
    start, end = _daily_window(datetime.now(UTC))
    purchased = db.scalar(
        select(func.sum(NpcPurchaseRecord.quantity)).where(
            NpcPurchaseRecord.player_id == player.id,
            NpcPurchaseRecord.shop_item_id == shop.id,
            NpcPurchaseRecord.purchased_at >= start,
            NpcPurchaseRecord.purchased_at < end,
        )
    ) or 0
    if purchased + quantity > shop.stock_limit:
        abort(409, "购买数量超过今日剩余库存")
    price = _discounted_price(shop.price, _discount_percent(level))
    total = price * quantity
    if player.gold < total:
        abort(409, "金币不足")
    inventory = db.scalar(
        select(Inventory)
        .where(
            Inventory.player_id == player.id,
            Inventory.item_id == template.id,
            Inventory.item_type == "item",
        )
        .with_for_update()
    )
    current_amount = inventory.amount if inventory else 0
    if current_amount + quantity > template.stack_limit:
        abort(409, "该物品已达到背包堆叠上限")
    if inventory is None:
        inventory = Inventory(
            player_id=player.id,
            item_id=template.id,
            item_type="item",
            amount=quantity,
        )
        db.add(inventory)
    else:
        inventory.amount += quantity
    record_quest_objective(
        db,
        player.id,
        "own_item",
        amount=inventory.amount,
        target_name_field="item_name",
        target_name=template.name,
        absolute=True,
    )
    player.gold -= total
    db.add(
        NpcPurchaseRecord(
            player_id=player.id,
            shop_item_id=shop.id,
            quantity=quantity,
            unit_price=price,
            purchased_at=datetime.now(UTC),
        )
    )
    db.flush()
    return {
        "npc_id": npc.id,
        "shop_item_id": shop.id,
        "item": _item_data(template, inventory.amount),
        "quantity": quantity,
        "unit_price": price,
        "total_price": total,
        "gold": player.gold,
        "remaining_stock": shop.stock_limit - purchased - quantity,
    }


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


def quest_service_data(db: Session, player: Player, npc: NpcTemplate) -> dict:
    quests = db.scalars(
        select(Quest).where(Quest.issuer_npc_id == npc.id).order_by(Quest.id)
    ).all()
    progress = {
        item.quest_id: item
        for item in db.scalars(
            select(PlayerQuest).where(
                PlayerQuest.player_id == player.id,
                PlayerQuest.quest_id.in_([quest.id for quest in quests]),
            )
        ).all()
    } if quests else {}
    return {
        "kind": "quest",
        "title": "村务委托",
        "description": "领取适合当前阶段的村庄事务。",
        "quests": [_quest_data(quest, progress.get(quest.id)) for quest in quests],
    }


def guide_service_data(db: Session, player: Player, npc: NpcTemplate) -> dict:
    level = _player_affection_level(db, player.id, npc.id)
    discovered_ids = set(
        db.scalars(
            select(PlayerPlantNode.plant_template_id).where(
                PlayerPlantNode.player_id == player.id
            )
        ).all()
    )
    discovered_ids.update(
        db.scalars(
            select(Inventory.item_id).where(
                Inventory.player_id == player.id,
                Inventory.item_type == "plant",
                Inventory.amount > 0,
            )
        ).all()
    )
    habitats: dict[int, list[str]] = {}
    for map_data in db.scalars(select(MapData).order_by(MapData.id)).all():
        for obj in (map_data.resource_json or {}).get("objects", []):
            if not isinstance(obj, dict) or obj.get("type") != "collectible_plant":
                continue
            template_id = int(obj.get("template_id", 0))
            if template_id:
                habitats.setdefault(template_id, []).append(
                    f"{map_data.map_name} · {obj.get('habitat', '未知区域')}"
                )
    plants = []
    for template in db.scalars(select(PlantTemplate).order_by(PlantTemplate.id)).all():
        discovered = template.id in discovered_ids
        known = discovered or template.rarity == "common" or level >= 3
        plants.append(
            {
                "id": template.id,
                "name": template.name if known else "未发现植物",
                "rarity": template.rarity if known else "unknown",
                "tags": template.tags if known else [],
                "description": template.description if known else "继续探索以记录这种植物。",
                "habitats": habitats.get(template.id, []) if discovered or level >= 2 else [],
                "respawn_seconds": template.respawn_seconds if discovered or level >= 2 else None,
                "discovered": discovered,
                "known": known,
            }
        )
    return {
        "kind": "guide",
        "title": "野外情报板",
        "description": "记录已经确认的植物、区域与刷新线索。",
        "affection_level": level,
        "plants": plants,
    }


def _upgraded_value(base: int, per_level: int, current_level: int, levels: int) -> int:
    return base + max(0, current_level + levels - 1) * per_level


def training_service_data(db: Session, player: Player, npc: NpcTemplate) -> dict:
    rows = db.execute(
        select(PlayerCard, CardTemplate)
        .join(CardTemplate, CardTemplate.id == PlayerCard.card_template_id)
        .where(PlayerCard.player_id == player.id)
        .order_by(PlayerCard.id)
    ).all()
    cards = []
    for card, template in rows:
        effect = template.effect_json or {}
        upgrade = template.upgrade_json or {}
        cards.append(
            {
                **card_data(card, template),
                "effect": {
                    **effect,
                    "damage": _upgraded_value(
                        int(effect.get("damage", 0)),
                        int(upgrade.get("damage_per_level", 0)),
                        card.level,
                        0,
                    ),
                    "shield": _upgraded_value(
                        int(effect.get("shield", 0)),
                        int(upgrade.get("shield_per_level", 0)),
                        card.level,
                        0,
                    ),
                },
                "upgrade_cost": card_upgrade_cost(card.level, 1),
                "can_upgrade": card_has_upgrade(template),
                "next_effect": {
                    "damage": _upgraded_value(
                        int(effect.get("damage", 0)),
                        int(upgrade.get("damage_per_level", 0)),
                        card.level,
                        1,
                    ),
                    "shield": _upgraded_value(
                        int(effect.get("shield", 0)),
                        int(upgrade.get("shield_per_level", 0)),
                        card.level,
                        1,
                    ),
                },
            }
        )
    return {
        "kind": "training",
        "title": "训练场",
        "description": "用金币进行稳定的卡牌训练，并预览提升结果。",
        "gold": player.gold,
        "cards": cards,
    }


def upgrade_training_card(
    db: Session,
    player_id: int,
    npc: NpcTemplate,
    card_id: int,
    levels: int,
) -> dict:
    if _service_type(npc) != "training":
        abort(422, "该 NPC 不提供卡牌训练")
    card, template, player, total_cost = upgrade_player_card(
        db, player_id, card_id, levels
    )
    return {
        "npc_id": npc.id,
        "card": card_data(card, template),
        "levels": levels,
        "total_cost": total_cost,
        "gold": player.gold,
    }


def npc_service_data(db: Session, player: Player, npc: NpcTemplate) -> dict:
    service_type = _service_type(npc)
    if service_type == "shop":
        return shop_service_data(db, player, npc)
    if service_type == "quest":
        return quest_service_data(db, player, npc)
    if service_type == "guide":
        return guide_service_data(db, player, npc)
    if service_type == "training":
        return training_service_data(db, player, npc)
    return {
        "kind": "none",
        "title": "暂无职业服务",
        "description": "当前只能交谈、赠礼或切磋。",
    }
