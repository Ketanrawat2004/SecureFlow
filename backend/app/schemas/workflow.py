from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.auth import UserResponse
from app.schemas.project import ProjectResponse


class WorkflowStepCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    step_order: int = Field(ge=0)
    required_role: str = Field(default="Admin")
    assigned_to_user_id: Optional[str] = None


class WorkflowStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    step_order: int
    name: str
    description: Optional[str] = None
    required_role: str
    assigned_to_user_id: Optional[str] = None
    status: str  # pending, in_progress, approved, rejected, skipped
    approved_by_user_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    assigned_to: Optional[UserResponse] = None
    approved_by: Optional[UserResponse] = None


class WorkflowCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    risk_level: str = Field(default="medium", description="low, medium, high, critical")
    steps: List[WorkflowStepCreate] = Field(min_length=1)


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    risk_level: Optional[str] = None
    status: Optional[str] = None


class WorkflowDecisionRequest(BaseModel):
    decision: str = Field(description="approve, reject, request_changes")
    comments: Optional[str] = Field(default=None, max_length=1000)
    decision_reason: Optional[str] = Field(default=None, max_length=255)


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    project_id: str
    creator_id: str
    name: str
    description: Optional[str] = None
    status: str
    current_step_index: int
    risk_level: str
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    project: Optional[ProjectResponse] = None
    steps: List[WorkflowStepResponse] = []


class WorkflowDetailResponse(WorkflowResponse):
    pass
