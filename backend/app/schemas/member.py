from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.schemas.auth import UserResponse
from app.schemas.role import RoleResponse


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    organization_id: str
    role_id: str
    status: str  # active, invited, suspended
    created_at: datetime
    updated_at: datetime
    user: UserResponse
    role: RoleResponse


class MemberInviteRequest(BaseModel):
    email: EmailStr
    role_id: str
    full_name: Optional[str] = None


class MemberRoleUpdateRequest(BaseModel):
    role_id: str


class MemberStatusUpdateRequest(BaseModel):
    status: str = Field(description="One of: active, invited, suspended")
