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


def _lose_battle(client: TestClient, headers: dict[str, str], battle: dict) -> dict:
    current = battle
    for _ in range(40):
        response = client.post(
            f"/api/v1/battle/{current['battle_id']}/end-turn",
            json={"expected_version": current["version"]},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        current = response.json()["data"]
        if current["status"] != "active":
            return current
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
                guide = db.scalar(select(NpcTemplate).where(NpcTemplate.name == "森林向导"))
                shadow = db.scalar(select(NpcTemplate).where(NpcTemplate.name == "雾痕兽影"))
                assert guide is not None
                assert shadow is not None
                guide_id = guide.id
                shadow_id = shadow.id

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
            assert abandoned_data["story_intro"]["event"] == "luna_resonance"
            assert len(abandoned_data["story_intro"]["dialogue"]) == 3
            assert "负伤" in abandoned_data["story_intro"]["message"]
            assert "基础卡牌" in abandoned_data["story_intro"]["dialogue"][-1]["text"]
            resumed_battle = client.get("/api/v1/battle/current", headers=headers)
            assert resumed_battle.status_code == 200, resumed_battle.text
            assert resumed_battle.json()["data"]["story_intro"] == abandoned_data["story_intro"]
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

            defeated_battle = client.post(
                "/api/v1/battle/create", json={"enemy_id": luna_id}, headers=headers
            )
            assert defeated_battle.status_code == 201, defeated_battle.text
            defeated_data = _lose_battle(client, headers, defeated_battle.json()["data"])
            assert defeated_data["status"] == "defeat"
            assert defeated_data["defeat_reason"] == "knockout"
            assert defeated_data["reward"] == {}
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
            assert opening_reward["reward_kind"] == "fixed_newbie_reward"
            assert "完整「狼娘·露娜」卡灵" in opening_reward["message"]
            assert "已加入收藏和启用套牌" in opening_reward["message"]
            assert len(opening_reward["dialogue"]) == 7
            assert "卡灵投影" in opening_reward["dialogue"][3]["text"]
            assert opening_reward["dialogue"][-1]["text"] == "那就……拜托你了。"
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
                assert progress.data_json["luna_injured"] is True
                assert progress.data_json["luna_recovery_state"] == "returning_to_village"
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
            assert len(completed_data["completion_dialogue"]) == 5
            assert "疗养" in completed_data["completion_dialogue"][1]["text"]
            assert completed_data["main_quest"]["title"] == "月痕追迹"
            assert completed_data["main_quest"]["chapter"] == "逆流雾源"
            assert completed_data["main_quest"]["stage"] == "moon_trace_accept"
            assert all(task["status"] == "completed" for task in completed_data["tasks"])

            premature_guide = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "confirm_guide", "npc_id": guide_id},
                headers=headers,
            )
            assert premature_guide.status_code == 409
            premature_report = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "report_stage1", "npc_id": luna_id},
                headers=headers,
            )
            assert premature_report.status_code == 409

            gold_after = client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"]
            duplicate = client.post("/api/v1/opening/complete", headers=headers)
            assert duplicate.status_code == 200, duplicate.text
            assert duplicate.json()["data"]["completed_now"] is False
            assert duplicate.json()["data"]["gold_reward"] == 0
            assert client.get("/api/v1/player/profile", headers=headers).json()["data"]["gold"] == gold_after

            accepted = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "accept_stage1", "npc_id": luna_id},
                headers=headers,
            )
            assert accepted.status_code == 200, accepted.text
            assert accepted.json()["data"]["main_quest"]["stage"] == "moon_trace_guide"
            repeated_accept = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "accept_stage1", "npc_id": luna_id},
                headers=headers,
            )
            assert repeated_accept.status_code == 200, repeated_accept.text
            assert repeated_accept.json()["data"]["main_quest"]["stage"] == "moon_trace_guide"

            guide_context = client.get(f"/api/v1/npc/{guide_id}", headers=headers)
            assert guide_context.status_code == 200, guide_context.text
            assert guide_context.json()["data"]["story_action"]["action"] == "confirm_guide"
            guided = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "confirm_guide", "npc_id": guide_id},
                headers=headers,
            )
            assert guided.status_code == 200, guided.text
            assert guided.json()["data"]["main_quest"]["stage"] == "moon_trace_evidence"
            repeated_guide = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "confirm_guide", "npc_id": guide_id},
                headers=headers,
            )
            assert repeated_guide.status_code == 200, repeated_guide.text
            assert repeated_guide.json()["data"]["main_quest"]["stage"] == "moon_trace_evidence"

            forest_again = client.post(
                "/api/v1/map/enter",
                json={"map_id": forest["id"]},
                headers=headers,
            )
            assert forest_again.status_code == 200, forest_again.text

            premature_shadow = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": shadow_id},
                headers=headers,
            )
            assert premature_shadow.status_code == 409

            evidence_ids = [
                "moonlight_flora",
                "broken_wolf_tracks",
                "broken_moon_mist_core",
            ]
            for index, evidence_id in enumerate(evidence_ids):
                inspected = client.post(
                    "/api/v1/opening/moon-trace/action",
                    json={"action": "inspect_evidence", "evidence_id": evidence_id},
                    headers=headers,
                )
                assert inspected.status_code == 200, inspected.text
                main_quest = inspected.json()["data"]["main_quest"]
                assert main_quest["evidence_count"] == index + 1
                expected_stage = (
                    "moon_trace_battle" if index == len(evidence_ids) - 1
                    else "moon_trace_evidence"
                )
                assert main_quest["stage"] == expected_stage

            duplicate_evidence = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "inspect_evidence", "evidence_id": evidence_ids[-1]},
                headers=headers,
            )
            assert duplicate_evidence.status_code == 200, duplicate_evidence.text
            assert duplicate_evidence.json()["data"]["main_quest"]["evidence_count"] == 3

            defeated_shadow_battle = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": shadow_id},
                headers=headers,
            )
            assert defeated_shadow_battle.status_code == 201, defeated_shadow_battle.text
            defeated_shadow = _lose_battle(
                client,
                headers,
                defeated_shadow_battle.json()["data"],
            )
            assert defeated_shadow["status"] == "defeat"
            assert defeated_shadow["defeat_reason"] == "knockout"
            assert defeated_shadow["penalty"]["gold_lost"] > 0
            assert (
                client.get("/api/v1/opening", headers=headers)
                .json()["data"]["main_quest"]["stage"]
                == "moon_trace_battle"
            )

            abandoned_shadow = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": shadow_id},
                headers=headers,
            )
            assert abandoned_shadow.status_code == 201, abandoned_shadow.text
            surrendered_shadow = client.post(
                f"/api/v1/battle/{abandoned_shadow.json()['data']['battle_id']}/surrender",
                json={"expected_version": abandoned_shadow.json()["data"]["version"]},
                headers=headers,
            )
            assert surrendered_shadow.status_code == 200, surrendered_shadow.text
            assert surrendered_shadow.json()["data"]["status"] == "defeat"
            assert (
                client.get("/api/v1/opening", headers=headers)
                .json()["data"]["main_quest"]["stage"]
                == "moon_trace_battle"
            )

            shadow_battle = client.post(
                "/api/v1/battle/create",
                json={"enemy_id": shadow_id},
                headers=headers,
            )
            assert shadow_battle.status_code == 201, shadow_battle.text
            shadow_victory = _finish_battle(
                client,
                headers,
                shadow_battle.json()["data"],
                {card["id"]: card for card in cards_after},
            )
            assert shadow_victory["status"] == "victory"
            assert "fragment" not in shadow_victory["reward"]
            assert shadow_victory["reward"]["opening"]["event"] == "moon_trace_shadow"
            assert (
                client.get("/api/v1/opening", headers=headers)
                .json()["data"]["main_quest"]["stage"]
                == "moon_trace_return"
            )
            repeated_evidence_after_victory = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "inspect_evidence", "evidence_id": evidence_ids[-1]},
                headers=headers,
            )
            assert repeated_evidence_after_victory.status_code == 200
            assert (
                repeated_evidence_after_victory.json()["data"]["main_quest"]["stage"]
                == "moon_trace_return"
            )

            returned_again = client.post(
                "/api/v1/map/enter",
                json={"map_id": village["id"]},
                headers=headers,
            )
            assert returned_again.status_code == 200, returned_again.text
            reported = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "report_stage1", "npc_id": luna_id},
                headers=headers,
            )
            assert reported.status_code == 200, reported.text
            final_quest = reported.json()["data"]["main_quest"]
            assert final_quest["stage"] == "moon_trace_stage1_complete"
            assert final_quest["stage1_completed"] is True
            assert final_quest["objective"]["title"] == "追查操纵断月纹的人"

            repeated_report = client.post(
                "/api/v1/opening/moon-trace/action",
                json={"action": "report_stage1", "npc_id": luna_id},
                headers=headers,
            )
            assert repeated_report.status_code == 200, repeated_report.text
            assert repeated_report.json()["data"]["main_quest"] == final_quest
        finally:
            with SessionLocal() as db:
                if user_id is not None:
                    db.execute(delete(User).where(User.id == user_id))
                db.commit()
