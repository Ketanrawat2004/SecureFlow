from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserResponse
from app.schemas.workflow import WorkflowResponse, WorkflowStepResponse


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    step_id: Optional[str] = None
    requester_id: str
    approver_id: Optional[str] = None
    status: str
    comments: Optional[str] = None
    decision_reason: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    workflow: Optional[WorkflowResponse] = None
    step: Optional[WorkflowStepResponse] = None
    requester: Optional[UserResponse] = None
    approver: Optional[UserResponse] = None


class ApprovalDecisionRequest(BaseModel):
    action: str = Field(description="approve, reject, request_changes")
    comments: Optional[str] = Field(default=None, max_length=1000)
    reason: Optional[str] = Field(default=None, max_length=255)
