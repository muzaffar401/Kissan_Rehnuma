import httpx
import pytest

from app.clients.uplift.client import UpliftClient
from app.clients.uplift.exceptions import UpliftClientError
from app.core.config import Settings


def settings() -> Settings:
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        uplift_api_key="secret",
        uplift_assistant_id="assistant-123",
    )


@pytest.mark.asyncio
async def test_create_session_maps_uplift_contract() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/realtime-assistants/assistant-123/createSession"
        assert request.headers["authorization"] == "Bearer secret"
        assert request.read() == b'{"participantName":"Ali"}'
        return httpx.Response(
            200,
            json={"token": "jwt", "wsUrl": "wss://live.example", "roomName": "room-1"},
        )

    http_client = httpx.AsyncClient(
        base_url="https://api.upliftai.org", transport=httpx.MockTransport(handler)
    )
    client = UpliftClient(settings(), http_client)

    response = await client.create_session("Ali")

    assert response.token == "jwt"
    assert response.room_name == "room-1"
    await http_client.aclose()


@pytest.mark.asyncio
async def test_create_session_hides_upstream_error_body() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "sensitive-provider-detail"})

    http_client = httpx.AsyncClient(
        base_url="https://api.upliftai.org", transport=httpx.MockTransport(handler)
    )
    client = UpliftClient(settings(), http_client)

    with pytest.raises(UpliftClientError) as raised:
        await client.create_session("Ali")

    assert raised.value.code == "uplift_http_error"
    assert "sensitive-provider-detail" not in str(raised.value)
    await http_client.aclose()

