export type UserRole = 'Owner' | 'Admin' | 'Developer' | 'Auditor' | 'Viewer';

export type WorkflowStatus =
  | 'draft'
  | 'pending_approval'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'executed'
  | 'cancelled';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  is_sso?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
}

export interface Role {
  id: string;
  organization_id?: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions: Permission[];
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
  user: User;
  role: Role;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  key: string;
  description?: string;
  status: 'active' | 'planning' | 'archived';
  lead_id?: string;
  created_at: string;
  updated_at: string;
  lead?: User;
  workflow_count?: number;
  active_workflow_count?: number;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  name: string;
  description?: string;
  step_order: number;
  required_role: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  approved_by_id?: string;
  approved_at?: string;
  notes?: string;
}

export interface Approval {
  id: string;
  workflow_id: string;
  step_id?: string;
  approver_id?: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  decision_reason?: string;
  comments?: string;
  decided_at?: string;
  created_at: string;
  workflow?: Workflow;
  step?: WorkflowStep;
  approver?: User;
  requester?: User;
}

export interface Workflow {
  id: string;
  organization_id: string;
  project_id: string;
  created_by_id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  risk_level: RiskLevel;
  current_step_index: number;
  created_at: string;
  updated_at: string;
  project?: Project;
  creator?: User;
  steps: WorkflowStep[];
  approvals?: Approval[];
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_id?: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  context?: string;
  ip_address?: string;
  user_agent?: string;
  event_id: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationCountResponse {
  unread_count: number;
}

export interface OperationalAnalytics {
  total_workflows: number;
  active_workflows: number;
  pending_approvals: number;
  approval_rate_percent: number;
  avg_turnaround_hours: number;
  recent_security_events_count: number;
  workflows_by_status: { status: string; count: number }[];
  workflows_by_risk: { status: string; count: number }[];
  workflows_by_project: {
    project_id: string;
    project_name: string;
    project_key: string;
    workflow_count: number;
  }[];
  volume_timeline: {
    date: string;
    created_count: number;
    approved_count: number;
    rejected_count: number;
  }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuthContext {
  user: User;
  organization?: Organization;
  role?: Role;
  permissions: string[];
  active_organization_id?: string;
  active_role?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
