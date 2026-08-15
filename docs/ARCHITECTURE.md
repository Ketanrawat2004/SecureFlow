# SECUREFLOW System Architecture & Technical Specifications

## 1. Executive Summary

**SECUREFLOW** is an enterprise-grade engineering access governance and workflow authorization SaaS platform. It enables modern engineering organizations to manage access, orchestrate sequential multi-stakeholder approval pipelines, enforce granular Role-Based Access Control (RBAC), and maintain immutable compliance audit logs for infrastructure deployments, database migrations, and sensitive cloud permissions.

---

## 2. High-Level System Architecture

```
                                  [ Browser / Client ]
                                           |
                                      (HTTPS / WSS)
                                           v
                              +-------------------------+
                              |      Nginx Ingress      |
                              | (Reverse Proxy & Static)|
                              +-------------------------+
                                 /                   \
                 /assets /index.html               /api/v1/*
                       /                               \
           +-----------------------+       +-----------------------+
           | React SPA (Vite / TS) |       | FastAPI REST Engine   |
           | Zustand / TanStack    |       | RBAC & Rate Limiting  |
           +-----------------------+       +-----------------------+
                                                       |
                       +-------------------------------+-------------------------------+
                       |                               |                               |
                       v                               v                               v
             +-------------------+           +-------------------+           +-------------------+
             | PostgreSQL 16 DB  |           | Redis 7 In-Memory |           | Apache Kafka Bus  |
             | Relational State  |           | Window Limiter    |           | Domain Event Hub  |
             | UUIDs / UTC / ACID|           | Cache & Sessions  |           | Event Streaming   |
             +-------------------+           +-------------------+           +-------------------+
                                                                                       |
                                                               +-----------------------+-----------------------+
                                                               |                       |                       |
                                                               v                       v                       v
                                                     +-------------------+   +-------------------+   +-------------------+
                                                     | Audit Worker      |   | Notif Worker      |   | Analytics Worker  |
                                                     | Idempotent Log    |   | Inbox Dispatcher  |   | Metric Streamer   |
                                                     +-------------------+   +-------------------+   +-------------------+
```

---

## 3. Core Architectural Principles

1. **Strict Separation of Concerns**: REST API controllers remain thin and strictly delegate validation, persistence, and business logic to dedicated Service classes.
2. **Resilience & Graceful Fallbacks**: In local/zero-cost environments where Kafka or Redis are not attached, the backend smoothly falls back to SQLite, an in-memory sliding window rate limiter, and a high-performance in-memory domain event queue without crashing.
3. **Defense-in-Depth Security**: Frontend checks provide responsive UX, while every backend route independently validates JWT claims, active workspace membership, and exact granular permission codes.
4. **Immutable Audit Trails**: Every state transition (creation, approval, rejection, role change, membership modification) emits domain events that are persisted to compliance audit logs.

---

## 4. Entity Relational Model

- **`User`**: Identity entity with bcrypt password hash, avatar, and active status.
- **`Organization`**: Isolated multi-tenant workspace with unique slug and metadata.
- **`Membership`**: Binds a user to an organization with a specific `Role` (`active`, `invited`, `suspended`).
- **`Role` & `Permission`**: Many-to-many RBAC configuration (`Owner`, `Admin`, `Developer`, `Auditor`, `Viewer`).
- **`Project`**: Engineering repository or service domain (e.g. `PAY`, `DEV`, `INFRA`, `ZT-GATE`).
- **`Workflow`**: Authorization pipeline containing ordered `WorkflowStep` items.
- **`WorkflowStep`**: A sequential stage requiring sign-off by a specific role.
- **`Approval`**: Consequential decision record (`approved`, `rejected`, `changes_requested`).
- **`AuditLog`**: Tamper-evident ledger of operations with actor, resource, context JSON, and timestamp.
- **`Notification`**: User alerts generated on workflow state changes.

---

## 5. Sequential Workflow State Machine

```
              +-------------------------+
              |          Draft          |
              +-------------------------+
                           |
                           v
              +-------------------------+
              |    Pending Approval     | <------+
              +-------------------------+        |
                 /          |          \         |
      (Step Appr)      (Reject)    (Changes Req) |
               /            |            \_______|
              v             v
       [ Next Step ]   +----------+
              |        | Rejected |
              v        +----------+
         (All Steps)
              |
              v
       +--------------+
       |   Approved   |
       +--------------+
              |
              v
       +--------------+
       |   Executed   |
       +--------------+
```

---

## 6. Granular RBAC Permission Matrix

| Permission Code | Owner | Admin | Developer | Auditor | Viewer | Description |
|---|:---:|:---:|:---:|:---:|:---:|---|
| `workspace.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | Workspace settings & billing |
| `project.create` | ✅ | ✅ | ✅ | ❌ | ❌ | Create new engineering projects |
| `project.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | Delete projects |
| `workflow.create` | ✅ | ✅ | ✅ | ❌ | ❌ | Author & submit workflows |
| `workflow.approve` | ✅ | ✅ | ❌ | ❌ | ❌ | Approve pipeline steps |
| `workflow.reject` | ✅ | ✅ | ❌ | ❌ | ❌ | Reject workflows |
| `member.invite` | ✅ | ✅ | ❌ | ❌ | ❌ | Invite team members |
| `member.remove` | ✅ | ✅ | ❌ | ❌ | ❌ | Remove members |
| `role.assign` | ✅ | ✅ | ❌ | ❌ | ❌ | Change member roles |
| `audit.read` | ✅ | ✅ | ❌ | ✅ | ❌ | Review security audit logs |
| `analytics.read` | ✅ | ✅ | ✅ | ✅ | ✅ | View operational metrics |
