from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import NpcTemplate, User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, username: str, avatar_gender: str = "female") -> tuple[str, int]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": "SafePassword123!",
            "email": f"{username}@example.com",
            "avatar_gender": avatar_gender,
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    return data["access_token"], data["user"]["id"]


def test_complete_demo_backend_flow() -> None:
    suffix = uuid4().hex[:10]
    username_a = f"tester_{suffix}_a"
    username_b = f"tester_{suffix}_b"
    user_ids: list[int] = []

    with TestClient(app) as client:
        try:
            assert client.get("/health/live").json() == {"status": "ok"}
            assert client.get("/health/ready").json() == {"status": "ready"}

            token_a, user_a = _register(client, username_a, "male")
            user_ids.append(user_a)
            headers_a = _auth(token_a)

            duplicate = client.post(
                "/api/v1/auth/register",
                json={"username": username_a, "password": "SafePassword123!"},
            )
            assert duplicate.status_code == 409

            bad_login = client.post(
                "/api/v1/auth/login",
                json={"username": username_a, "password": "wrong-password"},
            )
            assert bad_login.status_code == 401

            profile = client.get("/api/v1/player/profile", headers=headers_a)
            assert profile.status_code == 200
            assert profile.json()["data"]["current_map"] is not None
            assert profile.json()["data"]["avatar_gender"] == "male"

            map_response = client.get(
                f"/api/v1/map/{profile.json()['data']['current_map']}",
                headers=headers_a,
            )
            assert map_response.status_code == 200
            map_data = map_response.json()["data"]
            assert map_data["map_name"] == "晨曦村"
            map_npcs = {
                item["template_name"]: item["sprite"]
                for item in map_data["resource"]["objects"]
                if item["type"] == "npc"
            }
            assert map_npcs == {
                "训练木偶": "training-dummy",
                "训练教官": "npc-trainer",
                "晨曦村村长": "npc-village-chief",
                "铁匠少女苏娜": "npc-suna",
                "杂货商": "npc-shopkeeper",
                "森林向导": "npc-forest-guide",
            }

            cards_response = client.get("/api/v1/cards", headers=headers_a)
            assert cards_response.status_code == 200
            cards = cards_response.json()["data"]
            assert len(cards) == 2

            decks_response = client.get("/api/v1/decks", headers=headers_a)
            assert decks_response.status_code == 200
            decks = decks_response.json()["data"]
            assert len(decks) == 1
            assert decks[0]["is_active"] is True
            assert len(decks[0]["cards"]) == 2

            with SessionLocal() as db:
                enemy_id = db.scalar(
                    select(NpcTemplate.id).where(NpcTemplate.name == "训练木偶")
                )
            assert enemy_id is not None

            battle_response = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers_a,
            )
            assert battle_response.status_code == 201, battle_response.text
            battle = battle_response.json()["data"]
            battle_id = battle["battle_id"]

            token_b, user_b = _register(client, username_b)
            user_ids.append(user_b)
            forbidden_read = client.get(
                f"/api/v1/battle/{battle_id}", headers=_auth(token_b)
            )
            assert forbidden_read.status_code == 404

            card_by_id = {card["id"]: card for card in cards}
            playable = sorted(
                (card_by_id[card_id] for card_id in set(battle["hand_cards"])),
                key=lambda item: item["effect"].get("damage", 0),
                reverse=True,
            )
            first_card = playable[0]
            first_play = client.post(
                f"/api/v1/battle/{battle_id}/play-card",
                json={"card_id": first_card["id"], "expected_version": battle["version"]},
                headers=headers_a,
            )
            assert first_play.status_code == 200, first_play.text
            after_first = first_play.json()["data"]

            stale = client.post(
                f"/api/v1/battle/{battle_id}/play-card",
                json={"card_id": playable[-1]["id"], "expected_version": battle["version"]},
                headers=headers_a,
            )
            assert stale.status_code == 409

            second_play = client.post(
                f"/api/v1/battle/{battle_id}/play-card",
                json={
                    "card_id": playable[-1]["id"],
                    "expected_version": after_first["version"],
                },
                headers=headers_a,
            )
            assert second_play.status_code == 200, second_play.text
            completed = second_play.json()["data"]
            assert completed["status"] == "victory"

            result = client.get(
                f"/api/v1/battle/{battle_id}/result", headers=headers_a
            )
            assert result.status_code == 200
            assert result.json()["data"]["reward"]["gold"] == 10

            spirits = client.get("/api/v1/spirits", headers=headers_a)
            assert spirits.status_code == 200
            spirit_data = spirits.json()["data"]
            assert [item["name"] for item in spirit_data] == ["狼娘·露娜"]
            assert spirit_data[0]["exp"] == 60
            assert spirit_data[0]["affection"] == 2

            second_battle_response = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers_a,
            )
            assert second_battle_response.status_code == 201, second_battle_response.text
            second_battle = second_battle_response.json()["data"]
            second_playable = sorted(
                (card_by_id[card_id] for card_id in set(second_battle["hand_cards"])),
                key=lambda item: item["effect"].get("damage", 0),
                reverse=True,
            )
            second_first_play = client.post(
                f"/api/v1/battle/{second_battle['battle_id']}/play-card",
                json={
                    "card_id": second_playable[0]["id"],
                    "expected_version": second_battle["version"],
                },
                headers=headers_a,
            )
            assert second_first_play.status_code == 200, second_first_play.text
            second_after_first = second_first_play.json()["data"]
            assert second_after_first["last_action"]["damage"] == 16
            second_completion = client.post(
                f"/api/v1/battle/{second_battle['battle_id']}/play-card",
                json={
                    "card_id": second_playable[-1]["id"],
                    "expected_version": second_after_first["version"],
                },
                headers=headers_a,
            )
            assert second_completion.status_code == 200, second_completion.text
            assert second_completion.json()["data"]["status"] == "victory"
            assert second_completion.json()["data"]["reward"]["spirit_exp"] == 60

            growth = client.get(
                f"/api/v1/spirits/{spirit_data[0]['id']}/growth", headers=headers_a
            )
            assert growth.status_code == 200
            assert growth.json()["data"]["exp"] == 120
            assert growth.json()["data"]["affection"] == 4

            level_up = client.post(
                f"/api/v1/spirits/{spirit_data[0]['id']}/level",
                json={"levels": 1},
                headers=headers_a,
            )
            assert level_up.status_code == 200, level_up.text
            assert level_up.json()["data"]["level"] == 2
            assert level_up.json()["data"]["exp"] == 20

            affection = client.post(
                f"/api/v1/spirits/{spirit_data[0]['id']}/affection",
                json={"source": "dialog"},
                headers=headers_a,
            )
            assert affection.status_code == 200
            assert affection.json()["data"]["interaction_available_at"] is not None
            refreshed_spirits = client.get("/api/v1/spirits", headers=headers_a)
            assert refreshed_spirits.status_code == 200
            assert refreshed_spirits.json()["data"][0]["interaction_available_at"] is not None
            affection_spam = client.post(
                f"/api/v1/spirits/{spirit_data[0]['id']}/affection",
                json={"source": "dialog"},
                headers=headers_a,
            )
            assert affection_spam.status_code == 429

            save = client.get("/api/v1/save", headers=headers_a)
            assert save.status_code == 200
            assert save.json()["data"]["player"]["gold"] == 20
        finally:
            if user_ids:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id.in_(user_ids)))
                    db.commit()
