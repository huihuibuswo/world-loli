from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import (
    Inventory,
    NpcGiftRecord,
    NpcTemplate,
    PlantTemplate,
    Player,
    PlayerCardSpirit,
    PlayerNpcAffection,
    PlayerNpcAffectionReward,
    User,
)
from app.services.npc_affection_service import apply_affection


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


def test_npc_affection_chat_gift_milestones_and_player_isolation(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_dialogue_enabled", False)
    monkeypatch.setattr(settings, "ai_dialogue_min_interval_seconds", 0)
    suffix = uuid4().hex[:10]
    user_ids: list[int] = []

    with TestClient(app) as client:
        try:
            headers_a, user_a, player_a = _register(client, f"affection_{suffix}_a")
            headers_b, user_b, player_b = _register(client, f"affection_{suffix}_b")
            user_ids.extend([user_a, user_b])
            with SessionLocal() as db:
                npc = db.scalar(select(NpcTemplate).where(NpcTemplate.name == "杂货商"))
                plant = db.scalar(select(PlantTemplate).where(PlantTemplate.name == "蜜糖莓"))
                assert npc is not None and plant is not None
                npc_id = npc.id
                plant_id = plant.id
                db.add(
                    Inventory(
                        player_id=player_a,
                        item_id=plant.id,
                        item_type="plant",
                        amount=10,
                    )
                )
                db.commit()

            initial = client.get(f"/api/v1/npc/{npc_id}/affection", headers=headers_a)
            assert initial.status_code == 200
            assert initial.json()["data"]["points"] == 0
            assert initial.json()["data"]["level"] == 1

            request_id = str(uuid4())
            payload = {
                "request_id": request_id,
                "message": "今天有什么推荐？",
                "conversation_version": 0,
            }
            chat = client.post(f"/api/v1/npc/{npc_id}/chat", json=payload, headers=headers_a)
            assert chat.status_code == 200, chat.text
            chat_data = chat.json()["data"]
            assert chat_data["affection_change"]["points_gained"] == 2
            assert chat_data["affection"]["points"] == 2
            assert chat_data["affection"]["conversation_count"] == 1
            assert chat_data["affection_change"]["rewards"] == []

            duplicate = client.post(
                f"/api/v1/npc/{npc_id}/chat", json=payload, headers=headers_a
            )
            assert duplicate.status_code == 200
            assert duplicate.json()["data"]["affection"]["points"] == 2
            assert duplicate.json()["data"]["affection"]["conversation_count"] == 1
            assert duplicate.json()["data"]["affection_change"] is None

            options = client.get(f"/api/v1/npc/{npc_id}/gifts", headers=headers_a)
            assert options.status_code == 200
            gift_option = next(
                item for item in options.json()["data"]["plants"] if item["id"] == plant_id
            )
            assert gift_option["preference"] == "favorite"

            gift = client.post(
                f"/api/v1/npc/{npc_id}/gifts",
                json={"plant_template_id": plant_id},
                headers=headers_a,
            )
            assert gift.status_code == 200, gift.text
            gift_data = gift.json()["data"]
            assert gift_data["preference"] == "favorite"
            assert gift_data["affection_change"]["points_gained"] == 3
            assert gift_data["affection"]["points"] == 5
            assert gift_data["remaining_amount"] == 9

            with SessionLocal() as db:
                progress = db.get(PlayerNpcAffection, (player_a, npc_id))
                npc = db.get(NpcTemplate, npc_id)
                assert progress is not None and npc is not None
                progress.points = 19
                db.commit()
                level_two = apply_affection(db, player_a, npc, "chat")
                db.commit()
                assert level_two["new_level"] == 2
                assert [item["milestone_level"] for item in level_two["rewards"]] == [2]

                progress = db.get(PlayerNpcAffection, (player_a, npc_id))
                assert progress is not None
                progress.points = 79
                db.commit()
                full = apply_affection(db, player_a, npc, "chat")
                db.commit()
                assert full["new_level"] == 5
                assert full["points_after"] == 81
                assert full["rewards"][0]["type"] == "card_spirit"
                spirit_id = full["rewards"][0]["template_id"]
                assert db.scalar(
                    select(PlayerCardSpirit.id).where(
                        PlayerCardSpirit.player_id == player_a,
                        PlayerCardSpirit.spirit_template_id == spirit_id,
                    )
                )
                assert db.scalar(
                    select(PlayerNpcAffectionReward.id).where(
                        PlayerNpcAffectionReward.player_id == player_a,
                        PlayerNpcAffectionReward.npc_id == npc_id,
                        PlayerNpcAffectionReward.milestone_level == 5,
                    )
                )

            isolated = client.get(f"/api/v1/npc/{npc_id}/affection", headers=headers_b)
            assert isolated.status_code == 200
            assert isolated.json()["data"]["points"] == 0
            with SessionLocal() as db:
                npc = db.get(NpcTemplate, npc_id)
                assert npc is not None
                first_battle = apply_affection(db, player_b, npc, "battle")
                db.commit()
                assert first_battle["points_after"] == 1
                assert first_battle["new_level"] == 1
                assert first_battle["rewards"][0]["milestone_level"] == 1
                second_battle = apply_affection(db, player_b, npc, "battle")
                db.commit()
                assert second_battle["points_gained"] == 5
                assert not any(
                    item["milestone_level"] == 1 for item in second_battle["rewards"]
                )
        finally:
            if user_ids:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id.in_(user_ids)))
                    db.commit()


def test_npc_gift_daily_limit_does_not_consume_inventory(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_dialogue_min_interval_seconds", 0)
    suffix = uuid4().hex[:10]
    user_id: int | None = None

    with TestClient(app) as client:
        try:
            headers, user_id, player_id = _register(client, f"gift_limit_{suffix}")
            with SessionLocal() as db:
                npc = db.scalar(select(NpcTemplate).where(NpcTemplate.name == "训练教官"))
                plant = db.scalar(select(PlantTemplate).where(PlantTemplate.name == "星砂薄荷"))
                assert npc is not None and plant is not None
                npc_id = npc.id
                plant_id = plant.id
                db.add(
                    Inventory(
                        player_id=player_id,
                        item_id=plant_id,
                        item_type="plant",
                        amount=2,
                    )
                )
                for _ in range(5):
                    db.add(
                        NpcGiftRecord(
                            player_id=player_id,
                            npc_id=npc_id,
                            plant_template_id=plant_id,
                            preference="favorite",
                            affection_gained=1,
                            gifted_at=datetime.now(UTC),
                        )
                    )
                db.commit()

            response = client.post(
                f"/api/v1/npc/{npc_id}/gifts",
                json={"plant_template_id": plant_id},
                headers=headers,
            )
            assert response.status_code == 429
            with SessionLocal() as db:
                inventory = db.scalar(
                    select(Inventory).where(
                        Inventory.player_id == player_id,
                        Inventory.item_id == plant_id,
                        Inventory.item_type == "plant",
                    )
                )
                assert inventory is not None
                assert inventory.amount == 2
        finally:
            if user_id is not None:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id == user_id))
                    db.commit()
