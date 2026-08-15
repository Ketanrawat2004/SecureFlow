import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import WORKFLOW_READ
from app.core.database import get_db
from app.dependencies.auth import get_active_membership, require_permission
from app.models.entities import Membership
from app.schemas.approval import ApprovalResponse
from app.schemas.common import PaginatedResponse
from app.services.approval_service import approval_service

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("", response_model=PaginatedResponse[ApprovalResponse])
async def list_approvals(
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    membership: Membership = Depends(require_permission(WORKFLOW_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List pending and historical approval requests for the active organization."""
    items, total = await approval_service.get_approvals(
        db=db,
        org_id=membership.organization_id,
        status_filter=status,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    responses = [ApprovalResponse.model_validate(appr) for appr in items]
    return PaginatedResponse[ApprovalResponse](
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )
