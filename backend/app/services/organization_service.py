import uuid
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import Membership, Organization, Project, Role, User, Workflow
from app.schemas.organization import OrganizationCreate, OrganizationResponse, OrganizationSummary, OrganizationUpdate


class OrganizationService:
    @staticmethod
    async def get_user_organizations(db: AsyncSession, user_id: str) -> List[OrganizationSummary]:
        """Fetch all organizations the user is a member of, with live aggregated metrics."""
        stmt = (
            select(Membership)
            .where(Membership.user_id == user_id, Membership.status == "active")
            .options(
                selectinload(Membership.organization),
                selectinload(Membership.role),
            )
        )
        result = await db.execute(stmt)
        memberships = result.scalars().all()

        summaries = []
        for m in memberships:
            org = m.organization
            # Aggregate stats
            mem_count = (await db.execute(
                select(func.count(Membership.id)).where(Membership.organization_id == org.id, Membership.status == "active")
            )).scalar() or 0

            proj_count = (await db.execute(
                select(func.count(Project.id)).where(Project.organization_id == org.id, Project.status == "active")
            )).scalar() or 0

            active_wf = (await db.execute(
                select(func.count(Workflow.id)).where(
                    Workflow.organization_id == org.id,
                    Workflow.status.in_(["pending_approval", "in_progress", "draft"])
                )
            )).scalar() or 0

            summary = OrganizationSummary(
                id=org.id,
                name=org.name,
                slug=org.slug,
                description=org.description,
                avatar_url=org.avatar_url,
                created_at=org.created_at,
                updated_at=org.updated_at,
                member_count=mem_count,
                project_count=proj_count,
                active_workflows=active_wf,
                current_user_role=m.role.name,
            )
            summaries.append(summary)

        return summaries

    @staticmethod
    async def get_organization(db: AsyncSession, org_id: str) -> Organization:
        """Fetch single organization by ID."""
        org = await db.get(Organization, org_id)
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        return org

    @staticmethod
    async def create_organization(db: AsyncSession, user_id: str, data: OrganizationCreate) -> Organization:
        """Create new organization and assign creating user as Owner."""
        slug = data.slug or f"{data.name.lower().replace(' ', '-')[:40]}-{uuid.uuid4().hex[:6]}"
        org = Organization(
            id=str(uuid.uuid4()),
            name=data.name,
            slug=slug,
            description=data.description,
        )
        db.add(org)
        await db.flush()

        owner_role = (await db.execute(select(Role).where(Role.name == "Owner"))).scalar_one_or_none()
        if not owner_role:
            raise HTTPException(status_code=500, detail="Owner role missing")

        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=user_id,
            organization_id=org.id,
            role_id=owner_role.id,
            status="active",
        )
        db.add(membership)
        await db.commit()
        await db.refresh(org)
        return org

    @staticmethod
    async def update_organization(db: AsyncSession, org_id: str, data: OrganizationUpdate) -> Organization:
        """Update organization details."""
        org = await OrganizationService.get_organization(db, org_id)
        if data.name is not None:
            org.name = data.name
        if data.description is not None:
            org.description = data.description
        if data.avatar_url is not None:
            org.avatar_url = data.avatar_url
            
        await db.commit()
        await db.refresh(org)
        return org


organization_service = OrganizationService()
