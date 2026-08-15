from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import AuditLog, User
from app.schemas.audit import AuditLogResponse


class AuditService:
    @staticmethod
    async def get_audit_logs(
        db: AsyncSession,
        org_id: str,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> Tuple[List[AuditLog], int]:
        """Fetch audit logs with multi-field filtering, search, and pagination."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.organization_id == org_id)
            .options(selectinload(AuditLog.actor))
        )

        if actor_id and actor_id != "all":
            stmt = stmt.where(AuditLog.actor_id == actor_id)

        if action and action != "all":
            stmt = stmt.where(AuditLog.action == action)

        if resource_type and resource_type != "all":
            stmt = stmt.where(AuditLog.resource_type == resource_type)

        if start_date:
            stmt = stmt.where(AuditLog.created_at >= start_date)

        if end_date:
            stmt = stmt.where(AuditLog.created_at <= end_date)

        if search:
            search_clean = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                (func.lower(AuditLog.actor_email).like(search_clean)) |
                (func.lower(AuditLog.action).like(search_clean)) |
                (func.lower(AuditLog.resource_type).like(search_clean)) |
                (func.lower(AuditLog.resource_id).like(search_clean)) |
                (func.lower(AuditLog.context).like(search_clean))
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        logs = result.scalars().all()
        return list(logs), total


audit_service = AuditService()
