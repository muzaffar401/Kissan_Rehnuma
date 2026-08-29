"""Custom Uplift AI TTS plugin for LiveKit Agents.

Implements a TTS provider that calls Uplift AI's HTTP Synthesis API
to convert text to Urdu speech audio.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, replace
from typing import ClassVar

import aiohttp
from livekit.agents import (
    APIConnectionError,
    APIConnectOptions,
    APIError,
    APIStatusError,
    APITimeoutError,
    tts,
    utils,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, NOT_GIVEN, NotGivenOr
from livekit.agents.utils import is_given

from app.core.logging import logger

# Uplift AI voice IDs
VOICE_INFO_EDU = "v_8eelc901"
VOICE_GEN_Z = "v_kwmp7zxt"
VOICE_DADA_JEE = "v_yypgzenx"
VOICE_NOSTALGIC = "v_30s70t3a"

# Audio format options
FORMAT_WAV_22050_16 = "WAV_22050_16"
FORMAT_WAV_22050_32 = "WAV_22050_32"
FORMAT_MP3_22050_32 = "MP3_22050_32"
FORMAT_MP3_22050_64 = "MP3_22050_64"
FORMAT_MP3_22050_128 = "MP3_22050_128"
FORMAT_OGG_22050_16 = "OGG_22050_16"
FORMAT_ULAW_8000_8 = "ULAW_8000_8"

DEFAULT_VOICE_ID = VOICE_INFO_EDU
DEFAULT_OUTPUT_FORMAT = FORMAT_WAV_22050_16
DEFAULT_BASE_URL = "https://api.upliftai.org/v1/synthesis/text-to-speech"
SAMPLE_RATE = 22050


def _format_to_mime(output_format: str) -> str:
    """Convert Uplift output format to MIME type."""
    if output_format.startswith("WAV"):
        return "audio/wav"
    elif output_format.startswith("MP3"):
        return "audio/mpeg"
    elif output_format.startswith("OGG"):
        return "audio/ogg"
    elif output_format.startswith("ULAW"):
        return "audio/basic"
    return "audio/wav"


@dataclass
class _TTSOptions:
    """Internal TTS configuration."""

    api_key: str
    voice_id: str
    base_url: str
    output_format: str
    sample_rate: int


class UpliftTTS(tts.TTS):
    """Uplift AI Text-to-Speech provider for LiveKit Agents.

    Converts text to Urdu speech audio using Uplift AI's HTTP Synthesis API.
    This is a non-streaming (HTTP-based) TTS provider.
    """

    def __init__(
        self,
        *,
        voice_id: str = DEFAULT_VOICE_ID,
        output_format: str = DEFAULT_OUTPUT_FORMAT,
        api_key: NotGivenOr[str] = NOT_GIVEN,
        base_url: NotGivenOr[str] = NOT_GIVEN,
        http_session: aiohttp.ClientSession | None = None,
    ) -> None:
        """Create a new Uplift AI TTS instance.

        Args:
            voice_id: Uplift voice identifier.
            output_format: Audio output format (e.g., WAV_22050_16).
            api_key: Uplift AI API key. Falls back to UPLIFT_API_KEY env var.
            base_url: Uplift TTS API endpoint URL.
            http_session: Optional shared aiohttp session.
        """
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=SAMPLE_RATE,
            num_channels=1,
        )

        resolved_api_key = api_key if is_given(api_key) else os.environ.get("UPLIFT_API_KEY")
        if not resolved_api_key:
            raise ValueError(
                "Uplift API key is required. Pass api_key= or set UPLIFT_API_KEY env var."
            )

        resolved_base_url = base_url if is_given(base_url) else DEFAULT_BASE_URL

        self._opts = _TTSOptions(
            api_key=resolved_api_key,
            voice_id=voice_id,
            base_url=resolved_base_url,
            output_format=output_format,
            sample_rate=SAMPLE_RATE,
        )
        self._session = http_session

    @property
    def model(self) -> str:
        return self._opts.voice_id

    @property
    def provider(self) -> str:
        return "UpliftAI"

    def _ensure_session(self) -> aiohttp.ClientSession:
        if not self._session:
            self._session = utils.http_context.http_session()
        return self._session

    def update_options(
        self,
        *,
        voice_id: NotGivenOr[str] = NOT_GIVEN,
        output_format: NotGivenOr[str] = NOT_GIVEN,
    ) -> None:
        """Update TTS options at runtime."""
        if is_given(voice_id) and voice_id != self._opts.voice_id:
            self._opts.voice_id = voice_id
        if is_given(output_format) and output_format != self._opts.output_format:
            self._opts.output_format = output_format

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> ChunkedStream:
        """Synthesize text to audio using Uplift AI HTTP API."""
        return ChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class ChunkedStream(tts.ChunkedStream):
    """HTTP-based chunked stream for Uplift AI TTS."""

    def __init__(
        self,
        *,
        tts: UpliftTTS,
        input_text: str,
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._tts: UpliftTTS = tts
        self._opts = replace(tts._opts)

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        """Make HTTP POST to Uplift AI and emit audio frames."""
        logger.info(f"Uplift TTS: synthesizing text: {self._input_text[:50]}...")
        try:
            logger.debug(f"Uplift TTS: calling API at {self._opts.base_url}")
            async with self._tts._ensure_session().post(
                self._opts.base_url,
                headers={
                    "Authorization": f"Bearer {self._opts.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "voiceId": self._opts.voice_id,
                    "text": self._input_text,
                    "outputFormat": self._opts.output_format,
                },
                timeout=aiohttp.ClientTimeout(
                    total=30,
                    sock_connect=self._conn_options.timeout,
                ),
            ) as resp:
                logger.info(f"Uplift TTS: response status: {resp.status}, content-type: {resp.content_type}")
                if resp.status == 429:
                    raise APIStatusError(
                        message="Uplift AI rate limit exceeded",
                        status_code=429,
                    )
                if resp.status == 402:
                    raise APIStatusError(
                        message="Uplift AI billing limit exceeded",
                        status_code=402,
                    )
                if resp.status != 200:
                    body = await resp.text()
                    raise APIStatusError(
                        message=f"Uplift AI TTS error: {body}",
                        status_code=resp.status,
                    )

                content_type = resp.content_type or ""
                if not content_type.startswith("audio/") and "octet-stream" not in content_type:
                    body = await resp.text()
                    raise APIError(message=f"Uplift AI returned non-audio: {body}")

                output_emitter.initialize(
                    request_id=utils.shortuuid(),
                    sample_rate=self._opts.sample_rate,
                    num_channels=1,
                    mime_type=_format_to_mime(self._opts.output_format),
                )
                logger.info("Uplift TTS: audio stream initialized, pushing audio chunks")

                chunk_count = 0
                async for data, _ in resp.content.iter_chunks():
                    output_emitter.push(data)
                    output_emitter.flush()
                    chunk_count += 1
                
                logger.info(f"Uplift TTS: pushed {chunk_count} audio chunks")

        except asyncio.TimeoutError as e:
            logger.error("Uplift TTS: timeout error")
            raise APITimeoutError() from e
        except aiohttp.ClientResponseError as e:
            logger.error(f"Uplift TTS: client response error: {e.message}")
            raise APIStatusError(
                message=e.message,
                status_code=e.status,
            ) from e
        except (APIStatusError, APIError, APITimeoutError) as e:
            logger.error(f"Uplift TTS: API error: {type(e).__name__}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Uplift TTS: unexpected error: {type(e).__name__}: {str(e)}")
            raise APIConnectionError() from e
