from collections.abc import AsyncIterator
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.clients.uplift.schemas import UpliftSessionResponse
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app


class FakeUpliftClient:
    async def create_session(self, participant_name: str) -> UpliftSessionResponse:
        return UpliftSessionResponse(
            token="safe-client-token",
            wsUrl="wss://live.example",
            roomName=f"room-{participant_name}",
        )


@pytest.fixture
async def api_client() -> AsyncIterator[httpx.AsyncClient]:
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_db() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.state.uplift_client = FakeUpliftClient()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_session_and_idempotent_complaint_flow(api_client: httpx.AsyncClient) -> None:
    farmer_id = str(uuid4())
    identity = {"X-User-Id": farmer_id, "X-User-Name": "Ali"}

    session_response = await api_client.post(
        "/api/v1/helpline/sessions", json={"language": "ur"}, headers=identity
    )
    assert session_response.status_code == 201
    session_data = session_response.json()
    assert session_data["token"] == "safe-client-token"

    complaint_payload = {
        "helpline_session_id": session_data["session_id"],
        "category": "crop_disease",
        "crop": "gandum",
        "description": "Patton par bhooray dhabbe hain",
        "district": "Multan",
        "urgency": "normal",
    }
    headers = {**identity, "Idempotency-Key": "tool-call-0001"}
    first = await api_client.post("/api/v1/complaints", json=complaint_payload, headers=headers)
    second = await api_client.post("/api/v1/complaints", json=complaint_payload, headers=headers)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["reference_number"].startswith("KR-")


@pytest.mark.asyncio
async def test_identity_is_required(api_client: httpx.AsyncClient) -> None:
    response = await api_client.post("/api/v1/helpline/sessions", json={"language": "ur"})
    assert response.status_code == 422
