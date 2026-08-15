from typing import Dict, List, Set

# Permission Codes
WORKSPACE_READ = "workspace.read"
WORKSPACE_UPDATE = "workspace.update"

MEMBER_READ = "member.read"
MEMBER_INVITE = "member.invite"
MEMBER_REMOVE = "member.remove"

ROLE_ASSIGN = "role.assign"

PROJECT_READ = "project.read"
PROJECT_CREATE = "project.create"
PROJECT_UPDATE = "project.update"

WORKFLOW_READ = "workflow.read"
WORKFLOW_CREATE = "workflow.create"
WORKFLOW_APPROVE = "workflow.approve"
WORKFLOW_REJECT = "workflow.reject"

AUDIT_READ = "audit.read"
ANALYTICS_READ = "analytics.read"

ALL_PERMISSIONS = [
    {"code": WORKSPACE_READ, "description": "View workspace information and settings", "category": "workspace"},
    {"code": WORKSPACE_UPDATE, "description": "Update workspace details and configuration", "category": "workspace"},
    {"code": MEMBER_READ, "description": "View workspace team members and invitations", "category": "member"},
    {"code": MEMBER_INVITE, "description": "Invite new members to the workspace", "category": "member"},
    {"code": MEMBER_REMOVE, "description": "Remove members from the workspace", "category": "member"},
    {"code": ROLE_ASSIGN, "description": "Assign and update roles and permissions", "category": "role"},
    {"code": PROJECT_READ, "description": "View projects and project metadata", "category": "project"},
    {"code": PROJECT_CREATE, "description": "Create new projects", "category": "project"},
    {"code": PROJECT_UPDATE, "description": "Update project settings and members", "category": "project"},
    {"code": WORKFLOW_READ, "description": "View workflows, status, and history", "category": "workflow"},
    {"code": WORKFLOW_CREATE, "description": "Create and submit new workflows", "category": "workflow"},
    {"code": WORKFLOW_APPROVE, "description": "Approve workflows and step approvals", "category": "workflow"},
    {"code": WORKFLOW_REJECT, "description": "Reject workflows or request changes", "category": "workflow"},
    {"code": AUDIT_READ, "description": "View security and compliance audit logs", "category": "audit"},
    {"code": ANALYTICS_READ, "description": "Access operational analytics and reports", "category": "analytics"},
]

# Default System Role Permissions Mapping
SYSTEM_ROLES_PERMISSIONS: Dict[str, Set[str]] = {
    "Owner": {
        WORKSPACE_READ, WORKSPACE_UPDATE,
        MEMBER_READ, MEMBER_INVITE, MEMBER_REMOVE,
        ROLE_ASSIGN,
        PROJECT_READ, PROJECT_CREATE, PROJECT_UPDATE,
        WORKFLOW_READ, WORKFLOW_CREATE, WORKFLOW_APPROVE, WORKFLOW_REJECT,
        AUDIT_READ, ANALYTICS_READ,
    },
    "Admin": {
        WORKSPACE_READ, WORKSPACE_UPDATE,
        MEMBER_READ, MEMBER_INVITE,
        ROLE_ASSIGN,
        PROJECT_READ, PROJECT_CREATE, PROJECT_UPDATE,
        WORKFLOW_READ, WORKFLOW_CREATE, WORKFLOW_APPROVE, WORKFLOW_REJECT,
        AUDIT_READ, ANALYTICS_READ,
    },
    "Developer": {
        WORKSPACE_READ,
        MEMBER_READ,
        PROJECT_READ, PROJECT_CREATE, PROJECT_UPDATE,
        WORKFLOW_READ, WORKFLOW_CREATE,
        AUDIT_READ, ANALYTICS_READ,
    },
    "Auditor": {
        WORKSPACE_READ,
        MEMBER_READ,
        PROJECT_READ,
        WORKFLOW_READ,
        AUDIT_READ, ANALYTICS_READ,
    },
    "Viewer": {
        WORKSPACE_READ,
        MEMBER_READ,
        PROJECT_READ,
        WORKFLOW_READ,
    },
}
