import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import AUDIT_READ
from app.core.database import get_db
from app.dependencies.auth import require_permission
from app.models.entities import Membership
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.services.audit_service import audit_service

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    membership: Membership = Depends(require_permission(AUDIT_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List paginated audit logs with search, actor filter, action filter, and date ranges."""
    items, total = await audit_service.get_audit_logs(
        db=db,
        org_id=membership.organization_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    responses = [AuditLogResponse.model_validate(log) for log in items]
    return PaginatedResponse[AuditLogResponse](
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )
