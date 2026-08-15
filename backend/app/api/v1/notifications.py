from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_active_membership
from app.models.entities import Membership
from app.schemas.common import MessageResponse
from app.schemas.notification import (
    NotificationCountResponse,
    NotificationResponse,
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """List recent notifications for the authenticated user in the current workspace."""
    items = await notification_service.get_user_notifications(
        db=db,
        user_id=membership.user_id,
        org_id=membership.organization_id,
        limit=limit,
    )
    return [NotificationResponse.model_validate(n) for n in items]


@router.get("/unread-count", response_model=NotificationCountResponse)
async def get_unread_count(
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Get the unread notification badge count for the top navigation bar."""
    count = await notification_service.get_unread_count(
        db=db,
        user_id=membership.user_id,
        org_id=membership.organization_id,
    )
    return NotificationCountResponse(unread_count=count)


@router.post("/{notification_id}/read", response_model=MessageResponse)
async def mark_notification_read(
    notification_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    await notification_service.mark_as_read(db, notification_id, membership.user_id)
    return MessageResponse(message="Notification marked as read")


@router.post("/mark-all-read", response_model=MessageResponse)
async def mark_all_notifications_read(
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    await notification_service.mark_all_as_read(db, membership.user_id, membership.organization_id)
    return MessageResponse(message="All notifications marked as read")
