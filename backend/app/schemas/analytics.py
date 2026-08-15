from typing import Dict, List
from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class ProjectDistribution(BaseModel):
    project_id: str
    project_name: str
    project_key: str
    workflow_count: int
    active_count: int


class VolumeDataPoint(BaseModel):
    date: str
    created_count: int
    approved_count: int
    rejected_count: int


class OperationalAnalyticsResponse(BaseModel):
    total_workflows: int
    active_workflows: int
    pending_approvals: int
    completed_workflows: int
    approval_rate_percent: float
    avg_turnaround_hours: float
    workflows_by_status: List[StatusCount]
    workflows_by_risk: List[StatusCount]
    workflows_by_project: List[ProjectDistribution]
    volume_timeline: List[VolumeDataPoint]
    recent_security_events_count: int
