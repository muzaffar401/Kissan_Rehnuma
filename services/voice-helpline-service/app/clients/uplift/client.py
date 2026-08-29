import logging

import httpx
from pydantic import ValidationError

from app.clients.uplift.exceptions import UpliftClientError
from app.clients.uplift.schemas import UpliftSessionRequest, UpliftSessionResponse
from app.core.config import Settings

logger = logging.getLogger(__name__)


class UpliftClient:
    def __init__(self, settings: Settings, http_client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=str(settings.uplift_api_base_url).rstrip("/"),
            timeout=httpx.Timeout(
                connect=settings.uplift_connect_timeout_seconds,
                read=settings.uplift_read_timeout_seconds,
                write=settings.uplift_read_timeout_seconds,
                pool=settings.uplift_connect_timeout_seconds,
            ),
            headers={
                "Authorization": f"Bearer {settings.uplift_api_key.get_secret_value()}",
                "Content-Type": "application/json",
            },
        )

    async def create_session(self, participant_name: str) -> UpliftSessionResponse:
        request = UpliftSessionRequest(participant_name=participant_name)
        path = f"/v1/realtime-assistants/{self._settings.uplift_assistant_id}/createSession"
        try:
            response = await self._client.post(
                path, json=request.model_dump(by_alias=True, exclude_none=True)
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise UpliftClientError("uplift_timeout", "Uplift AI timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Uplift session request failed with status %s", exc.response.status_code
            )
            raise UpliftClientError(
                "uplift_http_error",
                "Uplift AI rejected the session request",
                exc.response.status_code,
            ) from exc
        except httpx.HTTPError as exc:
            raise UpliftClientError("uplift_unavailable", "Uplift AI is unavailable") from exc

        try:
            return UpliftSessionResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise UpliftClientError(
                "uplift_invalid_response", "Uplift AI returned an invalid response"
            ) from exc

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
