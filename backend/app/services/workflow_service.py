import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.redis_client import redis_manager
from app.events.kafka_client import DomainEvent, event_bus
from app.models.entities import Approval, AuditLog, Notification, Project, User, Workflow, WorkflowStep
from app.schemas.workflow import WorkflowCreate, WorkflowDecisionRequest, WorkflowResponse, WorkflowUpdate


class WorkflowService:
    @staticmethod
    async def get_workflows(
        db: AsyncSession,
        org_id: str,
        project_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        risk_filter: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Workflow], int]:
        """Fetch paginated workflows with filtering and full relations."""
        stmt = (
            select(Workflow)
            .where(Workflow.organization_id == org_id)
            .options(
                selectinload(Workflow.creator),
                selectinload(Workflow.project).selectinload(Project.lead),
                selectinload(Workflow.steps).selectinload(WorkflowStep.assigned_to),
                selectinload(Workflow.steps).selectinload(WorkflowStep.approved_by),
            )
        )

        if project_id and project_id != "all":
            stmt = stmt.where(Workflow.project_id == project_id)

        if status_filter and status_filter != "all":
            stmt = stmt.where(Workflow.status == status_filter)

        if risk_filter and risk_filter != "all":
            stmt = stmt.where(Workflow.risk_level == risk_filter)

        if search:
            search_clean = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                (func.lower(Workflow.name).like(search_clean)) |
                (func.lower(Workflow.description).like(search_clean))
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(Workflow.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        workflows = result.scalars().all()
        return list(workflows), total

    @staticmethod
    async def get_workflow_by_id(db: AsyncSession, workflow_id: str, org_id: str) -> Workflow:
        """Fetch single workflow by ID with complete steps, creator, project, and approval relations."""
        stmt = (
            select(Workflow)
            .where(Workflow.id == workflow_id, Workflow.organization_id == org_id)
            .options(
                selectinload(Workflow.creator),
                selectinload(Workflow.project).selectinload(Project.lead),
                selectinload(Workflow.steps).selectinload(WorkflowStep.assigned_to),
                selectinload(Workflow.steps).selectinload(WorkflowStep.approved_by),
                selectinload(Workflow.approvals).selectinload(Approval.requester),
                selectinload(Workflow.approvals).selectinload(Approval.approver),
            )
        )
        result = await db.execute(stmt)
        wf = result.scalar_one_or_none()
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        return wf

    @staticmethod
    async def create_workflow(
        db: AsyncSession,
        org_id: str,
        user: User,
        data: WorkflowCreate,
    ) -> Workflow:
        """Create new workflow with defined pipeline steps and submit for approval."""
        # Verify project exists
        project = (await db.execute(
            select(Project).where(Project.id == data.project_id, Project.organization_id == org_id)
        )).scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Selected project does not exist in workspace")

        wf = Workflow(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            project_id=data.project_id,
            creator_id=user.id,
            name=data.name,
            description=data.description,
            risk_level=data.risk_level,
            status="pending_approval",
            current_step_index=0,
        )
        db.add(wf)
        await db.flush()

        # Create steps
        steps = []
        for idx, s in enumerate(data.steps):
            step = WorkflowStep(
                id=str(uuid.uuid4()),
                workflow_id=wf.id,
                step_order=idx,
                name=s.name,
                description=s.description,
                required_role=s.required_role,
                assigned_to_user_id=s.assigned_to_user_id,
                status="pending" if idx > 0 else "pending",
            )
            db.add(step)
            steps.append(step)

        await db.flush()

        # Create initial pending approval for first step
        first_step = steps[0] if steps else None
        appr = Approval(
            id=str(uuid.uuid4()),
            workflow_id=wf.id,
            step_id=first_step.id if first_step else None,
            requester_id=user.id,
            status="pending",
            comments=f"Workflow submission: {wf.name}",
        )
        db.add(appr)

        # Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=user.id,
            actor_email=user.email,
            action="workflow.created",
            resource_type="workflow",
            resource_id=wf.id,
            context=f'{{"name": "{wf.name}", "project": "{project.key}", "risk": "{wf.risk_level}"}}',
        )
        db.add(audit)
        await db.commit()

        # Invalidate analytics cache
        await redis_manager.invalidate_pattern(f"analytics:{org_id}:*")

        # Publish Domain Event
        await event_bus.publish(
            DomainEvent(
                event_type="WorkflowCreated",
                aggregate_id=wf.id,
                organization_id=org_id,
                payload={
                    "workflow_id": wf.id,
                    "name": wf.name,
                    "project_id": wf.project_id,
                    "creator_id": user.id,
                    "creator_name": user.full_name,
                    "risk_level": wf.risk_level,
                },
            )
        )

        return await WorkflowService.get_workflow_by_id(db, wf.id, org_id)

    @staticmethod
    async def process_decision(
        db: AsyncSession,
        workflow_id: str,
        org_id: str,
        user: User,
        data: WorkflowDecisionRequest,
    ) -> Workflow:
        """Approve, reject, or request changes on a workflow step."""
        wf = await WorkflowService.get_workflow_by_id(db, workflow_id, org_id)

        if wf.status not in ["pending_approval", "in_progress"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workflow status is '{wf.status}', cannot decide on this workflow.",
            )

        now = datetime.now(timezone.utc)
        current_step = None
        for step in wf.steps:
            if step.step_order == wf.current_step_index:
                current_step = step
                break

        if data.decision == "approve":
            if current_step:
                current_step.status = "approved"
                current_step.approved_by_user_id = user.id
                current_step.approved_at = now
                current_step.notes = data.comments

            # Check if there is a next step
            next_step_index = wf.current_step_index + 1
            if next_step_index < len(wf.steps):
                wf.current_step_index = next_step_index
                # Next step becomes pending
                wf.steps[next_step_index].status = "pending"
                action_type = "workflow.step_approved"
            else:
                wf.status = "approved"
                action_type = "workflow.approved"

            # Create Approval entry
            appr = Approval(
                id=str(uuid.uuid4()),
                workflow_id=wf.id,
                step_id=current_step.id if current_step else None,
                requester_id=wf.creator_id,
                approver_id=user.id,
                status="approved",
                comments=data.comments,
                decision_reason=data.decision_reason or "Approved by reviewer",
                decided_at=now,
            )
            db.add(appr)

            event_type = "WorkflowApproved"

        elif data.decision == "reject":
            if current_step:
                current_step.status = "rejected"
                current_step.approved_by_user_id = user.id
                current_step.approved_at = now
                current_step.notes = data.comments

            wf.status = "rejected"
            action_type = "workflow.rejected"

            appr = Approval(
                id=str(uuid.uuid4()),
                workflow_id=wf.id,
                step_id=current_step.id if current_step else None,
                requester_id=wf.creator_id,
                approver_id=user.id,
                status="rejected",
                comments=data.comments,
                decision_reason=data.decision_reason or "Rejected by reviewer",
                decided_at=now,
            )
            db.add(appr)
            event_type = "WorkflowRejected"

        elif data.decision == "request_changes":
            if current_step:
                current_step.status = "pending"
                current_step.notes = data.comments

            wf.status = "changes_requested"
            action_type = "workflow.changes_requested"

            appr = Approval(
                id=str(uuid.uuid4()),
                workflow_id=wf.id,
                step_id=current_step.id if current_step else None,
                requester_id=wf.creator_id,
                approver_id=user.id,
                status="changes_requested",
                comments=data.comments,
                decision_reason=data.decision_reason or "Changes requested",
                decided_at=now,
            )
            db.add(appr)
            event_type = "WorkflowChangesRequested"

        else:
            raise HTTPException(status_code=400, detail="Invalid decision. Must be approve, reject, or request_changes")

        # Record Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=user.id,
            actor_email=user.email,
            action=action_type,
            resource_type="workflow",
            resource_id=wf.id,
            context=f'{{"decision": "{data.decision}", "comments": "{data.comments or ""}", "reason": "{data.decision_reason or ""}"}}',
        )
        db.add(audit)
        await db.commit()

        # Invalidate analytics cache
        await redis_manager.invalidate_pattern(f"analytics:{org_id}:*")

        # Publish Domain Event
        await event_bus.publish(
            DomainEvent(
                event_type=event_type,
                aggregate_id=wf.id,
                organization_id=org_id,
                payload={
                    "workflow_id": wf.id,
                    "workflow_name": wf.name,
                    "decision": data.decision,
                    "decided_by_id": user.id,
                    "decided_by_name": user.full_name,
                    "creator_id": wf.creator_id,
                    "comments": data.comments,
                },
            )
        )

        return await WorkflowService.get_workflow_by_id(db, wf.id, org_id)


workflow_service = WorkflowService()
