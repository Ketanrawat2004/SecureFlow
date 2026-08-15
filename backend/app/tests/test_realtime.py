import asyncio
import pytest
from httpx import AsyncClient
from app.events.kafka_client import DomainEvent
from app.events.realtime_hub import Subscriber, realtime_hub


@pytest.mark.asyncio
async def test_sse_stream_unauthorized_without_token(client: AsyncClient):
    """Test that SSE stream requires authentication."""
    response = await client.get("/api/v1/realtime/stream")
    assert response.status_code == 401
    assert "token required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_realtime_hub_rbac_filtering():
    """Test that RealtimeHub filters events according to role permissions."""
    viewer_sub = Subscriber(
        user_id="u-viewer-005",
        org_id="org-acme-corp",
        role_name="Viewer",
        permissions={"workspace.read", "project.read", "workflow.read"},
    )
    owner_sub = Subscriber(
        user_id="u-owner-001",
        org_id="org-acme-corp",
        role_name="Owner",
        permissions={"workspace.read", "project.read", "workflow.read", "audit.read", "analytics.read"},
    )

    await realtime_hub.add_subscriber(viewer_sub)
    await realtime_hub.add_subscriber(owner_sub)

    # 1. Broadcast Audit event (requires audit.read)
    audit_event = DomainEvent(
        event_type="AuditEventCreated",
        aggregate_id="aud-123",
        organization_id="org-acme-corp",
        payload={"action": "security.token_rotated"},
    )
    await realtime_hub.broadcast_domain_event(audit_event)

    # Owner should receive the audit event
    assert not owner_sub.queue.empty()
    received_owner = owner_sub.queue.get_nowait()
    assert received_owner["event_type"] == "AuditEventCreated"

    # Viewer MUST NOT receive the audit event
    assert viewer_sub.queue.empty()

    # 2. Broadcast Workflow event (requires workflow.read - permitted for both)
    wf_event = DomainEvent(
        event_type="WorkflowCreated",
        aggregate_id="wf-456",
        organization_id="org-acme-corp",
        payload={"name": "Deploy Kubernetes Cluster", "creator_name": "Elena"},
    )
    await realtime_hub.broadcast_domain_event(wf_event)

    # Both should receive workflow event
    assert not viewer_sub.queue.empty()
    assert not owner_sub.queue.empty()

    received_viewer = viewer_sub.queue.get_nowait()
    assert received_viewer["event_type"] == "WorkflowCreated"

    # Clean up
    await realtime_hub.remove_subscriber(viewer_sub)
    await realtime_hub.remove_subscriber(owner_sub)
