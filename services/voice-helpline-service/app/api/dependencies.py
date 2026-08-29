from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.uplift.client import UpliftClient
from app.core.config import Settings, get_settings
from app.db.session import get_db_session


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    name: str


async def get_current_user(
    user_id: Annotated[UUID, Header(alias="X-User-Id")],
    user_name: Annotated[str, Header(alias="X-User-Name", min_length=1, max_length=120)],
) -> CurrentUser:
    """Identity headers must be injected by the trusted API gateway."""
    return CurrentUser(id=user_id, name=user_name)


def get_uplift_client(request: Request) -> UpliftClient:
    return request.app.state.uplift_client


DatabaseSession = Annotated[AsyncSession, Depends(get_db_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]
AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
UpliftDependency = Annotated[UpliftClient, Depends(get_uplift_client)]

