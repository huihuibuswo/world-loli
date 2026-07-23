from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import Inventory, NpcTemplate, Player, User


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


def _finish_battle(
    client: TestClient,
    headers: dict[str, str],
    battle: dict,
    card_by_id: dict[int, dict],
) -> dict:
    current = battle
    while current["status"] == "active":
        playable = [
            card_by_id[card_id]
            for card_id in set(current["hand_cards"])
            if card_by_id[card_id]["cost"] <= current["energy"]
        ]
        if playable:
            card = max(playable, key=lambda item: item["effect"].get("damage", 0))
            response = client.post(
                f"/api/v1/battle/{current['battle_id']}/play-card",
                json={"card_id": card["id"], "expected_version": current["version"]},
                headers=headers,
            )
        else:
            response = client.post(
                f"/api/v1/battle/{current['battle_id']}/end-turn",
                json={"expected_version": current["version"]},
                headers=headers,
            )
        assert response.status_code == 200, response.text
        current = response.json()["data"]
    assert current["status"] == "victory"
    return current


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
            profile_data = profile.json()["data"]
            assert profile_data["current_map"] is not None
            assert profile_data["avatar_gender"] == "male"

            map_response = client.get(
                f"/api/v1/map/{profile_data['current_map']}", headers=headers_a
            )
            assert map_response.status_code == 200
            map_data = map_response.json()["data"]
            assert map_data["map_name"] == "晨曦村"
            map_npcs = {
                item["template_name"]: item
                for item in map_data["resource"]["objects"]
                if item["type"] == "npc"
            }
            assert set(map_npcs) == {
                "训练教官",
                "晨曦村村长",
                "铁匠少女苏娜",
                "杂货商",
                "森林向导",
            }
            assert "训练木偶" not in map_npcs

            village_portal = next(
                item
                for item in map_data["resource"]["objects"]
                if item["type"] == "map_portal"
            )
            assert village_portal["target_map_name"] == "微光森林"

            same_map = client.post(
                "/api/v1/map/enter",
                json={"map_id": profile_data["current_map"]},
                headers=headers_a,
            )
            assert same_map.status_code == 409

            enter_forest = client.post(
                "/api/v1/map/enter",
                json={"map_id": village_portal["target_map_id"]},
                headers=headers_a,
            )
            assert enter_forest.status_code == 200, enter_forest.text
            forest_data = enter_forest.json()["data"]
            assert forest_data["map"]["map_name"] == "微光森林"
            assert forest_data["position_x"] == village_portal["spawn_x"]
            assert forest_data["position_y"] == village_portal["spawn_y"]
            forest_plants = {
                item["node_id"]: (item["habitat"], item["x"], item["y"])
                for item in forest_data["map"]["resource"]["objects"]
                if item["type"] == "collectible_plant"
            }
            assert forest_plants == {
                "forest_silver_01": ("林间道路旁的树根地", 1600, 1500),
                "forest_mint_01": ("溪流附近的湿润林地", 1280, 1340),
                "forest_lily_01": ("森林深处的月光空地", 620, 520),
                "forest_fern_01": ("雾区边缘的古树下", 430, 1330),
                "forest_dream_01": ("遗迹附近的隐蔽空地", 980, 420),
            }

            stale_location = client.post(
                "/api/v1/player/location",
                json={"map_id": profile_data["current_map"], "position_x": 128, "position_y": 128},
                headers=headers_a,
            )
            assert stale_location.status_code == 409

            forest_portal = next(
                item
                for item in forest_data["map"]["resource"]["objects"]
                if item["type"] == "map_portal"
            )
            assert forest_portal["target_map_name"] == "晨曦村"
            return_village = client.post(
                "/api/v1/map/enter",
                json={"map_id": forest_portal["target_map_id"]},
                headers=headers_a,
            )
            assert return_village.status_code == 200, return_village.text
            assert return_village.json()["data"]["map"]["map_name"] == "晨曦村"

            for map_npc in map_npcs.values():
                npc_response = client.get(f"/api/v1/npc/{map_npc['template_id']}")
                assert npc_response.status_code == 200
                npc = npc_response.json()["data"]
                assert npc["actions"] == ["dialog", "battle"]
                assert len(npc["dialogue"]) == 3
                assert npc["portrait"].startswith("/assets/generated/portraits/")
                assert npc["battle_deck"]["hp"] > 0

            cards_response = client.get("/api/v1/cards", headers=headers_a)
            assert cards_response.status_code == 200
            cards = cards_response.json()["data"]
            assert len(cards) == 2
            card_by_id = {card["id"]: card for card in cards}

            decks_response = client.get("/api/v1/decks", headers=headers_a)
            assert decks_response.status_code == 200
            decks = decks_response.json()["data"]
            assert len(decks) == 1
            assert decks[0]["is_active"] is True
            assert len(decks[0]["cards"]) == 2

            with SessionLocal() as db:
                enemy_id = db.scalar(
                    select(NpcTemplate.id).where(NpcTemplate.name == "训练教官")
                )
            assert enemy_id is not None

            battle_response = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers_a,
            )
            assert battle_response.status_code == 201, battle_response.text
            first_battle = battle_response.json()["data"]

            battle_map_switch = client.post(
                "/api/v1/map/enter",
                json={"map_id": village_portal["target_map_id"]},
                headers=headers_a,
            )
            assert battle_map_switch.status_code == 409

            token_b, user_b = _register(client, username_b)
            user_ids.append(user_b)
            forbidden_read = client.get(
                f"/api/v1/battle/{first_battle['battle_id']}", headers=_auth(token_b)
            )
            assert forbidden_read.status_code == 404

            first_victory = _finish_battle(client, headers_a, first_battle, card_by_id)
            assert first_victory["enemy_state"]["sprite"] == "npc-trainer"
            assert first_victory["reward"] == {
                "first_victory": True,
                "card": {
                    "template_id": first_victory["reward"]["card"]["template_id"],
                    "name": "破绽识破",
                    "count": 1,
                },
            }

            cards_after_first = client.get("/api/v1/cards", headers=headers_a).json()["data"]
            reward_card = next(card for card in cards_after_first if card["name"] == "破绽识破")
            assert reward_card["count"] == 1

            second_battle_response = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers_a,
            )
            assert second_battle_response.status_code == 201, second_battle_response.text
            second_victory = _finish_battle(
                client,
                headers_a,
                second_battle_response.json()["data"],
                card_by_id,
            )
            assert second_victory["reward"] == {}

            cards_after_second = client.get("/api/v1/cards", headers=headers_a).json()["data"]
            reward_card_after_second = next(
                card for card in cards_after_second if card["name"] == "破绽识破"
            )
            assert reward_card_after_second["count"] == 1

            save = client.get("/api/v1/save", headers=headers_a)
            assert save.status_code == 200
            assert save.json()["data"]["player"]["gold"] == 0
        finally:
            if user_ids:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id.in_(user_ids)))
                    db.commit()


def test_plant_collection_and_spirit_gift_flow() -> None:
    suffix = uuid4().hex[:10]
    username = f"plant_{suffix}"
    user_id: int | None = None

    with TestClient(app) as client:
        try:
            token, user_id = _register(client, username)
            headers = _auth(token)
            profile = client.get("/api/v1/player/profile", headers=headers).json()["data"]

            map_plants = client.get(
                f"/api/v1/map/{profile['current_map']}/plants", headers=headers
            )
            assert map_plants.status_code == 200, map_plants.text
            nodes = map_plants.json()["data"]
            assert len({node["name"] for node in nodes}) >= 3
            assert all(node["available"] for node in nodes)
            assert all(node.get("habitat") for node in nodes)
            village_positions = {
                node["name"]: (node["x"], node["y"])
                for node in nodes
            }
            assert village_positions == {
                "晨露草": (180, 330),
                "蜜糖莓": (1120, 430),
                "阳铃花": (930, 400),
                "火绒花": (535, 745),
                "风铃藤": (1320, 970),
            }

            node = nodes[0]
            collected = client.post(
                "/api/v1/plants/collect",
                json={"map_id": profile["current_map"], "node_id": node["node_id"]},
                headers=headers,
            )
            assert collected.status_code == 200, collected.text
            assert collected.json()["data"]["plant"]["amount"] == 1

            repeated = client.post(
                "/api/v1/plants/collect",
                json={"map_id": profile["current_map"], "node_id": node["node_id"]},
                headers=headers,
            )
            assert repeated.status_code == 409
            inventory = client.get("/api/v1/plants/inventory", headers=headers).json()["data"]
            assert inventory == [
                {
                    **collected.json()["data"]["plant"],
                }
            ]

            spirits = client.get("/api/v1/spirits", headers=headers).json()["data"]
            assert [spirit["name"] for spirit in spirits] == ["狼娘·露娜"]
            spirit = spirits[0]
            options = client.get(
                f"/api/v1/spirits/{spirit['id']}/gifts", headers=headers
            )
            assert options.status_code == 200, options.text
            assert options.json()["data"]["remaining_gifts"] == 5
            assert options.json()["data"]["plants"][0]["id"] == node["template_id"]

            with SessionLocal() as db:
                player_id = db.scalar(select(Player.id).where(Player.user_id == user_id))
                plant_stack = db.scalar(
                    select(Inventory).where(
                        Inventory.player_id == player_id,
                        Inventory.item_type == "plant",
                        Inventory.item_id == node["template_id"],
                    )
                )
                assert plant_stack is not None
                plant_stack.amount = 6
                db.commit()

            affection = spirit["affection"]
            for gift_number in range(5):
                gifted = client.post(
                    f"/api/v1/spirits/{spirit['id']}/gifts",
                    json={"plant_template_id": node["template_id"]},
                    headers=headers,
                )
                assert gifted.status_code == 200, gifted.text
                gift = gifted.json()["data"]
                assert gift["affection_gained"] >= 1
                affection += gift["affection_gained"]
                assert gift["affection"] == affection
                assert gift["remaining_amount"] == 5 - gift_number
                assert gift["remaining_gifts"] == 4 - gift_number

            over_daily_limit = client.post(
                f"/api/v1/spirits/{spirit['id']}/gifts",
                json={"plant_template_id": node["template_id"]},
                headers=headers,
            )
            assert over_daily_limit.status_code == 429
            refreshed = client.get(
                f"/api/v1/spirits/{spirit['id']}", headers=headers
            ).json()["data"]
            assert refreshed["affection"] == affection
            remaining_inventory = client.get(
                "/api/v1/plants/inventory", headers=headers
            ).json()["data"]
            assert remaining_inventory[0]["amount"] == 1
        finally:
            if user_id is not None:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id == user_id))
                    db.commit()
