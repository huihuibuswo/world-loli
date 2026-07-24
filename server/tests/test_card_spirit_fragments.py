from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import (
    CardSpiritTemplate,
    CardTemplate,
    NpcTemplate,
    Player,
    PlayerCardSpirit,
    PlayerCardSpiritFragment,
    User,
)
from app.services.card_spirit_service import compose_spirit, grant_monster_fragments


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


def test_fixed_monster_fragment_drops() -> None:
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    enemy_ids: list[int] = []
    with TestClient(app) as client:
        try:
            _, user_id, player_id = _register(client, f"fragment_drop_{suffix}")
            with SessionLocal() as db:
                spirit = db.scalar(
                    select(CardSpiritTemplate).where(CardSpiritTemplate.name == "训练教官·卡灵")
                )
                assert spirit is not None
                total = 0
                for rank, expected in (("normal", 1), ("elite", 2), ("boss", 3)):
                    enemy = NpcTemplate(
                        name=f"fragment_{rank}_{suffix}",
                        type="monster",
                        story="测试怪物",
                        battle_deck={"monster_rank": rank, "spirit_template_id": spirit.id},
                        reward={},
                        is_card_spirit=False,
                    )
                    db.add(enemy)
                    db.flush()
                    enemy_ids.append(enemy.id)
                    result = grant_monster_fragments(db, player_id, enemy)
                    total += expected
                    assert result is not None
                    assert result["fragment_delta"] == expected
                    assert result["fragment_count"] == total
                db.commit()
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                if enemy_ids:
                    db.execute(delete(NpcTemplate).where(NpcTemplate.id.in_(enemy_ids)))
                db.commit()


def test_concurrent_spirit_composition_only_consumes_once() -> None:
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    with TestClient(app) as client:
        try:
            _, user_id, player_id = _register(client, f"fragment_concurrent_{suffix}")
            with SessionLocal() as db:
                spirit = db.scalar(
                    select(CardSpiritTemplate).where(CardSpiritTemplate.name == "训练教官·卡灵")
                )
                assert spirit is not None
                spirit_template_id = spirit.id
                db.add(
                    PlayerCardSpiritFragment(
                        player_id=player_id,
                        spirit_template_id=spirit_template_id,
                        amount=60,
                    )
                )
                db.commit()

            def compose_once() -> dict:
                with SessionLocal() as db:
                    result = compose_spirit(db, player_id, spirit_template_id)
                    db.commit()
                    return result

            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(lambda _: compose_once(), range(2)))

            assert sorted(result["composed"] for result in results) == [False, True]
            with SessionLocal() as db:
                owned = db.scalars(
                    select(PlayerCardSpirit).where(
                        PlayerCardSpirit.player_id == player_id,
                        PlayerCardSpirit.spirit_template_id == spirit_template_id,
                    )
                ).all()
                fragment = db.scalar(
                    select(PlayerCardSpiritFragment).where(
                        PlayerCardSpiritFragment.player_id == player_id,
                        PlayerCardSpiritFragment.spirit_template_id == spirit_template_id,
                    )
                )
                assert len(owned) == 1
                assert fragment is not None and fragment.amount == 30
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                db.commit()


def test_monster_victory_and_atomic_spirit_composition(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", False)
    monkeypatch.setattr(settings, "ai_battle_enabled", False)
    suffix = uuid4().hex[:10]
    user_id: int | None = None
    enemy_id: int | None = None

    with TestClient(app) as client:
        try:
            headers, user_id, player_id = _register(client, f"fragment_compose_{suffix}")
            cards = client.get("/api/v1/cards", headers=headers).json()["data"]
            with SessionLocal() as db:
                spirit = db.scalar(
                    select(CardSpiritTemplate).where(CardSpiritTemplate.name == "训练教官·卡灵")
                )
                signature = db.scalar(
                    select(CardTemplate).where(CardTemplate.name == "破绽识破")
                )
                guard = db.scalar(select(CardTemplate).where(CardTemplate.name == "防御姿态"))
                basic = db.scalar(select(CardTemplate).where(CardTemplate.name == "基础攻击"))
                assert spirit is not None and signature is not None and guard is not None and basic is not None
                enemy = NpcTemplate(
                    name=f"compose_monster_{suffix}",
                    type="monster",
                    story="测试怪物",
                    battle_deck={
                        "hp": 1,
                        "energy": 3,
                        "hand_size": 3,
                        "monster_rank": "normal",
                        "spirit_template_id": spirit.id,
                        "cards": [
                            {"card_template_id": signature.id, "amount": 1},
                            {"card_template_id": guard.id, "amount": 1},
                            {"card_template_id": basic.id, "amount": 1},
                        ],
                    },
                    reward={"sprite": "npc-trainer"},
                    is_card_spirit=False,
                )
                db.add(enemy)
                db.commit()
                enemy_id = enemy.id
                spirit_template_id = spirit.id

            battle_response = client.post(
                "/api/v1/battle/create", json={"enemy_id": enemy_id}, headers=headers
            )
            assert battle_response.status_code == 201, battle_response.text
            battle = battle_response.json()["data"]
            assert "enemy_hand_cards" not in battle
            assert "enemy_draw_pile" not in battle
            assert battle["enemy_hand_count"] == 3
            card_by_id = {card["id"]: card for card in cards}
            attack_id = next(
                card_id
                for card_id in battle["hand_cards"]
                if card_by_id[card_id]["effect"].get("damage", 0) > 0
            )
            victory_response = client.post(
                f"/api/v1/battle/{battle['battle_id']}/play-card",
                json={"card_id": attack_id, "expected_version": battle["version"]},
                headers=headers,
            )
            assert victory_response.status_code == 200, victory_response.text
            victory = victory_response.json()["data"]
            assert victory["status"] == "victory"
            assert victory["reward"]["fragment"]["fragment_delta"] == 1
            assert victory["reward"]["fragment"]["fragment_count"] == 1
            assert victory.get("affection_result") is None

            with SessionLocal() as db:
                fragment = db.scalar(
                    select(PlayerCardSpiritFragment).where(
                        PlayerCardSpiritFragment.player_id == player_id,
                        PlayerCardSpiritFragment.spirit_template_id == spirit_template_id,
                    )
                )
                assert fragment is not None
                fragment.amount = 29
                db.commit()

            insufficient = client.post(
                f"/api/v1/spirit-fragments/{spirit_template_id}/compose", headers=headers
            )
            assert insufficient.status_code == 409

            with SessionLocal() as db:
                fragment = db.scalar(
                    select(PlayerCardSpiritFragment).where(
                        PlayerCardSpiritFragment.player_id == player_id,
                        PlayerCardSpiritFragment.spirit_template_id == spirit_template_id,
                    )
                )
                assert fragment is not None
                fragment.amount = 30
                db.commit()

            composed = client.post(
                f"/api/v1/spirit-fragments/{spirit_template_id}/compose", headers=headers
            )
            assert composed.status_code == 200, composed.text
            assert composed.json()["data"]["composed"] is True
            assert composed.json()["data"]["fragment_count"] == 0

            duplicate = client.post(
                f"/api/v1/spirit-fragments/{spirit_template_id}/compose", headers=headers
            )
            assert duplicate.status_code == 200
            assert duplicate.json()["data"]["composed"] is False
            with SessionLocal() as db:
                assert db.scalar(
                    select(PlayerCardSpirit.id).where(
                        PlayerCardSpirit.player_id == player_id,
                        PlayerCardSpirit.spirit_template_id == spirit_template_id,
                    )
                )
                fragment = db.scalar(
                    select(PlayerCardSpiritFragment).where(
                        PlayerCardSpiritFragment.player_id == player_id,
                        PlayerCardSpiritFragment.spirit_template_id == spirit_template_id,
                    )
                )
                assert fragment is not None and fragment.amount == 0
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                if enemy_id is not None:
                    db.execute(delete(NpcTemplate).where(NpcTemplate.id == enemy_id))
                db.commit()
