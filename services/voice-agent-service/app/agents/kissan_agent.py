"""Kissan Rehnuma Voice Agent — LiveKit Agent definition.

The main agent class that wires together instructions and tools.
Tools are organized in app/agents/tools/ and shared context in app/agents/context.py.
"""

from __future__ import annotations

from livekit.agents import Agent

from app.agents.instructions import build_instructions
from app.agents.tools import (
    check_complaint_status,
    check_weather_alert,
    get_market_rates,
    register_complaint,
)


class KissanRehnumaAgent(Agent):
    """The main Kissan Rehnuma voice agent."""

    def __init__(
        self,
        farmer_name: str = "kissan",
        farmer_memory: str = "",
        language: str = "ur",
    ) -> None:
        super().__init__(
            instructions=build_instructions(
                farmer_name=farmer_name,
                farmer_memory=farmer_memory,
                language=language,
            ),
            tools=[
                register_complaint,
                check_weather_alert,
                get_market_rates,
                check_complaint_status,
            ],
        )
        self._farmer_name = farmer_name
        self._language = language

    async def on_enter(self) -> None:
        """Called when the agent becomes active in a session."""
        name = self._farmer_name
        if self._language == "en":
            await self.session.generate_reply(
                instructions=(
                    f"Greet the farmer warmly in English. "
                    f"Address them as '{name}'. "
                    f"Introduce yourself as Kissan Rehnuma and ask how you can help."
                )
            )
        else:
            await self.session.generate_reply(
                instructions=(
                    f"Greet the farmer warmly in Urdu script. "
                    f"Address them as '{name} sahib'. "
                    f"Introduce yourself as Kissan Rehnuma and ask how you can help."
                )
            )

    async def on_event(self, event: object) -> None:
        """Handle agent lifecycle events."""
        from app.core.logging import logger
        logger.info(f"Agent event: {type(event).__name__}")
