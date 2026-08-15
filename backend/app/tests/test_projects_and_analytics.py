import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient, auth_headers):
    """Test listing projects returns paginated items with workflow stats."""
    headers = auth_headers("u-owner-001")
    response = await client.get("/api/v1/projects", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] >= 4
    assert any(p["key"] == "PAY" for p in data["items"])


@pytest.mark.asyncio
async def test_duplicate_project_key_rejected(client: AsyncClient, auth_headers):
    """Test that creating a project with duplicate key in the same org returns 400."""
    headers = auth_headers("u-owner-001")
    payload = {
        "name": "Duplicate Key Attempt",
        "key": "PAY",  # already exists
        "description": "Should fail",
    }
    response = await client.post("/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 400
    assert "already used" in response.json()["detail"]


@pytest.mark.asyncio
async def test_operational_analytics(client: AsyncClient, auth_headers):
    """Test operational analytics endpoint returns calculated stats."""
    headers = auth_headers("u-owner-001")
    response = await client.get("/api/v1/analytics/operational", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_workflows" in data
    assert "active_workflows" in data
    assert "pending_approvals" in data
    assert "approval_rate_percent" in data
    assert len(data["workflows_by_status"]) > 0
    assert len(data["volume_timeline"]) == 7


@pytest.mark.asyncio
async def test_audit_logs_filter(client: AsyncClient, auth_headers):
    """Test audit logs filtering by action and search."""
    headers = auth_headers("u-auditor-005")
    response = await client.get("/api/v1/audit-logs?action=workflow.approved", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert all(item["action"] == "workflow.approved" for item in data["items"])


@pytest.mark.asyncio
async def test_member_invite_and_role_update(client: AsyncClient, auth_headers):
    """Test inviting a member and updating their role."""
    owner_headers = auth_headers("u-owner-001")

    # 1. Fetch Developer Role ID
    roles_resp = await client.get("/api/v1/roles", headers=owner_headers)
    dev_role = next(r for r in roles_resp.json() if r["name"] == "Developer")
    admin_role = next(r for r in roles_resp.json() if r["name"] == "Admin")

    # 2. Invite Member
    invite_payload = {
        "email": "jordan.taylor@acmecloud.io",
        "full_name": "Jordan Taylor",
        "role_id": dev_role["id"],
    }
    invite_resp = await client.post("/api/v1/members/invite", json=invite_payload, headers=owner_headers)
    assert invite_resp.status_code == 200
    mem_data = invite_resp.json()
    mem_id = mem_data["id"]
    assert mem_data["user"]["email"] == "jordan.taylor@acmecloud.io"
    assert mem_data["role"]["name"] == "Developer"

    # 3. Update Role to Admin
    role_update_resp = await client.put(
        f"/api/v1/members/{mem_id}/role",
        json={"role_id": admin_role["id"]},
        headers=owner_headers,
    )
    assert role_update_resp.status_code == 200
    assert role_update_resp.json()["role"]["name"] == "Admin"
