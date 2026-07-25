from copy import deepcopy
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import (
    ActiveBattle,
    CardSpiritTemplate,
    CardTemplate,
    NpcTemplate,
    User,
)
from app.services.battle_service import (
    _draw_to_hand,
    deterministic_enemy_sequence,
)


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


def test_registration_uses_explicit_balanced_starter_deck() -> None:
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    with TestClient(app) as client:
        try:
            headers, user_id, _ = _register(client, f"balance_starter_{suffix}")
            profile = client.get("/api/v1/player/profile", headers=headers).json()["data"]
            assert profile["hp"] == 75

            cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            assert {card["name"]: card["count"] for card in cards} == {
                "基础攻击": 6,
                "防御姿态": 6,
            }
            deck = client.get("/api/v1/decks", headers=headers).json()["data"][0]
            assert {item["name"]: item["amount"] for item in deck["cards"]} == {
                "基础攻击": 6,
                "防御姿态": 6,
            }
            assert client.get("/api/v1/spirits", headers=headers).json()["data"] == []
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                db.commit()


def test_current_battle_endpoint_recovers_server_state() -> None:
    suffix = uuid4().hex[:10]
    username = f"battle_resume_{suffix}"
    user_id: int | None = None
    other_user_id: int | None = None
    with TestClient(app) as client:
        try:
            headers, user_id, _ = _register(client, username)
            empty_response = client.get("/api/v1/battle/current", headers=headers)
            assert empty_response.status_code == 200
            assert empty_response.json()["data"] is None

            with SessionLocal() as db:
                enemy_id = db.scalar(
                    select(NpcTemplate.id).where(NpcTemplate.name == "训练教官")
                )
            assert enemy_id is not None

            created_response = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": enemy_id},
                headers=headers,
            )
            assert created_response.status_code == 201, created_response.text
            created = created_response.json()["data"]

            other_headers, other_user_id, _ = _register(
                client, f"battle_resume_other_{suffix}"
            )
            other_response = client.get(
                "/api/v1/battle/current", headers=other_headers
            )
            assert other_response.status_code == 200
            assert other_response.json()["data"] is None

            login_response = client.post(
                "/api/v1/auth/login",
                json={"username": username, "password": "SafePassword123!"},
            )
            assert login_response.status_code == 200, login_response.text
            resumed_headers = {
                "Authorization": f"Bearer {login_response.json()['data']['access_token']}"
            }

            recovered_response = client.get(
                "/api/v1/battle/current", headers=resumed_headers
            )
            assert recovered_response.status_code == 200
            recovered = recovered_response.json()["data"]
            assert recovered["battle_id"] == created["battle_id"]
            assert recovered["status"] == "active"
            assert recovered["version"] == created["version"]

            surrendered_response = client.post(
                f"/api/v1/battle/{created['battle_id']}/surrender",
                json={"expected_version": created["version"]},
                headers=resumed_headers,
            )
            assert surrendered_response.status_code == 200, surrendered_response.text
            assert (
                client.get("/api/v1/battle/current", headers=resumed_headers).json()["data"]
                is None
            )
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                if other_user_id is not None:
                    db.execute(delete(User).where(User.id == other_user_id))
                db.commit()


def test_seeded_reshuffle_is_reproducible_and_private() -> None:
    base_state = {
        "battle_seed": 20260724,
        "player_shuffle_count": 0,
        "hand_cards": [],
        "draw_pile": [],
        "discard_cards": list(range(1, 11)),
    }
    first = deepcopy(base_state)
    second = deepcopy(base_state)
    different = deepcopy(base_state)
    different["battle_seed"] += 1

    _draw_to_hand(first)
    _draw_to_hand(second)
    _draw_to_hand(different)

    assert first["hand_cards"] == second["hand_cards"]
    assert first["draw_pile"] == second["draw_pile"]
    assert first["hand_cards"] != different["hand_cards"]
    assert first["player_shuffle_count"] == 1


def test_deterministic_fallback_uses_actor_weights() -> None:
    attack = CardTemplate(id=101, name="战术打击", type="attack", cost=1, rarity="common", effect_json={"damage": 8})
    guard = CardTemplate(id=102, name="防御姿态", type="defense", cost=1, rarity="common", effect_json={"shield": 8})
    signature = CardTemplate(id=103, name="炽热锻击", type="attack", cost=2, rarity="rare", effect_json={"damage": 16})
    templates = {item.id: item for item in (attack, guard, signature)}
    state = {"player_state": {"hp": 75, "shield": 0}}

    assert deterministic_enemy_sequence(
        [attack.id, guard.id, signature.id],
        3,
        templates,
        state,
        {"damage": 1.25, "shield": 0.55},
    ) == [signature.id, attack.id]
    assert deterministic_enemy_sequence(
        [attack.id, guard.id, signature.id],
        3,
        templates,
        state,
        {"damage": 0.75, "shield": 1.2},
    ) == [signature.id, guard.id]


def test_defeat_and_surrender_apply_the_same_penalty_once(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_battle_enabled", False)
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    enemy_id: int | None = None
    with TestClient(app) as client:
        try:
            headers, user_id, player_id = _register(client, f"balance_defeat_{suffix}")
            with SessionLocal() as db:
                spirit = db.scalar(
                    select(CardSpiritTemplate).where(CardSpiritTemplate.name == "狼娘·露娜")
                )
                signature = db.scalar(
                    select(CardTemplate).where(CardTemplate.name == "月牙撕裂")
                )
                assert spirit is not None and signature is not None
                enemy = NpcTemplate(
                    name=f"高压测试敌人_{suffix}",
                    type="monster",
                    story="用于验证败北结算。",
                    battle_deck={
                        "hp": 999,
                        "energy": 20,
                        "hand_size": 10,
                        "monster_rank": "normal",
                        "spirit_template_id": spirit.id,
                        "cards": [{"card_template_id": signature.id, "amount": 10}],
                        "action_weights": {"damage": 1.0, "shield": 0.0},
                    },
                    reward={"sprite": "npc-luna"},
                    is_card_spirit=False,
                )
                db.add(enemy)
                db.commit()
                enemy_id = enemy.id

            created = client.post(
                "/api/v1/battle/create", json={"enemy_id": enemy_id}, headers=headers
            )
            assert created.status_code == 201, created.text
            public_battle = created.json()["data"]
            assert "battle_seed" not in public_battle
            with SessionLocal() as db:
                stored = db.scalar(
                    select(ActiveBattle).where(
                        ActiveBattle.player_id == player_id,
                        ActiveBattle.id == public_battle["battle_id"],
                    )
                )
                assert stored is not None
                assert isinstance(stored.state_json.get("battle_seed"), int)

            defeated = client.post(
                f"/api/v1/battle/{public_battle['battle_id']}/end-turn",
                json={"expected_version": public_battle["version"]},
                headers=headers,
            )
            assert defeated.status_code == 200, defeated.text
            result = defeated.json()["data"]
            assert result["status"] == "defeat"
            assert result["reward"] == {}
            assert result.get("affection_result") is None
            assert result["defeat_reason"] == "knockout"
            assert result["penalty"] == {"gold_lost": 30, "gold_remaining": 270}
            assert client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"] == 270

            second_created = client.post(
                "/api/v1/battle/create", json={"enemy_id": enemy_id}, headers=headers
            )
            assert second_created.status_code == 201, second_created.text
            second_battle = second_created.json()["data"]
            surrendered = client.post(
                f"/api/v1/battle/{second_battle['battle_id']}/surrender",
                json={"expected_version": second_battle["version"]},
                headers=headers,
            )
            assert surrendered.status_code == 200, surrendered.text
            surrender_result = surrendered.json()["data"]
            assert surrender_result["status"] == "defeat"
            assert surrender_result["defeat_reason"] == "surrender"
            assert surrender_result["penalty"] == {
                "gold_lost": 30,
                "gold_remaining": 240,
            }

            duplicate = client.post(
                f"/api/v1/battle/{second_battle['battle_id']}/surrender",
                json={"expected_version": second_battle["version"]},
                headers=headers,
            )
            assert duplicate.status_code == 409
            assert client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"] == 240
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                if enemy_id is not None:
                    db.execute(delete(NpcTemplate).where(NpcTemplate.id == enemy_id))
                db.commit()


def test_suna_is_not_guaranteed_victory_with_attack_only_strategy(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_battle_enabled", False)
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    with TestClient(app) as client:
        try:
            headers, user_id, _ = _register(client, f"balance_suna_{suffix}")
            cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            card_by_id = {card["id"]: card for card in cards}
            with SessionLocal() as db:
                suna_id = db.scalar(
                    select(NpcTemplate.id).where(NpcTemplate.name == "铁匠少女苏娜")
                )
            assert suna_id is not None

            outcomes: list[str] = []
            for seed in range(1, 17):
                monkeypatch.setattr(
                    "app.services.battle_service.randbits",
                    lambda _bits, current_seed=seed: current_seed,
                )
                created = client.post(
                    "/api/v1/battle/create", json={"enemy_id": suna_id}, headers=headers
                )
                assert created.status_code == 201, created.text
                current = created.json()["data"]
                for _ in range(40):
                    if current["status"] != "active":
                        break
                    attacks = [
                        card_by_id[card_id]
                        for card_id in set(current["hand_cards"])
                        if card_by_id[card_id]["cost"] <= current["energy"]
                        and card_by_id[card_id]["effect"].get("damage", 0) > 0
                    ]
                    if attacks:
                        chosen = max(
                            attacks,
                            key=lambda card: card["effect"].get("damage", 0),
                        )
                        response = client.post(
                            f"/api/v1/battle/{current['battle_id']}/play-card",
                            json={
                                "card_id": chosen["id"],
                                "expected_version": current["version"],
                            },
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
                assert current["status"] in {"victory", "defeat"}
                outcomes.append(current["status"])

            assert outcomes.count("defeat") >= 2, outcomes
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                db.commit()
