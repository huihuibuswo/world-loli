from dataclasses import dataclass
from typing import Any

from app.models import NpcTemplate


DEFAULT_FALLBACK_REPLIES = ("继续聊聊", "换个话题")


@dataclass(frozen=True)
class NpcAiProfile:
    dialogue_enabled: bool
    battle_enabled: bool
    persona: str
    fallback_replies: tuple[str, str]
    battle_style: str


def _text(value: Any, default: str, max_length: int) -> str:
    text = str(value or "").strip()
    return text[:max_length] if text else default


def _fallback_replies(value: Any) -> tuple[str, str]:
    if isinstance(value, list):
        replies = []
        for item in value:
            text = _text(item, "", 80)
            if text and text not in replies:
                replies.append(text)
            if len(replies) == 2:
                return replies[0], replies[1]
    return DEFAULT_FALLBACK_REPLIES


def get_npc_ai_profile(npc: NpcTemplate) -> NpcAiProfile:
    reward = npc.reward or {}
    raw = reward.get("ai_profile")
    profile = raw if isinstance(raw, dict) else {}
    return NpcAiProfile(
        dialogue_enabled=bool(profile.get("dialogue_enabled", False)),
        battle_enabled=bool(profile.get("battle_enabled", False)),
        persona=_text(
            profile.get("persona"),
            f"{npc.name}。{npc.story}".strip("。"),
            1200,
        ),
        fallback_replies=_fallback_replies(profile.get("fallback_replies")),
        battle_style=_text(profile.get("battle_style"), "选择稳妥且合法的行动", 400),
    )
