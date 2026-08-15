import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.rbac import SYSTEM_ROLES_PERMISSIONS
from app.core.database import get_db
from app.core.security import decode_token
from app.events.realtime_hub import Subscriber, realtime_hub
from app.models.entities import Membership, Organization, Role, User

logger = logging.getLogger("secureflow.realtime")
router = APIRouter(prefix="/realtime", tags=["Realtime"])


async def get_authenticated_subscriber_context(
    request: Request,
    token: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Subscriber:
    """Authenticate SSE stream connection via header or query token parameter."""
    auth_header = request.headers.get("Authorization")
    raw_token = None
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required for realtime event stream",
        )

    payload = decode_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user_id = payload["sub"]

    # Target Organization
    target_org_id = org_id or payload.get("org_id")
    if not target_org_id:
        # Fetch user's default organization
        stmt = (
            select(Membership)
            .where(Membership.user_id == user_id, Membership.status == "active")
            .options(selectinload(Membership.role))
            .limit(1)
        )
        membership = (await db.execute(stmt)).scalar_one_or_none()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have an active organization membership",
            )
        target_org_id = membership.organization_id
        role_name = membership.role.name if membership.role else "Viewer"
    else:
        # Validate membership in target org
        stmt = (
            select(Membership)
            .where(
                Membership.user_id == user_id,
                Membership.organization_id == target_org_id,
                Membership.status == "active",
            )
            .options(selectinload(Membership.role))
        )
        membership = (await db.execute(stmt)).scalar_one_or_none()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not an active member of this organization",
            )
        role_name = membership.role.name if membership.role else "Viewer"

    permissions = SYSTEM_ROLES_PERMISSIONS.get(role_name, set())

    return Subscriber(
        user_id=user_id,
        org_id=target_org_id,
        role_name=role_name,
        permissions=permissions,
    )


@router.get("/stream")
async def sse_event_stream(
    request: Request,
    subscriber: Subscriber = Depends(get_authenticated_subscriber_context),
):
    """
    Authenticated Server-Sent Events (SSE) stream.
    Pushes real-time domain events with server-side RBAC isolation and connection heartbeats.
    """
    await realtime_hub.add_subscriber(subscriber)

    async def event_generator():
        try:
            # Send initial connection acknowledgment
            init_data = json.dumps({
                "type": "connected",
                "user_id": subscriber.user_id,
                "role": subscriber.role_name,
                "organization_id": subscriber.org_id,
            })
            yield f"event: connected\ndata: {init_data}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait up to 15 seconds for a domain event, else send ping heartbeat
                    event_data = await asyncio.wait_for(subscriber.queue.get(), timeout=15.0)
                    yield f"event: message\ndata: {json.dumps(event_data)}\n\n"
                    subscriber.queue.task_done()
                except asyncio.TimeoutError:
                    # Periodic heartbeat to keep connection alive through proxies & NAT
                    yield "event: ping\ndata: {}\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            await realtime_hub.remove_subscriber(subscriber)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
