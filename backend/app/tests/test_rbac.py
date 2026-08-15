import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_viewer_cannot_create_project(client: AsyncClient, auth_headers):
    """Verify that a user with 'Viewer' role is denied (HTTP 403) when attempting project creation."""
    viewer_headers = auth_headers("u-viewer-006")
    payload = {
        "name": "Unauthorized Project Attempt",
        "key": "UNAUTH",
        "description": "Should fail with 403",
    }
    response = await client.post("/api/v1/projects", json=payload, headers=viewer_headers)
    assert response.status_code == 403
    assert "Permission denied" in response.json()["detail"]


@pytest.mark.asyncio
async def test_developer_can_create_project(client: AsyncClient, auth_headers):
    """Verify that a user with 'Developer' role can create projects."""
    dev_headers = auth_headers("u-dev-003")
    payload = {
        "name": "Billing Webhooks Service",
        "key": "BILL-HOOK",
        "description": "Reliable webhook delivery cluster",
    }
    response = await client.post("/api/v1/projects", json=payload, headers=dev_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "BILL-HOOK"
    assert data["name"] == "Billing Webhooks Service"


@pytest.mark.asyncio
async def test_auditor_can_read_audit_logs_but_cannot_invite_member(client: AsyncClient, auth_headers):
    """Verify Auditor role permissions boundaries."""
    auditor_headers = auth_headers("u-auditor-005")

    # Auditor should be able to read audit logs
    audit_resp = await client.get("/api/v1/audit-logs", headers=auditor_headers)
    assert audit_resp.status_code == 200

    # Auditor should be forbidden from inviting members
    invite_resp = await client.post(
        "/api/v1/members/invite",
        json={"email": "new.hire@acmecloud.io", "role_id": "dummy"},
        headers=auditor_headers,
    )
    assert invite_resp.status_code == 403
