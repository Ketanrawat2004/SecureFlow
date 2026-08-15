from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserResponse


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    actor_id: Optional[str] = None
    actor_email: str
    action: str
    resource_type: str
    resource_id: str
    context: Optional[str] = None
    ip_address: Optional[str] = None
    event_id: Optional[str] = None
    created_at: datetime
    actor: Optional[UserResponse] = None
