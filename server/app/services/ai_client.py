import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx

from app.core.config import settings


class AiProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class AiCompletion:
    data: dict[str, Any]
    prompt_tokens: int = 0
    completion_tokens: int = 0


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") in (None, "text")
        )
    raise AiProviderError("AI 响应缺少文本内容")


def _decode_json_object(content: Any) -> dict[str, Any]:
    text = _content_text(content).strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise AiProviderError("AI 返回了无效 JSON") from exc
    if not isinstance(value, dict):
        raise AiProviderError("AI JSON 顶层必须是对象")
    return value


class OpenAiCompatibleClient:
    def __init__(self, transport: httpx.BaseTransport | None = None) -> None:
        self._transport = transport

    def complete_json(
        self,
        messages: list[dict[str, str]],
        *,
        timeout_seconds: float,
        temperature: float,
    ) -> AiCompletion:
        if not settings.ai_configured or settings.ai_api_key is None:
            raise AiProviderError("AI 服务未配置")

        endpoint = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": settings.ai_model,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {settings.ai_api_key.get_secret_value()}",
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(
                timeout=httpx.Timeout(timeout_seconds),
                transport=self._transport,
            ) as client:
                response = client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                body = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AiProviderError("AI 服务调用失败") from exc

        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AiProviderError("AI 响应结构无效") from exc

        usage = body.get("usage") if isinstance(body, dict) else None
        return AiCompletion(
            data=_decode_json_object(content),
            prompt_tokens=int((usage or {}).get("prompt_tokens", 0)),
            completion_tokens=int((usage or {}).get("completion_tokens", 0)),
        )


@lru_cache
def get_ai_client() -> OpenAiCompatibleClient:
    return OpenAiCompatibleClient()
