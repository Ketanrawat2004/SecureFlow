import logging
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.rbac import ALL_PERMISSIONS, SYSTEM_ROLES_PERMISSIONS
from app.core.security import get_password_hash
from app.models.entities import (
    Approval,
    AuditLog,
    Membership,
    Notification,
    Organization,
    Permission,
    Project,
    Role,
    RolePermission,
    User,
    Workflow,
    WorkflowStep,
)

logger = logging.getLogger(__name__)


async def seed_database(db: AsyncSession) -> None:
    """Seed system roles, permissions, realistic organizations, projects, workflows, audit logs, and notifications."""
    # Check if database is already seeded
    stmt = select(Permission).limit(1)
    res = await db.execute(stmt)
    if res.scalar_one_or_none() is not None:
        logger.info("Database already seeded. Skipping initial seeding.")
        return

    logger.info("Starting database seeding with realistic engineering workflows and seed data...")

    # 1. Create Permissions
    permission_map = {}
    for p_data in ALL_PERMISSIONS:
        perm = Permission(
            id=str(uuid.uuid4()),
            code=p_data["code"],
            description=p_data["description"],
            category=p_data["category"],
        )
        db.add(perm)
        permission_map[p_data["code"]] = perm

    await db.flush()

    # 2. Create System Roles
    role_descriptions = {
        "Owner": "Full control over organization, billing, members, and all security settings",
        "Admin": "Manage projects, workflows, invite members, and approve consequential changes",
        "Developer": "Create projects, author workflows, execute pipeline actions",
        "Auditor": "Read-only audit, security events, and compliance inspection access",
        "Viewer": "Read-only visibility into projects and workflow statuses",
    }

    role_map = {}
    for role_name, perms_set in SYSTEM_ROLES_PERMISSIONS.items():
        role = Role(
            id=str(uuid.uuid4()),
            name=role_name,
            description=role_descriptions[role_name],
            is_system=True,
        )
        db.add(role)
        await db.flush()
        role_map[role_name] = role

        for code in perms_set:
            if code in permission_map:
                rp = RolePermission(
                    id=str(uuid.uuid4()),
                    role_id=role.id,
                    permission_id=permission_map[code].id,
                )
                db.add(rp)

    await db.flush()

    # 3. Create Seed Users with realistic engineering profiles
    demo_password_hash = get_password_hash("SecureFlow2026!")

    users_data = [
        {
            "id": "u-owner-001",
            "email": "sarah.chen@acmecloud.io",
            "full_name": "Sarah Chen",
            "role": "Owner",
            "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        },
        {
            "id": "u-admin-002",
            "email": "alex.rivera@acmecloud.io",
            "full_name": "Alex Rivera",
            "role": "Admin",
            "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        },
        {
            "id": "u-dev-003",
            "email": "elena.rostova@acmecloud.io",
            "full_name": "Elena Rostova",
            "role": "Developer",
            "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        },
        {
            "id": "u-dev-004",
            "email": "marcus.vance@acmecloud.io",
            "full_name": "Marcus Vance",
            "role": "Developer",
            "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
        },
        {
            "id": "u-auditor-005",
            "email": "david.kim@acmecloud.io",
            "full_name": "David Kim",
            "role": "Auditor",
            "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
        },
        {
            "id": "u-viewer-006",
            "email": "maya.patel@acmecloud.io",
            "full_name": "Maya Patel",
            "role": "Viewer",
            "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
        },
    ]

    user_map = {}
    for u_item in users_data:
        user = User(
            id=u_item["id"],
            email=u_item["email"],
            full_name=u_item["full_name"],
            hashed_password=demo_password_hash,
            avatar_url=u_item["avatar_url"],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        user_map[u_item["email"]] = user

    await db.flush()

    # 4. Create Organization: Acme Cloud Infrastructure
    org = Organization(
        id="org-acme-corp",
        name="Acme Cloud Infrastructure",
        slug="acme-cloud",
        description="Core infrastructure, distributed systems platform, and developer tooling governance",
        avatar_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    )
    db.add(org)
    await db.flush()

    # Add Memberships
    for u_item in users_data:
        mem = Membership(
            id=str(uuid.uuid4()),
            user_id=u_item["id"],
            organization_id=org.id,
            role_id=role_map[u_item["role"]].id,
            status="active",
        )
        db.add(mem)

    await db.flush()

    # 5. Create Realistic Projects
    projects_data = [
        {
            "id": "proj-pay-01",
            "name": "Payments Platform",
            "key": "PAY",
            "description": "High-throughput PCI-DSS payment transaction processing service and ledger",
            "lead": user_map["alex.rivera@acmecloud.io"],
            "status": "active",
        },
        {
            "id": "proj-dev-02",
            "name": "Developer Portal",
            "key": "DEV",
            "description": "Internal developer platform, service catalog, and API documentation gateway",
            "lead": user_map["elena.rostova@acmecloud.io"],
            "status": "active",
        },
        {
            "id": "proj-inf-03",
            "name": "Infrastructure Automation",
            "key": "INFRA",
            "description": "Terraform, Kubernetes GitOps operators, and multi-region network mesh configuration",
            "lead": user_map["sarah.chen@acmecloud.io"],
            "status": "active",
        },
        {
            "id": "proj-sec-04",
            "name": "Zero Trust Gateway",
            "key": "ZT-GATE",
            "description": "Identity-aware proxy, mTLS certificate rotators, and egress filtering rules",
            "lead": user_map["david.kim@acmecloud.io"],
            "status": "active",
        },
    ]

    proj_map = {}
    for p in projects_data:
        project = Project(
            id=p["id"],
            organization_id=org.id,
            name=p["name"],
            key=p["key"],
            description=p["description"],
            status=p["status"],
            lead_id=p["lead"].id,
        )
        db.add(project)
        proj_map[p["key"]] = project

    await db.flush()

    now = datetime.now(timezone.utc)

    # 6. Create Realistic Workflows with steps and approvals
    # Workflow 1: Production Deployment v2.14.0 (Pending Approval)
    wf1 = Workflow(
        id="wf-prod-deploy-01",
        organization_id=org.id,
        project_id=proj_map["PAY"].id,
        creator_id=user_map["elena.rostova@acmecloud.io"].id,
        name="Production Deployment - Payments Engine v2.14.0",
        description="Canary deployment rollout for tokenized authorization engine to us-east-1 and eu-west-1 clusters.",
        status="pending_approval",
        current_step_index=1,
        risk_level="high",
        created_at=now - timedelta(hours=3),
    )
    db.add(wf1)
    await db.flush()

    s1_1 = WorkflowStep(
        id="step-wf1-1",
        workflow_id=wf1.id,
        step_order=0,
        name="Automated Integration & Load Verification",
        description="Run 10,000 rps load regression against staging cluster and verify p99 latency < 25ms",
        required_role="Developer",
        status="approved",
        approved_by_user_id=user_map["elena.rostova@acmecloud.io"].id,
        approved_at=now - timedelta(hours=2, minutes=45),
        notes="Automated test suite passed (148/148 passed, p99 latency 18.2ms).",
    )
    s1_2 = WorkflowStep(
        id="step-wf1-2",
        workflow_id=wf1.id,
        step_order=1,
        name="Principal SRE Security & Production Gate",
        description="Review database lock duration, rollback plan, and mTLS secret rotation",
        required_role="Admin",
        status="pending",
    )
    db.add_all([s1_1, s1_2])
    await db.flush()

    appr1 = Approval(
        id="appr-wf1-01",
        workflow_id=wf1.id,
        step_id=s1_2.id,
        requester_id=user_map["elena.rostova@acmecloud.io"].id,
        status="pending",
        comments="Rollback playbook verified in staging. Change involves no schema breaking locks.",
        created_at=now - timedelta(hours=2, minutes=40),
    )
    db.add(appr1)

    # Workflow 2: Database Migration (Approved)
    wf2 = Workflow(
        id="wf-db-migration-02",
        organization_id=org.id,
        project_id=proj_map["INFRA"].id,
        creator_id=user_map["marcus.vance@acmecloud.io"].id,
        name="PostgreSQL 16 Partitioning Migration - Ledger Tables",
        description="Range-partition historical ledger transaction tables by calendar month to improve query pruning.",
        status="approved",
        current_step_index=2,
        risk_level="critical",
        created_at=now - timedelta(days=1, hours=4),
    )
    db.add(wf2)
    await db.flush()

    s2_1 = WorkflowStep(
        id="step-wf2-1",
        workflow_id=wf2.id,
        step_order=0,
        name="Database Shadow Dry-Run Execution",
        description="Execute partition DDL on shadow replica with live replication stream enabled",
        required_role="Developer",
        status="approved",
        approved_by_user_id=user_map["marcus.vance@acmecloud.io"].id,
        approved_at=now - timedelta(days=1, hours=2),
    )
    s2_2 = WorkflowStep(
        id="step-wf2-2",
        workflow_id=wf2.id,
        step_order=1,
        name="Database Administrator Sign-off",
        description="Verify replication lag and table locking metrics",
        required_role="Admin",
        status="approved",
        approved_by_user_id=user_map["alex.rivera@acmecloud.io"].id,
        approved_at=now - timedelta(days=1, hours=1),
        notes="Replication lag stayed within 120ms during shadow creation. Approved for production maintenance window.",
    )
    db.add_all([s2_1, s2_2])
    await db.flush()

    appr2 = Approval(
        id="appr-wf2-01",
        workflow_id=wf2.id,
        step_id=s2_2.id,
        requester_id=user_map["marcus.vance@acmecloud.io"].id,
        approver_id=user_map["alex.rivera@acmecloud.io"].id,
        status="approved",
        comments="Shadow validation successful. Lock time under 400ms.",
        decision_reason="Replication safety verified.",
        decided_at=now - timedelta(days=1, hours=1),
        created_at=now - timedelta(days=1, hours=3),
    )
    db.add(appr2)

    # Workflow 3: Security Review - OAuth2 Migration (Changes Requested)
    wf3 = Workflow(
        id="wf-sec-review-03",
        organization_id=org.id,
        project_id=proj_map["DEV"].id,
        creator_id=user_map["marcus.vance@acmecloud.io"].id,
        name="Security Review - OAuth2 PKCE Migration",
        description="Migrate developer portal client credentials to Authorization Code flow with PKCE for single page apps.",
        status="changes_requested",
        current_step_index=0,
        risk_level="medium",
        created_at=now - timedelta(days=2),
    )
    db.add(wf3)
    await db.flush()

    s3_1 = WorkflowStep(
        id="step-wf3-1",
        workflow_id=wf3.id,
        step_order=0,
        name="Security Architecture Compliance Review",
        description="Verify code challenge calculation and token lifetime settings against NIST SP 800-63B",
        required_role="Auditor",
        status="rejected",
        approved_by_user_id=user_map["david.kim@acmecloud.io"].id,
        approved_at=now - timedelta(days=1, hours=18),
        notes="Please reduce refresh token expiration to 7 days and add strict redirect URI exact-matching.",
    )
    db.add(s3_1)

    appr3 = Approval(
        id="appr-wf3-01",
        workflow_id=wf3.id,
        step_id=s3_1.id,
        requester_id=user_map["marcus.vance@acmecloud.io"].id,
        approver_id=user_map["david.kim@acmecloud.io"].id,
        status="changes_requested",
        comments="Please address token lifetime concerns outlined in the NIST compliance specification.",
        decision_reason="Token lifetime settings require adjustment.",
        decided_at=now - timedelta(days=1, hours=18),
        created_at=now - timedelta(days=2),
    )
    db.add(appr3)

    # Workflow 4: Emergency Firewall Rule Update (Approved & Executed)
    wf4 = Workflow(
        id="wf-firewall-04",
        organization_id=org.id,
        project_id=proj_map["ZT-GATE"].id,
        creator_id=user_map["sarah.chen@acmecloud.io"].id,
        name="Emergency Egress Firewall Rule Update",
        description="Block malicious outbound C2 IP range identified by Threat Intel feed in CIDR 198.51.100.0/24.",
        status="executed",
        current_step_index=1,
        risk_level="critical",
        created_at=now - timedelta(days=3),
    )
    db.add(wf4)
    await db.flush()

    s4_1 = WorkflowStep(
        id="step-wf4-1",
        workflow_id=wf4.id,
        step_order=0,
        name="Emergency Security Officer Authorization",
        description="Executive sign-off on immediate perimeter firewall rule push",
        required_role="Owner",
        status="approved",
        approved_by_user_id=user_map["sarah.chen@acmecloud.io"].id,
        approved_at=now - timedelta(days=3),
        notes="Approved under emergency incident response protocol IR-8821.",
    )
    db.add(s4_1)

    # 7. Create Audit Logs
    audit_entries = [
        {
            "actor": user_map["sarah.chen@acmecloud.io"],
            "action": "workflow.approved",
            "resource_type": "workflow",
            "resource_id": wf4.id,
            "context": '{"reason": "Emergency security incident protocol IR-8821", "risk": "critical"}',
            "created_at": now - timedelta(days=3),
        },
        {
            "actor": user_map["david.kim@acmecloud.io"],
            "action": "workflow.changes_requested",
            "resource_type": "workflow",
            "resource_id": wf3.id,
            "context": '{"step": "Security Architecture Review", "reason": "NIST compliance lifetime adjustments"}',
            "created_at": now - timedelta(days=1, hours=18),
        },
        {
            "actor": user_map["alex.rivera@acmecloud.io"],
            "action": "workflow.approved",
            "resource_type": "workflow",
            "resource_id": wf2.id,
            "context": '{"step": "Database Administrator Sign-off", "impact": "PostgreSQL Partitioning"}',
            "created_at": now - timedelta(days=1, hours=1),
        },
        {
            "actor": user_map["elena.rostova@acmecloud.io"],
            "action": "workflow.created",
            "resource_type": "workflow",
            "resource_id": wf1.id,
            "context": '{"project": "PAY", "target_env": "production", "risk": "high"}',
            "created_at": now - timedelta(hours=3),
        },
        {
            "actor": user_map["sarah.chen@acmecloud.io"],
            "action": "member.invited",
            "resource_type": "member",
            "resource_id": user_map["maya.patel@acmecloud.io"].id,
            "context": '{"invited_role": "Viewer", "email": "maya.patel@acmecloud.io"}',
            "created_at": now - timedelta(days=4),
        },
    ]

    for log in audit_entries:
        audit = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            actor_id=log["actor"].id,
            actor_email=log["actor"].email,
            action=log["action"],
            resource_type=log["resource_type"],
            resource_id=log["resource_id"],
            context=log["context"],
            ip_address="192.168.1.100",
            created_at=log["created_at"],
        )
        db.add(audit)

    # 8. Create Realistic Notifications
    notifications_data = [
        {
            "user": user_map["alex.rivera@acmecloud.io"],
            "title": "Approval Required: Payments Engine v2.14.0",
            "message": "Elena Rostova submitted a high-risk production deployment for your approval.",
            "type": "approval_request",
            "link": f"/workflows/{wf1.id}",
            "is_read": False,
            "created_at": now - timedelta(hours=2, minutes=40),
        },
        {
            "user": user_map["sarah.chen@acmecloud.io"],
            "title": "Approval Required: Payments Engine v2.14.0",
            "message": "Elena Rostova submitted a high-risk production deployment for your approval.",
            "type": "approval_request",
            "link": f"/workflows/{wf1.id}",
            "is_read": False,
            "created_at": now - timedelta(hours=2, minutes=40),
        },
        {
            "user": user_map["marcus.vance@acmecloud.io"],
            "title": "Workflow Changes Requested",
            "message": "David Kim requested modifications on 'Security Review - OAuth2 PKCE Migration'.",
            "type": "workflow_status",
            "link": f"/workflows/{wf3.id}",
            "is_read": False,
            "created_at": now - timedelta(days=1, hours=18),
        },
        {
            "user": user_map["marcus.vance@acmecloud.io"],
            "title": "Workflow Approved: PostgreSQL Partitioning",
            "message": "Alex Rivera approved the database migration workflow for execution.",
            "type": "workflow_status",
            "link": f"/workflows/{wf2.id}",
            "is_read": True,
            "created_at": now - timedelta(days=1, hours=1),
        },
    ]

    for notif in notifications_data:
        n = Notification(
            id=str(uuid.uuid4()),
            user_id=notif["user"].id,
            organization_id=org.id,
            title=notif["title"],
            message=notif["message"],
            type=notif["type"],
            link=notif["link"],
            is_read=notif["is_read"],
            created_at=notif["created_at"],
        )
        db.add(n)

    await db.commit()
    logger.info("Database seeding successfully completed with full domain models.")
