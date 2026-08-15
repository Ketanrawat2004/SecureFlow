from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    type: str = "access"
    email: Optional[str] = None
    role: Optional[str] = None
    org_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(min_length=2, max_length=100)
    organization_name: Optional[str] = Field(default=None, max_length=100)


class DevLoginRequest(BaseModel):
    role: str = Field(default="Owner", description="One of: Owner, Admin, Developer, Auditor, Viewer")
    email: Optional[EmailStr] = None


class GoogleCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


class OAuthUrlResponse(BaseModel):
    url: str
    client_id: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_sso: bool
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    avatar_url: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8)


class AuthContextResponse(BaseModel):
    user: UserResponse
    active_organization_id: Optional[str] = None
    active_role: Optional[str] = None
    permissions: List[str] = []
