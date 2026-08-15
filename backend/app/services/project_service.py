import uuid
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.events.kafka_client import DomainEvent, event_bus
from app.models.entities import AuditLog, Project, User, Workflow
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate


class ProjectService:
    @staticmethod
    async def get_projects(
        db: AsyncSession,
        org_id: str,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[ProjectResponse], int]:
        """Fetch paginated projects with search, status filtering, and workflow statistics."""
        stmt = (
            select(Project)
            .where(Project.organization_id == org_id)
            .options(selectinload(Project.lead))
        )

        if status_filter and status_filter != "all":
            stmt = stmt.where(Project.status == status_filter)

        if search:
            search_clean = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                (func.lower(Project.name).like(search_clean)) |
                (func.lower(Project.key).like(search_clean)) |
                (func.lower(Project.description).like(search_clean))
            )

        # Count total matching
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        # Pagination & sorting
        stmt = stmt.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        projects = result.scalars().all()

        responses = []
        for p in projects:
            # Count workflows
            wf_count = (await db.execute(
                select(func.count(Workflow.id)).where(Workflow.project_id == p.id)
            )).scalar() or 0

            active_wf = (await db.execute(
                select(func.count(Workflow.id)).where(
                    Workflow.project_id == p.id,
                    Workflow.status.in_(["pending_approval", "in_progress", "draft"])
                )
            )).scalar() or 0

            resp = ProjectResponse.model_validate(p)
            resp.workflow_count = wf_count
            resp.active_workflow_count = active_wf
            responses.append(resp)

        return responses, total

    @staticmethod
    async def get_project_by_id(db: AsyncSession, project_id: str, org_id: str) -> ProjectResponse:
        """Fetch project details by ID."""
        stmt = (
            select(Project)
            .where(Project.id == project_id, Project.organization_id == org_id)
            .options(selectinload(Project.lead))
        )
        result = await db.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        wf_count = (await db.execute(
            select(func.count(Workflow.id)).where(Workflow.project_id == p.id)
        )).scalar() or 0

        active_wf = (await db.execute(
            select(func.count(Workflow.id)).where(
                Workflow.project_id == p.id,
                Workflow.status.in_(["pending_approval", "in_progress", "draft"])
            )
        )).scalar() or 0

        resp = ProjectResponse.model_validate(p)
        resp.workflow_count = wf_count
        resp.active_workflow_count = active_wf
        return resp

    @staticmethod
    async def create_project(
        db: AsyncSession,
        org_id: str,
        user: User,
        data: ProjectCreate,
    ) -> ProjectResponse:
        """Create new project, emit ProjectCreated event and record audit log."""
        # Check duplicate key
        clean_key = data.key.upper().strip()
        existing = await db.execute(
            select(Project).where(Project.organization_id == org_id, Project.key == clean_key)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project key '{clean_key}' is already used in this workspace",
            )

        project = Project(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            name=data.name,
            key=clean_key,
            description=data.description,
            lead_id=data.lead_id or user.id,
            status="active",
        )
        db.add(project)
        await db.flush()

        # Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=user.id,
            actor_email=user.email,
            action="project.created",
            resource_type="project",
            resource_id=project.id,
            context=f'{{"name": "{project.name}", "key": "{project.key}"}}',
        )
        db.add(audit)
        await db.commit()
        await db.refresh(project)

        # Publish Domain Event
        await event_bus.publish(
            DomainEvent(
                event_type="ProjectCreated",
                aggregate_id=project.id,
                organization_id=org_id,
                payload={"project_id": project.id, "name": project.name, "key": project.key, "lead_id": project.lead_id},
            )
        )

        return await ProjectService.get_project_by_id(db, project.id, org_id)

    @staticmethod
    async def update_project(
        db: AsyncSession,
        project_id: str,
        org_id: str,
        user: User,
        data: ProjectUpdate,
    ) -> ProjectResponse:
        """Update project settings."""
        stmt = select(Project).where(Project.id == project_id, Project.organization_id == org_id)
        project = (await db.execute(stmt)).scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if data.name is not None:
            project.name = data.name
        if data.description is not None:
            project.description = data.description
        if data.status is not None:
            project.status = data.status
        if data.lead_id is not None:
            project.lead_id = data.lead_id

        # Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=user.id,
            actor_email=user.email,
            action="project.updated",
            resource_type="project",
            resource_id=project.id,
            context=f'{{"status": "{project.status}"}}',
        )
        db.add(audit)
        await db.commit()

        # Publish domain event
        await event_bus.publish(
            DomainEvent(
                event_type="ProjectUpdated",
                aggregate_id=project.id,
                organization_id=org_id,
                payload={"project_id": project.id, "status": project.status, "name": project.name},
            )
        )

        return await ProjectService.get_project_by_id(db, project.id, org_id)


project_service = ProjectService()
