# SECUREFLOW REST API Reference Specification

Base URL: `/api/v1`

All requests requiring authentication must supply the `Authorization: Bearer <jwt_access_token>` header. Multi-tenant endpoints accept the optional `X-Organization-Id: <org_uuid>` header to specify active workspace context.

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticates a user with email and password.
- **Request Body**:
  ```json
  {
    "email": "sarah.chen@acmecloud.io",
    "password": "SecureFlow2026!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600
  }
  ```

### `POST /auth/register`
Creates a new user, provisions a new organization workspace, and assigns the user as `Owner`.

### `POST /auth/dev-login`
Rapid 1-click test role authentication for evaluating multi-role RBAC permissions.
- **Request Body**:
  ```json
  {
    "role": "Admin",
    "email": "alex.rivera@acmecloud.io"
  }
  ```

### `GET /auth/me`
Returns current user profile, active organization, active role, and array of granted permission codes.

---

## 2. Projects Endpoints

### `GET /projects`
Returns paginated list of projects filtered by workspace, query search, and status.

### `POST /projects`
Creates a new engineering project.
- **Required Permission**: `project.create`
- **Request Body**:
  ```json
  {
    "name": "Payments Service",
    "key": "PAY",
    "description": "Core payment processing pipeline",
    "lead_id": "usr-lead-uuid"
  }
  ```

### `GET /projects/{project_id}`
Returns single project details with aggregated workflow count metrics.

---

## 3. Workflows & Pipeline Endpoints

### `GET /workflows`
Returns paginated list of workflows with filter options (`project_id`, `status`, `risk`, `search`).

### `POST /workflows`
Creates and submits a new multi-step engineering workflow.
- **Required Permission**: `workflow.create`
- **Request Body**:
  ```json
  {
    "project_id": "proj-uuid",
    "name": "Production Database DDL Migration",
    "description": "Zero-downtime column addition to transactions table",
    "risk_level": "high",
    "steps": [
      {
        "name": "DBA Review",
        "description": "Verify index locking impact",
        "required_role": "Admin",
        "step_order": 0
      },
      {
        "name": "Security Sign-off",
        "description": "Verify encryption keys",
        "required_role": "Admin",
        "step_order": 1
      }
    ]
  }
  ```

### `GET /workflows/{workflow_id}`
Returns workflow entity with nested `steps`, `approvals`, `project`, and `creator`.

### `POST /workflows/{workflow_id}/decide`
Submits a decision for the current pending workflow step.
- **Required Permission**: `workflow.approve` or `workflow.reject`
- **Request Body**:
  ```json
  {
    "decision": "approve",
    "decision_reason": "Rollback procedure tested and verified",
    "comments": "Signed off for 02:00 UTC maintenance window"
  }
  ```

---

## 4. Approvals Queue

### `GET /approvals`
Returns pending, approved, or rejected approval records for the active workspace.

---

## 5. Members & RBAC Roles

### `GET /members`
Returns all active and invited members of the organization.

### `POST /members/invite`
Invites a new team member with assigned role.
- **Required Permission**: `member.invite`

### `PUT /members/{member_id}/role`
Updates a member's authorization role.
- **Required Permission**: `role.assign`

### `GET /roles/matrix`
Returns the complete RBAC permission matrix grouped by category.

---

## 6. Audit & Analytics

### `GET /audit-logs`
Queries security audit logs with pagination and filters (`action`, `resource_type`, `search`).
- **Required Permission**: `audit.read`

### `GET /analytics/operational`
Returns real-time operational metrics, 7-day volume timeline, turnaround times, and status distributions.
- **Required Permission**: `analytics.read`
