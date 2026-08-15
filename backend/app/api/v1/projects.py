import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import PROJECT_CREATE, PROJECT_READ, PROJECT_UPDATE
from app.core.database import get_db
from app.dependencies.auth import get_active_membership, require_permission
from app.models.entities import Membership
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import project_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    search: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    membership: Membership = Depends(require_permission(PROJECT_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List paginated projects for active organization with search and status filters."""
    items, total = await project_service.get_projects(
        db=db,
        org_id=membership.organization_id,
        search=search,
        status_filter=status,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    return PaginatedResponse[ProjectResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.post("", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    membership: Membership = Depends(require_permission(PROJECT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project in the active workspace."""
    return await project_service.create_project(
        db=db,
        org_id=membership.organization_id,
        user=membership.user,
        data=data,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    membership: Membership = Depends(require_permission(PROJECT_READ)),
    db: AsyncSession = Depends(get_db),
):
    """Get project details by ID."""
    return await project_service.get_project_by_id(db, project_id, membership.organization_id)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    membership: Membership = Depends(require_permission(PROJECT_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """Update project metadata or status."""
    return await project_service.update_project(
        db=db,
        project_id=project_id,
        org_id=membership.organization_id,
        user=membership.user,
        data=data,
    )
