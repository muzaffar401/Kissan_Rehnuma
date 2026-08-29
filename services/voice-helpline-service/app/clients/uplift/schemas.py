from pydantic import BaseModel, ConfigDict, Field


class UpliftSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    participant_name: str = Field(alias="participantName", min_length=1, max_length=120)
    room_name: str | None = Field(default=None, alias="roomName", max_length=255)


class UpliftSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(min_length=1)
    ws_url: str = Field(alias="wsUrl", pattern=r"^wss://")
    room_name: str = Field(alias="roomName", min_length=1, max_length=255)

