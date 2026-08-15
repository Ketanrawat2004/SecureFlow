"""
SecureFlow - Notification Event Worker
Consumes domain events and creates persistent notifications for target actors and reviewers.
"""

import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.entities import Membership, Notification, Role, User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [NOTIFICATION-WORKER] %(levelname)s: %(message)s")
logger = logging.getLogger("notification_worker")


async def process_notification_event(event_data: dict) -> None:
    """Process domain event and generate notifications for relevant users."""
    event_type = event_data.get("event_type")
    org_id = event_data.get("organization_id") or "org-acme-corp"
    payload = event_data.get("payload", {})
    event_id = event_data.get("event_id")

    async with async_session_maker() as session:
        if event_type == "WorkflowCreated":
            # Notify Admins and Owners that an approval is required
            stmt = (
                select(Membership)
                .join(Role, Role.id == Membership.role_id)
                .where(
                    Membership.organization_id == org_id,
                    Role.name.in_(["Admin", "Owner"]),
                    Membership.status == "active",
                )
            )
            members = (await session.execute(stmt)).scalars().all()
            for m in members:
                # Don't notify the creator themselves
                if m.user_id != payload.get("creator_id"):
                    notif = Notification(
                        id=str(uuid.uuid4()),
                        user_id=m.user_id,
                        organization_id=org_id,
                        title=f"Approval Required: {payload.get('name', 'Workflow')}",
                        message=f"{payload.get('creator_name', 'A team member')} submitted a workflow requiring your approval.",
                        type="approval_request",
                        link=f"/workflows/{payload.get('workflow_id')}",
                        event_id=event_id,
                        created_at=datetime.now(timezone.utc),
                    )
                    session.add(notif)

        elif event_type in ["WorkflowApproved", "WorkflowRejected", "WorkflowChangesRequested"]:
            # Notify the creator of the decision
            creator_id = payload.get("creator_id")
            if creator_id:
                status_label = {
                    "WorkflowApproved": "Approved",
                    "WorkflowRejected": "Rejected",
                    "WorkflowChangesRequested": "Changes Requested",
                }.get(event_type, "Updated")

                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=creator_id,
                    organization_id=org_id,
                    title=f"Workflow {status_label}: {payload.get('workflow_name', 'Workflow')}",
                    message=f"{payload.get('decided_by_name', 'Reviewer')} marked your workflow as {status_label.lower()}.",
                    type="workflow_status",
                    link=f"/workflows/{payload.get('workflow_id')}",
                    event_id=event_id,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(notif)

        await session.commit()
        logger.info("Processed notifications for event %s (%s)", event_id, event_type)


async def run_worker() -> None:
    logger.info("Starting Notification Worker...")
    if not settings.KAFKA_ENABLED:
        logger.info("Kafka is disabled. Notification Worker running in standby mode.")
        while True:
            await asyncio.sleep(60)
        return

    try:
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            "secureflow.events.workflowcreated",
            "secureflow.events.workflowapproved",
            "secureflow.events.workflowrejected",
            "secureflow.events.workflowchangesrequested",
            "secureflow.events.memberinvited",
            bootstrap_servers=settings.KAFKA_BROKERS,
            group_id="secureflow-notification-worker-group",
            auto_offset_reset="earliest",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        await consumer.start()
        try:
            async for msg in consumer:
                await process_notification_event(msg.value)
        finally:
            await consumer.stop()
    except Exception as e:
        logger.warning("Notification worker standby due to Kafka connection: %s", e)
        while True:
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(run_worker())
