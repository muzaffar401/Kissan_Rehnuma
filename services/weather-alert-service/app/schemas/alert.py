from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class TriggerCheckRequest(BaseModel):
    farmer_id: Optional[int] = None   # None = run for all farmers


class TriggerCheckResponse(BaseModel):
    farmer_id: int
    risk_detected: bool
    risk_type: Optional[str] = None
    advisory_generated: Optional[str] = None
    notification_status: str


class AlertHistoryItem(BaseModel):
    alert_type: str
    message: str
    sent_at: datetime
    status: str

    class Config:
        from_attributes = True


class AlertHistoryResponse(BaseModel):
    farmer_id: int
    alerts: List[AlertHistoryItem]
