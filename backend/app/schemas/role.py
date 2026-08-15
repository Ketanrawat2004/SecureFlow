from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    description: str
    category: str


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    is_system: bool
    organization_id: Optional[str] = None
    permissions: List[PermissionResponse] = []


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    description: str = Field(max_length=255)
    permission_codes: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    permission_codes: Optional[List[str]] = None


class RolePermissionMatrixGroup(BaseModel):
    category: str
    permissions: List[PermissionResponse]


class RolePermissionMatrixResponse(BaseModel):
    roles: List[RoleResponse]
    categories: List[RolePermissionMatrixGroup]
