from datetime import datetime, timezone
from typing import List, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Notification
from app.schemas.notification import NotificationCountResponse, NotificationResponse


class NotificationService:
    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: str,
        org_id: str,
        limit: int = 30,
    ) -> List[Notification]:
        """Fetch latest notifications for current user."""
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.organization_id == org_id,
            )
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: str, org_id: str) -> int:
        """Fetch count of unread notifications."""
        stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.organization_id == org_id,
            Notification.is_read == False,
        )
        count = (await db.execute(stmt)).scalar() or 0
        return count

    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: str, user_id: str) -> None:
        """Mark single notification as read."""
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        await db.execute(stmt)
        await db.commit()

    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: str, org_id: str) -> None:
        """Mark all notifications as read for this user in active organization."""
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.organization_id == org_id,
                Notification.is_read == False,
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        await db.execute(stmt)
        await db.commit()


notification_service = NotificationService()
