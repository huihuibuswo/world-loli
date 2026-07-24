from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import (
    NpcTemplate,
    PlayerCardSpiritFragment,
    PlayerQuest,
    PlayerStoryProgress,
    Quest,
    User,
)
from app.services.opening_story_service import mark_opening_battle_complete


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


def _finish_battle(
    client: TestClient,
    headers: dict[str, str],
    battle: dict,
    card_by_id: dict[int, dict],
) -> dict:
    current = battle
    for _ in range(40):
        while current["status"] == "active":
            playable_cards = [
                card_by_id[card_id]
                for card_id in set(current["hand_cards"])
                if card_by_id[card_id]["cost"] <= current["energy"]
            ]
            playable = (
                max(
                    playable_cards,
                    key=lambda card: (
                        card["effect"].get("damage", 0),
                        card["effect"].get("shield", 0),
                    ),
                )["id"]
                if playable_cards
                else None
            )
            if playable is None:
                break
            response = client.post(
                f"/api/v1/battle/{current['battle_id']}/play-card",
                json={"card_id": playable, "expected_version": current["version"]},
                headers=headers,
            )
            assert response.status_code == 200, response.text
            current = response.json()["data"]
        if current["status"] != "active":
            return current
        response = client.post(
            f"/api/v1/battle/{current['battle_id']}/end-turn",
            json={"expected_version": current["version"]},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        current = response.json()["data"]
        if current["status"] == "defeat":
            raise AssertionError("序章测试套牌未能击败露娜")
    raise AssertionError("露娜战斗未在回合上限内结束")


def test_opening_story_full_flow_is_gated_and_idempotent(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_battle_enabled", False)
    suffix = uuid4().hex[:10]
    user_id: int | None = None

    with TestClient(app) as client:
        try:
            headers, user_id, player_id = _register(client, f"opening_{suffix}")
            initial = client.get("/api/v1/opening", headers=headers)
            assert initial.status_code == 200, initial.text
            assert initial.json()["data"]["stage"] == "arrival"

            started = client.post("/api/v1/opening/start", headers=headers)
            assert started.status_code == 200, started.text
            started_data = started.json()["data"]
            assert started_data["stage"] == "prepare"
            assert {task["title"] for task in started_data["tasks"]} == {
                "村道补给",
                "林缘踏查",
                "实战准备",
            }
            assert all(task["status"] == "active" for task in started_data["tasks"])

            with SessionLocal() as db:
                luna = db.scalar(select(NpcTemplate).where(NpcTemplate.name == "狼娘·露娜"))
                assert luna is not None
                luna_id = luna.id

            early_battle = client.post(
                "/api/v1/battle/create", json={"enemy_id": luna_id}, headers=headers
            )
            assert early_battle.status_code == 409

            with SessionLocal() as db:
                quests = db.scalars(select(Quest).where(Quest.title.in_((
                    "村道补给",
                    "林缘踏查",
                    "实战准备",
                )))).all()
                progress = db.scalars(
                    select(PlayerQuest).where(
                        PlayerQuest.player_id == player_id,
                        PlayerQuest.quest_id.in_([quest.id for quest in quests]),
                    )
                ).all()
                assert len(progress) == 3
                for item in progress:
                    item.progress = {
                        "current": 1,
                        "target": 1,
                        "ready": True,
                    }
                db.commit()

            ready = client.get("/api/v1/opening", headers=headers).json()["data"]
            assert ready["stage"] == "forest_signal"
            assert all(task["ready"] for task in ready["tasks"])

            profile = client.get("/api/v1/player/profile", headers=headers).json()["data"]
            village = client.get(f"/api/v1/map/{profile['current_map']}", headers=headers).json()["data"]
            forest_portal = next(
                item
                for item in village["resource"]["objects"]
                if item["type"] == "map_portal" and item["target_map_name"] == "微光森林"
            )
            entered = client.post(
                "/api/v1/map/enter",
                json={"map_id": forest_portal["target_map_id"]},
                headers=headers,
            )
            assert entered.status_code == 200, entered.text

            cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            assert {card["name"]: card["count"] for card in cards} == {
                "基础攻击": 6,
                "防御姿态": 6,
            }
            card_by_id = {card["id"]: card for card in cards}

            abandoned = client.post(
                "/api/v1/battle/create", json={"enemy_id": luna_id}, headers=headers
            )
            assert abandoned.status_code == 201, abandoned.text
            abandoned_data = abandoned.json()["data"]
            surrendered = client.post(
                f"/api/v1/battle/{abandoned_data['battle_id']}/surrender",
                json={"expected_version": abandoned_data["version"]},
                headers=headers,
            )
            assert surrendered.status_code == 200, surrendered.text
            surrendered_data = surrendered.json()["data"]
            assert surrendered_data["status"] == "defeat"
            assert surrendered_data["defeat_reason"] == "surrender"
            assert surrendered_data["reward"] == {}
            assert client.get("/api/v1/opening", headers=headers).json()["data"]["stage"] == "forest_signal"
            assert client.get("/api/v1/spirits", headers=headers).json()["data"] == []

            created = client.post(
                "/api/v1/battle/create", json={"enemy_id": luna_id}, headers=headers
            )
            assert created.status_code == 201, created.text
            victory = _finish_battle(client, headers, created.json()["data"], card_by_id)
            assert victory["status"] == "victory"
            assert "fragment" not in victory["reward"]
            opening_reward = victory["reward"]["opening"]
            assert opening_reward["stage"] == "return_village"
            assert opening_reward["event"] == "luna_contract"
            assert len(opening_reward["dialogue"]) == 5
            assert opening_reward["contract_reward"]["spirit"]["name"] == "狼娘·露娜"
            assert opening_reward["contract_reward"]["spirit"]["created"] is True
            assert opening_reward["contract_reward"]["card"] == {
                "id": opening_reward["contract_reward"]["card"]["id"],
                "template_id": opening_reward["contract_reward"]["card"]["template_id"],
                "name": "月牙撕裂",
                "count": 2,
                "deck_amount": 2,
                "added_to_active_deck": True,
            }

            cards_after = client.get("/api/v1/cards", headers=headers).json()["data"]
            assert {card["name"]: card["count"] for card in cards_after} == {
                "基础攻击": 6,
                "防御姿态": 6,
                "月牙撕裂": 2,
            }
            deck_after = client.get("/api/v1/decks", headers=headers).json()["data"][0]
            assert {card["name"]: card["amount"] for card in deck_after["cards"]} == {
                "基础攻击": 6,
                "防御姿态": 6,
                "月牙撕裂": 2,
            }
            assert [
                spirit["name"]
                for spirit in client.get("/api/v1/spirits", headers=headers).json()["data"]
            ] == ["狼娘·露娜"]
            assert client.get("/api/v1/spirit-fragments", headers=headers).json()["data"] == []

            with SessionLocal() as db:
                luna = db.get(NpcTemplate, luna_id)
                assert luna is not None
                repeated_reward = mark_opening_battle_complete(db, player_id, luna, "victory")
                db.commit()
                assert repeated_reward is not None
                assert repeated_reward["contract_reward"]["spirit"]["created"] is False
                assert (
                    repeated_reward["contract_reward"]["card"]["added_to_active_deck"]
                    is False
                )
                progress = db.scalar(
                    select(PlayerStoryProgress).where(
                        PlayerStoryProgress.player_id == player_id,
                        PlayerStoryProgress.story_key == "opening_moon_scar",
                    )
                )
                assert progress is not None
                assert progress.data_json["luna_contract_completed"] is True
                assert db.scalar(
                    select(PlayerCardSpiritFragment).where(
                        PlayerCardSpiritFragment.player_id == player_id
                    )
                ) is None

            repeated_cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            assert next(card for card in repeated_cards if card["name"] == "月牙撕裂")["count"] == 2

            wrong_map = client.post("/api/v1/opening/complete", headers=headers)
            assert wrong_map.status_code == 409

            forest = entered.json()["data"]["map"]
            village_portal = next(
                item
                for item in forest["resource"]["objects"]
                if item["type"] == "map_portal" and item["target_map_name"] == "晨曦村"
            )
            returned = client.post(
                "/api/v1/map/enter",
                json={"map_id": village_portal["target_map_id"]},
                headers=headers,
            )
            assert returned.status_code == 200, returned.text

            completed = client.post("/api/v1/opening/complete", headers=headers)
            assert completed.status_code == 200, completed.text
            completed_data = completed.json()["data"]
            assert completed_data["stage"] == "complete"
            assert completed_data["completed_now"] is True
            assert completed_data["gold_reward"] == 480
            assert completed_data["main_quest"] == "月痕追迹"
            assert all(task["status"] == "completed" for task in completed_data["tasks"])

            gold_after = client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"]
            duplicate = client.post("/api/v1/opening/complete", headers=headers)
            assert duplicate.status_code == 200, duplicate.text
            assert duplicate.json()["data"]["completed_now"] is False
            assert duplicate.json()["data"]["gold_reward"] == 0
            assert client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"] == gold_after
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                db.commit()
