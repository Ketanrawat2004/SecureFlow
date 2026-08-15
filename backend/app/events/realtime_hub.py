import asyncio
import json
import logging
from typing import Dict, Optional, Set
from app.events.kafka_client import DomainEvent

logger = logging.getLogger("secureflow.realtime")


class Subscriber:
    def __init__(self, user_id: str, org_id: str, role_name: str, permissions: Set[str]):
        self.user_id = user_id
        self.org_id = org_id
        self.role_name = role_name
        self.permissions = permissions
        self.queue: asyncio.Queue = asyncio.Queue()


class RealtimeHub:
    """Central real-time event dispatcher for active Server-Sent Events (SSE) connections."""
    def __init__(self):
        self._subscribers: Dict[str, Set[Subscriber]] = {}
        self._lock = asyncio.Lock()

    async def add_subscriber(self, subscriber: Subscriber) -> None:
        async with self._lock:
            if subscriber.org_id not in self._subscribers:
                self._subscribers[subscriber.org_id] = set()
            self._subscribers[subscriber.org_id].add(subscriber)
            logger.info(
                "Realtime subscriber connected: user=%s, role=%s, org=%s (active in org: %d)",
                subscriber.user_id,
                subscriber.role_name,
                subscriber.org_id,
                len(self._subscribers[subscriber.org_id]),
            )

    async def remove_subscriber(self, subscriber: Subscriber) -> None:
        async with self._lock:
            if subscriber.org_id in self._subscribers:
                self._subscribers[subscriber.org_id].discard(subscriber)
                if not self._subscribers[subscriber.org_id]:
                    del self._subscribers[subscriber.org_id]
            logger.info("Realtime subscriber disconnected: user=%s", subscriber.user_id)

    async def broadcast_domain_event(self, event: DomainEvent) -> None:
        """Broadcast a domain event to active SSE subscribers with strict server-side RBAC filtering."""
        org_id = event.organization_id
        if not org_id or org_id not in self._subscribers:
            return

        event_payload = {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "occurred_at": event.occurred_at,
            "aggregate_id": event.aggregate_id,
            "organization_id": org_id,
            "payload": event.payload,
        }

        # Server-side event authorization filtering
        for subscriber in list(self._subscribers.get(org_id, [])):
            # Notification events are strictly dispatched to target recipient
            if event.event_type == "NotificationCreated":
                recipient_id = event.payload.get("recipient_user_id") or event.payload.get("user_id")
                if recipient_id and recipient_id != subscriber.user_id:
                    continue

            # Audit events require audit.read permission
            if event.event_type == "AuditEventCreated":
                if "audit.read" not in subscriber.permissions:
                    continue

            # Workflow events require workflow.read permission
            if event.event_type.startswith("Workflow") and "workflow.read" not in subscriber.permissions:
                continue

            # Project events require project.read permission
            if event.event_type.startswith("Project") and "project.read" not in subscriber.permissions:
                continue

            try:
                subscriber.queue.put_nowait(event_payload)
            except Exception as e:
                logger.warning("Failed to queue event for subscriber %s: %s", subscriber.user_id, e)


realtime_hub = RealtimeHub()
