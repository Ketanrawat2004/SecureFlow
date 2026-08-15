from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import ANALYTICS_READ
from app.core.database import get_db
from app.dependencies.auth import require_permission
from app.models.entities import Membership
from app.schemas.analytics import OperationalAnalyticsResponse
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/operational", response_model=OperationalAnalyticsResponse)
async def get_operational_analytics(
    membership: Membership = Depends(require_permission(ANALYTICS_READ)),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve operational KPIs, completion rates, turnaround times, and daily volume metrics."""
    return await analytics_service.get_operational_analytics(
        db=db,
        org_id=membership.organization_id,
    )
