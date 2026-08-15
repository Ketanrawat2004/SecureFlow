from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import ROLE_ASSIGN, WORKSPACE_READ
from app.core.database import get_db
from app.dependencies.auth import require_permission
from app.models.entities import Membership
from app.schemas.role import (
    PermissionResponse,
    RolePermissionMatrixResponse,
    RoleResponse,
)
from app.services.role_service import role_service

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"])


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    membership: Membership = Depends(require_permission(WORKSPACE_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List all available roles and their attached permissions."""
    return await role_service.get_roles(db)


@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    membership: Membership = Depends(require_permission(WORKSPACE_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List all system permission definitions."""
    return await role_service.get_permissions(db)


@router.get("/matrix", response_model=RolePermissionMatrixResponse)
async def get_role_permission_matrix(
    membership: Membership = Depends(require_permission(WORKSPACE_READ)),
    db: AsyncSession = Depends(get_db),
):
    """Get the full role-permission matrix grouped by category for the RBAC management screen."""
    return await role_service.get_role_permission_matrix(db)
