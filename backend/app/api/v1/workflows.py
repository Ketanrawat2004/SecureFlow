import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import WORKFLOW_APPROVE, WORKFLOW_CREATE, WORKFLOW_READ, WORKFLOW_REJECT
from app.core.database import get_db
from app.dependencies.auth import get_active_membership, require_permission
from app.models.entities import Membership, Workflow
from app.schemas.common import PaginatedResponse
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDecisionRequest,
    WorkflowDetailResponse,
    WorkflowResponse,
)
from app.services.workflow_service import workflow_service

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.get("", response_model=PaginatedResponse[WorkflowResponse])
async def list_workflows(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    membership: Membership = Depends(require_permission(WORKFLOW_READ)),
    db: AsyncSession = Depends(get_db),
):
    """List paginated workflows with multi-criteria filtering."""
    items, total = await workflow_service.get_workflows(
        db=db,
        org_id=membership.organization_id,
        project_id=project_id,
        status_filter=status,
        risk_filter=risk,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    responses = [WorkflowResponse.model_validate(wf) for wf in items]
    return PaginatedResponse[WorkflowResponse](
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    data: WorkflowCreate,
    membership: Membership = Depends(require_permission(WORKFLOW_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Create and submit a new workflow pipeline."""
    wf = await workflow_service.create_workflow(
        db=db,
        org_id=membership.organization_id,
        user=membership.user,
        data=data,
    )
    return WorkflowResponse.model_validate(wf)


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse)
async def get_workflow(
    workflow_id: str,
    membership: Membership = Depends(require_permission(WORKFLOW_READ)),
    db: AsyncSession = Depends(get_db),
):
    """Get single workflow with steps, approval chain, and audit timeline."""
    wf = await workflow_service.get_workflow_by_id(
        db=db,
        workflow_id=workflow_id,
        org_id=membership.organization_id,
    )
    return WorkflowDetailResponse.model_validate(wf)


@router.post("/{workflow_id}/decide", response_model=WorkflowDetailResponse)
async def decide_workflow(
    workflow_id: str,
    data: WorkflowDecisionRequest,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Approve, reject, or request changes on a workflow step."""
    # RBAC check based on decision type
    if data.decision == "approve":
        await require_permission(WORKFLOW_APPROVE)(membership)
    elif data.decision in ["reject", "request_changes"]:
        await require_permission(WORKFLOW_REJECT)(membership)
    else:
        raise HTTPException(status_code=400, detail="Invalid decision value")

    wf = await workflow_service.process_decision(
        db=db,
        workflow_id=workflow_id,
        org_id=membership.organization_id,
        user=membership.user,
        data=data,
    )
    return WorkflowDetailResponse.model_validate(wf)
