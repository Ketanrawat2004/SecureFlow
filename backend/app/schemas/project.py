from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserResponse


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    key: str = Field(min_length=2, max_length=10, pattern="^[A-Z0-9_-]+$")
    description: Optional[str] = Field(default=None, max_length=500)
    lead_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, description="active, archived, planning")
    lead_id: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    key: str
    description: Optional[str] = None
    status: str
    lead_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lead: Optional[UserResponse] = None
    workflow_count: int = 0
    active_workflow_count: int = 0


class ProjectDetailResponse(ProjectResponse):
    pass
