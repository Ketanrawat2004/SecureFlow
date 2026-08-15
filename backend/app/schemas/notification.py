from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    organization_id: str
    title: str
    message: str
    type: str  # info, approval_request, workflow_status, security, member
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    event_id: Optional[str] = None
    created_at: datetime


class NotificationCountResponse(BaseModel):
    unread_count: int
