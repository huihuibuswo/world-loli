from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import (
    CardSpiritTemplate,
    Inventory,
    NpcTemplate,
    Player,
    PlayerCardSpirit,
    User,
)


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


def test_complete_demo_backend_flow(monkeypatch) -> None:
    monkeypatch.setattr("app.core.config.settings.ai_enabled", False)
    monkeypatch.setattr("app.core.config.settings.ai_dialogue_enabled", False)
    monkeypatch.setattr("app.core.config.settings.ai_battle_enabled", False)
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
                if item["type"] == "npc" and not item.get("story_gate")
            }
            assert set(map_npcs) == {
                "训练教官",
                "晨曦村村长",
                "铁匠少女苏娜",
                "杂货商",
                "森林向导",
            }
            recuperating_luna = next(
                item
                for item in map_data["resource"]["objects"]
                if item["type"] == "npc"
                and item.get("template_name") == "狼娘·露娜"
                and item.get("story_stage") == "complete"
            )
            assert recuperating_luna["story_gate"] == "opening_moon_scar"
            assert recuperating_luna["stationary"] is True
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
                npc_response = client.get(
                    f"/api/v1/npc/{map_npc['template_id']}",
                    headers=headers_a,
                )
                assert npc_response.status_code == 200
                npc = npc_response.json()["data"]
                assert npc["actions"][:2] == ["dialog", "battle"]
                assert npc["service_type"] in {"shop", "quest", "guide", "training"}
                assert len(npc["dialogue"]) == 3
                assert npc["portrait"].startswith("/assets/generated/portraits/")
                assert npc["battle_deck"]["hp"] > 0

            chat_npc_id = next(iter(map_npcs.values()))["template_id"]
            chat_state = client.get(
                f"/api/v1/npc/{chat_npc_id}/chat",
                headers=headers_a,
            )
            assert chat_state.status_code == 200
            assert chat_state.json()["data"]["conversation_version"] == 0

            chat_request_id = str(uuid4())
            chat_response = client.post(
                f"/api/v1/npc/{chat_npc_id}/chat",
                json={
                    "request_id": chat_request_id,
                    "message": "今天适合去森林训练吗？",
                    "conversation_version": 0,
                },
                headers=headers_a,
            )
            assert chat_response.status_code == 200, chat_response.text
            chat_data = chat_response.json()["data"]
            assert chat_data["conversation_version"] == 1
            assert chat_data["mode"] == "fallback"
            assert len(chat_data["suggested_replies"]) == 2
            assert chat_data["turns"][-1]["request_id"] == chat_request_id

            duplicate_chat = client.post(
                f"/api/v1/npc/{chat_npc_id}/chat",
                json={
                    "request_id": chat_request_id,
                    "message": "今天适合去森林训练吗？",
                    "conversation_version": 0,
                },
                headers=headers_a,
            )
            assert duplicate_chat.status_code == 200
            assert duplicate_chat.json()["data"]["conversation_version"] == 1

            stale_chat = client.post(
                f"/api/v1/npc/{chat_npc_id}/chat",
                json={
                    "request_id": str(uuid4()),
                    "message": "这是一条基于旧版本的消息",
                    "conversation_version": 0,
                },
                headers=headers_a,
            )
            assert stale_chat.status_code == 409

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
            assert sum(item["amount"] for item in decks[0]["cards"]) == 12

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
            isolated_chat = client.get(
                f"/api/v1/npc/{chat_npc_id}/chat",
                headers=_auth(token_b),
            )
            assert isolated_chat.status_code == 200
            assert isolated_chat.json()["data"]["conversation_version"] == 0
            assert isolated_chat.json()["data"]["turns"] == []
            forbidden_read = client.get(
                f"/api/v1/battle/{first_battle['battle_id']}", headers=_auth(token_b)
            )
            assert forbidden_read.status_code == 404

            first_victory = _finish_battle(client, headers_a, first_battle, card_by_id)
            assert first_victory["enemy_state"]["sprite"] == "npc-trainer"
            assert first_victory["reward"] == {
                "first_battle": True,
                "first_victory": True,
                "card": {
                    "template_id": first_victory["reward"]["card"]["template_id"],
                    "name": "破绽识破",
                    "count": 1,
                },
            }
            assert first_victory["affection_result"]["new_level"] >= 1
            assert first_victory["affection_result"]["rewards"][0]["milestone_level"] == 1

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
            assert second_victory["affection_result"]["points_gained"] == 5

            cards_after_second = client.get("/api/v1/cards", headers=headers_a).json()["data"]
            reward_card_after_second = next(
                card for card in cards_after_second if card["name"] == "破绽识破"
            )
            assert reward_card_after_second["count"] == 1

            save = client.get("/api/v1/save", headers=headers_a)
            assert save.status_code == 200
            assert save.json()["data"]["player"]["gold"] == 300
        finally:
            if user_ids:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id.in_(user_ids)))
                    db.commit()


def test_ai_guard_action_is_server_authoritative(monkeypatch) -> None:
    suffix = uuid4().hex[:10]
    username = f"ai_guard_{suffix}"
    user_id: int | None = None
    def choose_guard_sequence(context: dict) -> dict:
        guard = next(item for item in context["candidates"] if item["type"] == "defense")
        attack = next(item for item in context["candidates"] if item["type"] == "attack")
        sequence = [guard["card_template_id"], attack["card_template_id"]]
        remaining_energy = 3 - guard["cost"] - attack["cost"]
        if remaining_energy >= attack["cost"] and attack["available_copies"] >= 2:
            sequence.append(attack["card_template_id"])
        elif remaining_energy >= guard["cost"] and guard["available_copies"] >= 2:
            sequence.append(guard["card_template_id"])
        return {
            "card_template_ids": sequence,
            "battle_line": "先稳住阵脚。",
        }

    monkeypatch.setattr("app.api.battle.choose_enemy_cards", choose_guard_sequence)

    with TestClient(app) as client:
        try:
            token, user_id = _register(client, username)
            headers = _auth(token)
            cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            card_by_id = {card["id"]: card for card in cards}
            with SessionLocal() as db:
                enemy_id = db.scalar(
                    select(NpcTemplate.id).where(NpcTemplate.name == "训练教官")
                )
            assert enemy_id is not None

            battle = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers,
            ).json()["data"]
            hp_before = battle["player_state"]["hp"]
            guarded_response = client.post(
                f"/api/v1/battle/{battle['battle_id']}/end-turn",
                json={"expected_version": battle["version"]},
                headers=headers,
            )
            assert guarded_response.status_code == 200, guarded_response.text
            guarded = guarded_response.json()["data"]
            assert guarded["player_state"]["hp"] < hp_before
            assert guarded["enemy_state"]["shield"] > 0
            assert guarded["last_action"]["type"] == "enemy_cards"
            assert any(card["type"] == "defense" for card in guarded["last_action"]["cards"])
            assert guarded["last_action"]["battle_line"] == "先稳住阵脚。"

            playable_id = next(
                card_id
                for card_id in guarded["hand_cards"]
                if card_by_id[card_id]["cost"] <= guarded["energy"]
                and card_by_id[card_id]["effect"].get("damage", 0) > 0
            )
            played_response = client.post(
                f"/api/v1/battle/{guarded['battle_id']}/play-card",
                json={"card_id": playable_id, "expected_version": guarded["version"]},
                headers=headers,
            )
            assert played_response.status_code == 200, played_response.text
            played = played_response.json()["data"]
            assert played["last_action"]["blocked"] > 0
            assert played["enemy_state"]["shield"] < guarded["enemy_state"]["shield"]
        finally:
            if user_id is not None:
                with SessionLocal() as db:
                    db.execute(delete(User).where(User.id == user_id))
                    db.commit()


def test_plant_collection_and_spirit_gift_flow() -> None:
    suffix = uuid4().hex[:10]
    username = f"plant_{suffix}"
    user_id: int | None = None

    with TestClient(app) as client:
        try:
            token, user_id = _register(client, username)
            headers = _auth(token)
            with SessionLocal() as db:
                player_id = db.scalar(select(Player.id).where(Player.user_id == user_id))
                spirit_template_id = db.scalar(
                    select(CardSpiritTemplate.id).where(CardSpiritTemplate.name == "狼娘·露娜")
                )
                assert player_id is not None and spirit_template_id is not None
                db.add(
                    PlayerCardSpirit(
                        player_id=player_id,
                        spirit_template_id=spirit_template_id,
                    )
                )
                db.commit()
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
                "晨露草": (210, 360),
                "蜜糖莓": (1312, 680),
                "阳铃花": (950, 420),
                "火绒花": (560, 780),
                "风铃藤": (1390, 1080),
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
