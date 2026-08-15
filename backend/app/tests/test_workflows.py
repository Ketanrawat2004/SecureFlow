import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_workflow_lifecycle_create_and_approve(client: AsyncClient, auth_headers):
    """Test full workflow creation, step progression, and approval lifecycle."""
    dev_headers = auth_headers("u-dev-003")
    admin_headers = auth_headers("u-admin-002")

    # 1. Create Workflow
    wf_payload = {
        "project_id": "proj-pay-01",
        "name": "PCI Egress Allowlist Update",
        "description": "Allow outbound traffic to verified fraud analytics endpoint",
        "risk_level": "medium",
        "steps": [
            {
                "step_order": 0,
                "name": "Security Architecture Sign-off",
                "description": "Verify TLS 1.3 requirement",
                "required_role": "Admin",
            }
        ],
    }
    create_resp = await client.post("/api/v1/workflows", json=wf_payload, headers=dev_headers)
    assert create_resp.status_code == 200
    wf_data = create_resp.json()
    wf_id = wf_data["id"]
    assert wf_data["status"] == "pending_approval"
    assert len(wf_data["steps"]) == 1

    # 2. Approve Workflow by Admin
    decision_payload = {
        "decision": "approve",
        "comments": "TLS 1.3 configuration and cipher suites verified.",
        "decision_reason": "Policy compliant",
    }
    decision_resp = await client.post(
        f"/api/v1/workflows/{wf_id}/decide",
        json=decision_payload,
        headers=admin_headers,
    )
    assert decision_resp.status_code == 200
    updated_wf = decision_resp.json()
    assert updated_wf["status"] == "approved"
    assert updated_wf["steps"][0]["status"] == "approved"


@pytest.mark.asyncio
async def test_workflow_decision_reject(client: AsyncClient, auth_headers):
    """Test workflow rejection flow."""
    dev_headers = auth_headers("u-dev-003")
    admin_headers = auth_headers("u-admin-002")

    # Create Workflow
    wf_payload = {
        "project_id": "proj-pay-01",
        "name": "Disable Mutual TLS in Dev-Staging",
        "description": "Temporary debug toggle",
        "risk_level": "critical",
        "steps": [
            {
                "step_order": 0,
                "name": "Security Officer Approval",
                "required_role": "Admin",
            }
        ],
    }
    create_resp = await client.post("/api/v1/workflows", json=wf_payload, headers=dev_headers)
    wf_id = create_resp.json()["id"]

    # Reject
    decision_payload = {
        "decision": "reject",
        "comments": "Disabling mTLS violates zero-trust baseline policy.",
        "decision_reason": "Zero-trust compliance violation",
    }
    decision_resp = await client.post(
        f"/api/v1/workflows/{wf_id}/decide",
        json=decision_payload,
        headers=admin_headers,
    )
    assert decision_resp.status_code == 200
    assert decision_resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_workflow_decision_request_changes(client: AsyncClient, auth_headers):
    """Test workflow changes requested flow."""
    dev_headers = auth_headers("u-dev-003")
    admin_headers = auth_headers("u-admin-002")

    wf_payload = {
        "project_id": "proj-dev-02",
        "name": "Update Public API Gateway CORS Headers",
        "description": "Enable wildcards on origins",
        "risk_level": "high",
        "steps": [{"step_order": 0, "name": "AppSec Review", "required_role": "Admin"}],
    }
    create_resp = await client.post("/api/v1/workflows", json=wf_payload, headers=dev_headers)
    wf_id = create_resp.json()["id"]

    # Request Changes
    decision_payload = {
        "decision": "request_changes",
        "comments": "Wildcard origins are disallowed. Specify exact allowed origins list.",
        "decision_reason": "Insecure CORS wildcards",
    }
    decision_resp = await client.post(
        f"/api/v1/workflows/{wf_id}/decide",
        json=decision_payload,
        headers=admin_headers,
    )
    assert decision_resp.status_code == 200
    assert decision_resp.json()["status"] == "changes_requested"
