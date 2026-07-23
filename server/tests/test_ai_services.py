import json

import httpx
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.core.config import settings
from app.models import NpcTemplate, Player
from app.services.ai_client import AiCompletion, AiProviderError, OpenAiCompatibleClient
from app.services.ai_profile import get_npc_ai_profile
from app.services.battle_ai_service import choose_enemy_action
from app.services.npc_ai_service import _append_summary, _generate_reply, normalize_player_message


class FakeAiClient:
    def __init__(self, data: dict) -> None:
        self.data = data

    def complete_json(self, *args, **kwargs) -> AiCompletion:
        return AiCompletion(self.data, prompt_tokens=12, completion_tokens=7)


class FailingAiClient:
    def complete_json(self, *args, **kwargs) -> AiCompletion:
        raise AiProviderError("timeout")


def _configure_ai(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_battle_enabled", True)
    monkeypatch.setattr(settings, "ai_base_url", "https://ai.example.test/v1")
    monkeypatch.setattr(settings, "ai_api_key", SecretStr("test-key"))
    monkeypatch.setattr(settings, "ai_model", "test-model")


def test_openai_compatible_client_decodes_json_fence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_ai(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer test-key"
        payload = json.loads(request.content)
        assert payload["response_format"] == {"type": "json_object"}
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": '```json\n{"reply":"你好","suggested_replies":["继续","离开"]}\n```'
                        }
                    }
                ],
                "usage": {"prompt_tokens": 3, "completion_tokens": 5},
            },
        )

    completion = OpenAiCompatibleClient(httpx.MockTransport(handler)).complete_json(
        [{"role": "user", "content": "你好"}],
        timeout_seconds=1,
        temperature=0.5,
    )

    assert completion.data["reply"] == "你好"
    assert completion.prompt_tokens == 3
    assert completion.completion_tokens == 5


def test_openai_compatible_client_rejects_non_object_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_ai(monkeypatch)
    transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200,
            json={"choices": [{"message": {"content": '["not-an-object"]'}}]},
        )
    )

    with pytest.raises(AiProviderError):
        OpenAiCompatibleClient(transport).complete_json(
            [{"role": "user", "content": "test"}],
            timeout_seconds=1,
            temperature=0,
        )


def test_battle_ai_accepts_only_server_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_ai(monkeypatch)
    monkeypatch.setattr(
        "app.services.battle_ai_service.get_ai_client",
        lambda: FakeAiClient({"action_id": "guard", "battle_line": "先稳住阵脚。"}),
    )
    context = {
        "enemy_id": 7,
        "enemy_name": "训练教官",
        "battle_enabled": True,
        "battle_style": "稳健",
        "state": {
            "current_turn": 2,
            "player_state": {"hp": 80, "max_hp": 100},
            "enemy_state": {"hp": 12, "max_hp": 30, "shield": 0},
        },
        "candidates": [
            {"id": "basic_attack", "description": "攻击", "tags": ["damage"]},
            {"id": "guard", "description": "防御", "tags": ["defense"]},
        ],
    }

    assert choose_enemy_action(context) == {
        "action_id": "guard",
        "battle_line": "先稳住阵脚。",
    }

    monkeypatch.setattr(
        "app.services.battle_ai_service.get_ai_client",
        lambda: FakeAiClient({"action_id": "invent_reward", "battle_line": "送你奖励。"}),
    )
    assert choose_enemy_action(context) == {
        "action_id": "basic_attack",
        "battle_line": None,
    }

    monkeypatch.setattr(
        "app.services.battle_ai_service.get_ai_client",
        lambda: FailingAiClient(),
    )
    assert choose_enemy_action(context) == {
        "action_id": "basic_attack",
        "battle_line": None,
    }


def test_npc_ai_generates_reply_and_two_suggestions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_ai(monkeypatch)
    monkeypatch.setattr(settings, "ai_dialogue_enabled", True)
    monkeypatch.setattr(
        "app.services.npc_ai_service.get_ai_client",
        lambda: FakeAiClient(
            {
                "reply": "先练习稳定出牌。",
                "suggested_replies": ["从哪张牌开始？", "现在就切磋"],
            }
        ),
    )
    npc = NpcTemplate(
        id=9,
        name="训练教官",
        type="training",
        story="负责实战训练。",
        battle_deck={"hp": 20, "attack": 3},
        reward={
            "actions": ["dialog", "battle"],
            "ai_profile": {
                "dialogue_enabled": True,
                "battle_enabled": True,
                "persona": "严格但耐心的训练教官",
                "fallback_replies": ["继续聊聊", "换个话题"],
            },
        },
        is_card_spirit=False,
    )
    player = Player(id=3, user_id=4, name="测试玩家", level=2)

    reply, suggestions, mode = _generate_reply(
        npc,
        player,
        get_npc_ai_profile(npc),
        None,
        "今天练什么？",
    )

    assert reply == "先练习稳定出牌。"
    assert suggestions == ["从哪张牌开始？", "现在就切磋"]
    assert mode == "ai"


def test_dialogue_input_safety_and_summary_bounds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_max_input_chars", 20)
    monkeypatch.setattr(settings, "ai_blocked_terms", "secret,禁词")
    assert normalize_player_message("  你好，教官  ") == "你好,教官"

    with pytest.raises(HTTPException) as blocked:
        normalize_player_message("这里包含禁词")
    assert blocked.value.status_code == 422

    monkeypatch.setattr(settings, "ai_memory_summary_chars", 30)
    summary = _append_summary(
        "旧摘要",
        [{"player": "玩家说了很长的一段话", "npc": "NPC 也回答了一段很长的话"}],
    )
    assert len(summary) <= 30
