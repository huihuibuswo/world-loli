from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import NpcTemplate, PlayerCard, User


def _register(client: TestClient, username: str) -> tuple[dict[str, str], int, int]:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "SafePassword123!"},
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    return (
        {"Authorization": f"Bearer {data['access_token']}"},
        data["user"]["id"],
        data["player_id"],
    )


def test_npc_profession_services_flow() -> None:
    suffix = uuid4().hex[:10]
    user_id: int | None = None

    with TestClient(app) as client:
        try:
            headers, user_id, player_id = _register(client, f"npc_service_{suffix}")
            with SessionLocal() as db:
                npcs = {
                    npc.name: npc.id
                    for npc in db.scalars(
                        select(NpcTemplate).where(
                            NpcTemplate.name.in_(
                                [
                                    "晨曦村村长",
                                    "杂货商",
                                    "铁匠少女苏娜",
                                    "森林向导",
                                    "训练教官",
                                ]
                            )
                        )
                    ).all()
                }
                card_id = db.scalar(
                    select(PlayerCard.id)
                    .where(PlayerCard.player_id == player_id)
                    .order_by(PlayerCard.id)
                )
            assert len(npcs) == 5 and card_id is not None

            profile = client.get("/api/v1/player/profile", headers=headers).json()["data"]
            assert profile["gold"] == 300

            shop = client.get(
                f"/api/v1/npc/{npcs['杂货商']}/service", headers=headers
            )
            assert shop.status_code == 200, shop.text
            shop_data = shop.json()["data"]
            assert shop_data["kind"] == "shop"
            assert {item["name"] for item in shop_data["items"]} >= {
                "香烤肉干",
                "晨曦暖茶",
            }
            jerky = next(item for item in shop_data["items"] if item["name"] == "香烤肉干")
            purchase = client.post(
                f"/api/v1/npc/{npcs['杂货商']}/shop/purchase",
                json={"shop_item_id": jerky["shop_item_id"], "quantity": 1},
                headers=headers,
            )
            assert purchase.status_code == 200, purchase.text
            purchase_data = purchase.json()["data"]
            assert purchase_data["item"]["name"] == "香烤肉干"
            assert purchase_data["item"]["amount"] == 1
            assert purchase_data["gold"] == 280

            gift_options = client.get(
                f"/api/v1/npc/{npcs['杂货商']}/gifts", headers=headers
            ).json()["data"]
            jerky_gift = next(item for item in gift_options["items"] if item["name"] == "香烤肉干")
            gifted = client.post(
                f"/api/v1/npc/{npcs['杂货商']}/gifts",
                json={"item_template_id": jerky_gift["id"]},
                headers=headers,
            )
            assert gifted.status_code == 200, gifted.text
            gift_data = gifted.json()["data"]
            assert gift_data["gift_type"] == "item"
            assert gift_data["item_template_id"] == jerky_gift["id"]
            assert gift_data["remaining_amount"] == 0
            assert gift_data["affection_change"]["points_gained"] >= 1

            training = client.get(
                f"/api/v1/npc/{npcs['训练教官']}/service", headers=headers
            ).json()["data"]
            assert training["kind"] == "training"
            card = next(item for item in training["cards"] if item["id"] == card_id)
            upgraded = client.post(
                f"/api/v1/npc/{npcs['训练教官']}/training/upgrade",
                json={"card_id": card_id, "levels": 1},
                headers=headers,
            )
            assert upgraded.status_code == 200, upgraded.text
            upgrade_data = upgraded.json()["data"]
            assert upgrade_data["card"]["level"] == card["level"] + 1
            assert upgrade_data["total_cost"] == card["upgrade_cost"]
            assert upgrade_data["gold"] == 180
            refreshed_training = client.get(
                f"/api/v1/npc/{npcs['训练教官']}/service", headers=headers
            ).json()["data"]
            trained_card = next(
                item for item in refreshed_training["cards"] if item["id"] == card_id
            )
            assert trained_card["effect"] == card["next_effect"]
            assert trained_card["next_effect"]["damage"] >= trained_card["effect"]["damage"]
            assert trained_card["next_effect"]["shield"] >= trained_card["effect"]["shield"]

            village = client.get(
                f"/api/v1/npc/{npcs['晨曦村村长']}/service", headers=headers
            ).json()["data"]
            assert village["kind"] == "quest"
            assert len(village["quests"]) == 3
            supply_quest = next(
                quest for quest in village["quests"] if quest["title"] == "村道补给"
            )
            accepted = client.post(
                f"/api/v1/quests/{supply_quest['id']}/accept", headers=headers
            )
            assert accepted.status_code == 200, accepted.text
            assert accepted.json()["data"]["status"] == "active"

            refreshed_shop = client.get(
                f"/api/v1/npc/{npcs['杂货商']}/service", headers=headers
            ).json()["data"]
            tea = next(item for item in refreshed_shop["items"] if item["name"] == "晨曦暖茶")
            bought_tea = client.post(
                f"/api/v1/npc/{npcs['杂货商']}/shop/purchase",
                json={"shop_item_id": tea["shop_item_id"], "quantity": 1},
                headers=headers,
            )
            assert bought_tea.status_code == 200, bought_tea.text
            supply_progress = client.get(
                f"/api/v1/quests/{supply_quest['id']}/progress", headers=headers
            ).json()["data"]
            assert supply_progress["progress"] == {
                "objective": "own_item",
                "current": 1,
                "target": 1,
                "ready": True,
            }
            completed_supply = client.post(
                f"/api/v1/quests/{supply_quest['id']}/complete", headers=headers
            )
            assert completed_supply.status_code == 200, completed_supply.text
            assert completed_supply.json()["data"]["status"] == "completed"

            guide = client.get(
                f"/api/v1/npc/{npcs['森林向导']}/service", headers=headers
            ).json()["data"]
            assert guide["kind"] == "guide"
            assert any(plant["known"] for plant in guide["plants"])
            assert any(not plant["known"] for plant in guide["plants"])

            exploration_quest = next(
                quest for quest in village["quests"] if quest["title"] == "林缘踏查"
            )
            accepted_exploration = client.post(
                f"/api/v1/quests/{exploration_quest['id']}/accept", headers=headers
            )
            assert accepted_exploration.status_code == 200, accepted_exploration.text
            profile = client.get("/api/v1/player/profile", headers=headers).json()["data"]
            nodes = client.get(
                f"/api/v1/map/{profile['current_map']}/plants", headers=headers
            ).json()["data"]
            node = next(item for item in nodes if item["available"])
            collected = client.post(
                "/api/v1/plants/collect",
                json={"map_id": profile["current_map"], "node_id": node["node_id"]},
                headers=headers,
            )
            assert collected.status_code == 200, collected.text
            exploration_progress = client.get(
                f"/api/v1/quests/{exploration_quest['id']}/progress", headers=headers
            ).json()["data"]
            assert exploration_progress["progress"]["ready"] is True
            completed_exploration = client.post(
                f"/api/v1/quests/{exploration_quest['id']}/complete", headers=headers
            )
            assert completed_exploration.status_code == 200, completed_exploration.text

            rewarded_profile = client.get(
                "/api/v1/player/profile", headers=headers
            ).json()["data"]
            assert rewarded_profile["gold"] == 440

            smith = client.get(
                f"/api/v1/npc/{npcs['铁匠少女苏娜']}/service", headers=headers
            ).json()["data"]
            assert smith["kind"] == "shop"
            assert {item["name"] for item in smith["items"]} == {"精工磨刀石", "透光水晶"}
        finally:
            if user_id is not None:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id == user_id))
                    db.commit()
