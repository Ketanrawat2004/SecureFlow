from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import MEMBER_INVITE, MEMBER_READ, MEMBER_REMOVE, ROLE_ASSIGN
from app.core.database import get_db
from app.dependencies.auth import require_permission
from app.models.entities import Membership
from app.schemas.common import MessageResponse
from app.schemas.member import (
    MemberInviteRequest,
    MemberResponse,
    MemberRoleUpdateRequest,
)
from app.services.member_service import member_service

router = APIRouter(prefix="/members", tags=["Members"])


@router.get("", response_model=List[MemberResponse])
async def list_members(
    membership: Membership = Depends(require_permission(MEMBER_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List all workspace members, roles, and invitation statuses."""
    items = await member_service.get_members(db, membership.organization_id)
    return [MemberResponse.model_validate(m) for m in items]


@router.post("/invite", response_model=MemberResponse)
async def invite_member(
    data: MemberInviteRequest,
    membership: Membership = Depends(require_permission(MEMBER_INVITE)),
    db: AsyncSession = Depends(get_db),
):
    """Invite a new member to the workspace."""
    mem = await member_service.invite_member(
        db=db,
        org_id=membership.organization_id,
        actor=membership.user,
        data=data,
    )
    return MemberResponse.model_validate(mem)


@router.put("/{member_id}/role", response_model=MemberResponse)
async def update_member_role(
    member_id: str,
    data: MemberRoleUpdateRequest,
    membership: Membership = Depends(require_permission(ROLE_ASSIGN)),
    db: AsyncSession = Depends(get_db),
):
    """Update a workspace member's role (requires role.assign permission)."""
    mem = await member_service.update_member_role(
        db=db,
        org_id=membership.organization_id,
        member_id=member_id,
        new_role_id=data.role_id,
        actor=membership.user,
    )
    return MemberResponse.model_validate(mem)


@router.delete("/{member_id}", response_model=MessageResponse)
async def remove_member(
    member_id: str,
    membership: Membership = Depends(require_permission(MEMBER_REMOVE)),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the workspace (requires member.remove permission)."""
    await member_service.remove_member(
        db=db,
        org_id=membership.organization_id,
        member_id=member_id,
        actor=membership.user,
    )
    return MessageResponse(message="Member successfully removed from workspace")
