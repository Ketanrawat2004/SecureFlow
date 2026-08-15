from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import Approval, Project, User, Workflow, WorkflowStep
from app.schemas.approval import ApprovalResponse


class ApprovalService:
    @staticmethod
    async def get_approvals(
        db: AsyncSession,
        org_id: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Approval], int]:
        """Fetch approval items for organization with associated workflow, step, requester, and approver."""
        base_filter = [
            Workflow.organization_id == org_id,
        ]
        if status_filter and status_filter != "all":
            base_filter.append(Approval.status == status_filter)

        count_stmt = (
            select(func.count(Approval.id))
            .join(Workflow, Workflow.id == Approval.workflow_id)
            .where(*base_filter)
        )
        total = (await db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Approval)
            .join(Workflow, Workflow.id == Approval.workflow_id)
            .where(*base_filter)
            .options(
                selectinload(Approval.workflow).selectinload(Workflow.project).selectinload(Project.lead),
                selectinload(Approval.workflow).selectinload(Workflow.creator),
                selectinload(Approval.workflow).selectinload(Workflow.steps).selectinload(WorkflowStep.assigned_to),
                selectinload(Approval.workflow).selectinload(Workflow.steps).selectinload(WorkflowStep.approved_by),
                selectinload(Approval.step).selectinload(WorkflowStep.assigned_to),
                selectinload(Approval.step).selectinload(WorkflowStep.approved_by),
                selectinload(Approval.requester),
                selectinload(Approval.approver),
            )
            .order_by(Approval.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        approvals = result.scalars().all()
        return list(approvals), total


approval_service = ApprovalService()
