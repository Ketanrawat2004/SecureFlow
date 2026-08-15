from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import WORKSPACE_READ, WORKSPACE_UPDATE
from app.core.database import get_db
from app.dependencies.auth import get_active_membership, get_current_user, require_permission
from app.models.entities import Membership, User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationSummary,
    OrganizationUpdate,
)
from app.services.organization_service import organization_service

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=List[OrganizationSummary])
async def list_user_organizations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations/workspaces the authenticated user is a member of."""
    return await organization_service.get_user_organizations(db, user.id)


@router.get("/current", response_model=OrganizationResponse)
async def get_current_organization(
    membership: Membership = Depends(get_active_membership),
):
    """Get active organization information."""
    return OrganizationResponse.model_validate(membership.organization)


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    data: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace/organization."""
    org = await organization_service.create_organization(db, user.id, data)
    return OrganizationResponse.model_validate(org)


@router.put("/current", response_model=OrganizationResponse)
async def update_current_organization(
    data: OrganizationUpdate,
    membership: Membership = Depends(require_permission(WORKSPACE_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Update active organization details (requires workspace.update permission)."""
    org = await organization_service.update_organization(db, membership.organization_id, data)
    return OrganizationResponse.model_validate(org)
