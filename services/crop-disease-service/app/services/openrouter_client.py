"""Direct OpenRouter API client — bypasses LangChain for speed.

LangChain's ChatOpenRouter + with_structured_output() adds 15-25%
latency overhead (serialization, tool-definition tokens, middleware).
This module calls the OpenRouter REST API directly via httpx with
native json_schema response_format for maximum speed.
"""

import json
import re
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Timeout: 90s for the full request (model thinking + generation)
_TIMEOUT = httpx.Timeout(90.0, connect=10.0)


class OpenRouterError(Exception):
    """Raised when the OpenRouter API call fails."""


def _build_json_schema(model: type[BaseModel]) -> dict:
    """Convert a Pydantic model to a JSON Schema dict for OpenRouter."""
    schema = model.model_json_schema()
    # Strip $defs / definitions that some models inject
    schema.pop("$defs", None)
    schema.pop("definitions", None)
    return schema


def _extract_json(text: str) -> dict:
    """Extract a JSON object from model output.

    Models sometimes wrap JSON in markdown code fences or add
    explanatory text. This handles all common cases.
    """
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code blocks
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    # Try again after stripping
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract JSON object from surrounding text
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise OpenRouterError(
        f"Failed to parse JSON from model response: {text[:120]}..."
    )


async def call_vision_model(
    prompt_text: str,
    image_data_uri: str,
    response_model: type[BaseModel],
) -> BaseModel:
    """Call OpenRouter with a vision prompt and structured output.

    Args:
        prompt_text: Full user prompt (including system context).
        image_data_uri: Data URI of the image (data:mime;base64,...).
        response_model: Pydantic model to validate the response.

    Returns:
        Validated instance of response_model.
    """
    settings = get_settings()
    json_schema = _build_json_schema(response_model)

    payload: dict[str, Any] = {
        "model": settings.vision_model,
        "messages": [
            {"role": "system", "content": prompt_text},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this crop image and return the JSON.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_uri},
                    },
                ],
            },
        ],
        "temperature": settings.vision_temperature,
        "max_tokens": settings.vision_max_tokens,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": response_model.__name__,
                "strict": True,
                "schema": json_schema,
            },
        },
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": "https://kissan-rehnuma.app",
        "X-Title": "Kissan Rehnuma",
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(
                OPENROUTER_URL, json=payload, headers=headers
            )
        except httpx.TimeoutException:
            raise OpenRouterError("OpenRouter request timed out")
        except httpx.ConnectError:
            raise OpenRouterError("Cannot connect to OpenRouter")

        if resp.status_code != 200:
            body = resp.text[:300]
            raise OpenRouterError(
                f"OpenRouter API error {resp.status_code}: {body}"
            )

        data = resp.json()

    choices = data.get("choices", [])
    if not choices:
        raise OpenRouterError("OpenRouter returned no choices")

    content = choices[0]["message"]["content"]
    parsed = _extract_json(content)

    return response_model.model_validate(parsed)
