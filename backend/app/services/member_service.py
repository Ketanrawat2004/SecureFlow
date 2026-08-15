import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.events.kafka_client import DomainEvent, event_bus
from app.models.entities import AuditLog, Membership, Role, RolePermission, User
from app.schemas.member import MemberInviteRequest, MemberResponse


class MemberService:
    @staticmethod
    async def get_members(db: AsyncSession, org_id: str) -> List[Membership]:
        """Fetch all members of the organization with their roles and user profiles."""
        stmt = (
            select(Membership)
            .where(Membership.organization_id == org_id)
            .options(
                selectinload(Membership.user),
                selectinload(Membership.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission),
            )
            .order_by(Membership.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def invite_member(
        db: AsyncSession,
        org_id: str,
        actor: User,
        data: MemberInviteRequest,
    ) -> Membership:
        """Invite or add user to workspace and assign designated role."""
        # Find or create user
        user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email=data.email,
                full_name=data.full_name or data.email.split("@")[0].capitalize(),
                hashed_password=get_password_hash("SecureFlow2026!"),
                is_active=True,
                is_verified=False,
            )
            db.add(user)
            await db.flush()

        # Check existing membership
        existing_mem = (await db.execute(
            select(Membership).where(Membership.user_id == user.id, Membership.organization_id == org_id)
        )).scalar_one_or_none()
        if existing_mem:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this workspace",
            )

        # Verify role exists
        role = await db.get(Role, data.role_id)
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role specified")

        mem = Membership(
            id=str(uuid.uuid4()),
            user_id=user.id,
            organization_id=org_id,
            role_id=role.id,
            status="active",
        )
        db.add(mem)

        # Record audit log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=actor.id,
            actor_email=actor.email,
            action="member.invited",
            resource_type="member",
            resource_id=user.id,
            context=f'{{"email": "{user.email}", "role": "{role.name}"}}',
        )
        db.add(audit)
        await db.commit()

        # Publish domain event
        await event_bus.publish(
            DomainEvent(
                event_type="MemberInvited",
                aggregate_id=user.id,
                organization_id=org_id,
                payload={"invited_user_id": user.id, "email": user.email, "role": role.name, "invited_by": actor.email},
            )
        )

        # Reload membership with relations
        return (await db.execute(
            select(Membership)
            .where(Membership.id == mem.id)
            .options(
                selectinload(Membership.user),
                selectinload(Membership.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
        )).scalar_one()

    @staticmethod
    async def update_member_role(
        db: AsyncSession,
        org_id: str,
        member_id: str,
        new_role_id: str,
        actor: User,
    ) -> Membership:
        """Update a member's assigned role."""
        mem = (await db.execute(
            select(Membership)
            .where(Membership.id == member_id, Membership.organization_id == org_id)
            .options(
                selectinload(Membership.user),
                selectinload(Membership.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
        )).scalar_one_or_none()
        if not mem:
            raise HTTPException(status_code=404, detail="Membership not found")

        role = await db.get(Role, new_role_id)
        if not role:
            raise HTTPException(status_code=400, detail="Target role not found")

        old_role_name = mem.role.name
        mem.role_id = role.id
        mem.role = role

        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=actor.id,
            actor_email=actor.email,
            action="role.changed",
            resource_type="member",
            resource_id=mem.user_id,
            context=f'{{"from_role": "{old_role_name}", "to_role": "{role.name}"}}',
        )
        db.add(audit)
        await db.commit()

        # Publish event
        await event_bus.publish(
            DomainEvent(
                event_type="RoleChanged",
                aggregate_id=mem.user_id,
                organization_id=org_id,
                payload={"user_id": mem.user_id, "old_role": old_role_name, "new_role": role.name, "updated_by": actor.email},
            )
        )

        return (await db.execute(
            select(Membership)
            .where(Membership.id == mem.id)
            .options(
                selectinload(Membership.user),
                selectinload(Membership.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission)
            )
        )).scalar_one()

    @staticmethod
    async def remove_member(db: AsyncSession, org_id: str, member_id: str, actor: User) -> None:
        """Remove a member from the workspace."""
        mem = (await db.execute(
            select(Membership)
            .where(Membership.id == member_id, Membership.organization_id == org_id)
            .options(selectinload(Membership.user), selectinload(Membership.role))
        )).scalar_one_or_none()
        if not mem:
            raise HTTPException(status_code=404, detail="Membership not found")

        if mem.role.name == "Owner":
            # Check if this is the only owner
            owner_count = (await db.execute(
                select(Membership)
                .join(Role, Role.id == Membership.role_id)
                .where(Membership.organization_id == org_id, Role.name == "Owner")
            )).scalars().all()
            if len(owner_count) <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove the only Owner of the organization. Transfer ownership first.",
                )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=actor.id,
            actor_email=actor.email,
            action="member.removed",
            resource_type="member",
            resource_id=mem.user_id,
            context=f'{{"email": "{mem.user.email}", "role": "{mem.role.name}"}}',
        )
        db.add(audit)
        await db.delete(mem)
        await db.commit()

        # Publish domain event
        await event_bus.publish(
            DomainEvent(
                event_type="MemberRemoved",
                aggregate_id=mem.user_id,
                organization_id=org_id,
                payload={"user_id": mem.user_id, "email": mem.user.email, "role": mem.role.name},
            )
        )


member_service = MemberService()
