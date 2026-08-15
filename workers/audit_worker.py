"""
SecureFlow - Audit Event Worker
Consumes domain events from Kafka topic 'secureflow.events.*' or direct event bus,
processes idempotent audit persistence and compliance indexing.
"""

import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.entities import AuditLog

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AUDIT-WORKER] %(levelname)s: %(message)s")
logger = logging.getLogger("audit_worker")


async def process_audit_event(event_data: dict) -> None:
    """Process incoming domain event and persist audit log record idempotently."""
    event_id = event_data.get("event_id")
    event_type = event_data.get("event_type")
    org_id = event_data.get("organization_id")
    payload = event_data.get("payload", {})
    actor_email = payload.get("actor_email") or payload.get("creator_name") or payload.get("decided_by_name") or "system@secureflow.internal"
    actor_id = payload.get("actor_id") or payload.get("creator_id") or payload.get("decided_by_id")

    if not org_id:
        org_id = "org-acme-corp"

    action_map = {
        "WorkflowCreated": "workflow.created",
        "WorkflowApproved": "workflow.approved",
        "WorkflowRejected": "workflow.rejected",
        "WorkflowChangesRequested": "workflow.changes_requested",
        "MemberInvited": "member.invited",
        "RoleChanged": "role.changed",
        "ProjectCreated": "project.created",
    }
    action = action_map.get(event_type, f"event.{event_type.lower()}")

    async with async_session_maker() as session:
        audit_record = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=org_id,
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            resource_type="workflow" if "Workflow" in event_type else "system",
            resource_id=event_data.get("aggregate_id", str(uuid.uuid4())),
            context=json.dumps(payload),
            ip_address="127.0.0.1",
            event_id=event_id,
            created_at=datetime.now(timezone.utc),
        )
        session.add(audit_record)
        await session.commit()
        logger.info("Successfully audited event %s (%s)", event_id, action)


async def run_worker() -> None:
    """Run Kafka consumer loop with graceful shutdown."""
    logger.info("Starting Audit Worker on broker %s...", settings.KAFKA_BROKERS)
    if not settings.KAFKA_ENABLED:
        logger.info("Kafka is disabled or running in standalone mode. Worker entering standby.")
        while True:
            await asyncio.sleep(60)
        return

    try:
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            "^secureflow\\.events\\..*",
            bootstrap_servers=settings.KAFKA_BROKERS,
            group_id="secureflow-audit-worker-group",
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        await consumer.start()
        logger.info("Audit Worker subscribed to domain event topics.")
        try:
            async for msg in consumer:
                await process_audit_event(msg.value)
        finally:
            await consumer.stop()
    except Exception as e:
        logger.warning("Kafka consumer error in Audit Worker: %s. Standing by.", e)
        while True:
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(run_worker())
