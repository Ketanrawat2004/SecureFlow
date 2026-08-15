import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.config import settings

logger = logging.getLogger(__name__)


class DomainEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    occurred_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    aggregate_id: str
    organization_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    version: int = 1


# Type alias for event listeners/worker handlers
EventHandler = Callable[[DomainEvent], Any]


class KafkaEventBus:
    """
    Domain event bus that connects to Kafka when available,
    and falls back to resilient asynchronous in-process queue for local/test workflows.
    """
    def __init__(self) -> None:
        self.producer = None
        self.consumer = None
        self._is_connected = False
        self._handlers: Dict[str, List[EventHandler]] = {}
        self._memory_queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._processed_event_ids: set = set()

    def register_handler(self, event_type: str, handler: EventHandler) -> None:
        """Register a worker/listener callback for a domain event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def start(self) -> None:
        """Initialize connection to Kafka or start in-memory background worker."""
        if settings.KAFKA_ENABLED:
            try:
                from aiokafka import AIOKafkaProducer
                self.producer = AIOKafkaProducer(
                    bootstrap_servers=settings.KAFKA_BROKERS,
                    client_id=settings.KAFKA_CLIENT_ID,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    request_timeout_ms=3000,
                )
                await self.producer.start()
                self._is_connected = True
                logger.info("Connected to Kafka broker at %s", settings.KAFKA_BROKERS)
            except Exception as e:
                self._is_connected = False
                logger.warning("Kafka broker connection failed (%s). Falling back to local in-memory event bus.", e)

        # Start asynchronous worker for in-memory queue
        self._worker_task = asyncio.create_task(self._process_memory_queue())

    async def stop(self) -> None:
        """Clean up Kafka producer and background workers."""
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

        if self.producer and self._is_connected:
            try:
                await self.producer.stop()
            except Exception as e:
                logger.warning("Error stopping Kafka producer: %s", e)

    async def publish(self, event: DomainEvent) -> None:
        """Publish a domain event to Kafka and local event handlers."""
        event_dict = event.model_dump()
        
        # If Kafka is connected, send to Kafka topic
        if self._is_connected and self.producer:
            try:
                topic = f"secureflow.events.{event.event_type.lower()}"
                await self.producer.send_and_wait(
                    topic,
                    value=event_dict,
                    key=event.aggregate_id.encode("utf-8")
                )
                logger.info("Published event %s to Kafka topic %s", event.event_id, topic)
            except Exception as e:
                logger.warning("Failed to publish event to Kafka (%s). Queuing locally.", e)
                await self._memory_queue.put(event)
                return

        # Local fallback queue
        await self._memory_queue.put(event)

    async def _process_memory_queue(self) -> None:
        """Process dispatched domain events idempotently through registered workers."""
        while True:
            try:
                event: DomainEvent = await self._memory_queue.get()
                
                # Idempotency check
                if event.event_id in self._processed_event_ids:
                    self._memory_queue.task_done()
                    continue

                self._processed_event_ids.add(event.event_id)
                # Keep cache bounded
                if len(self._processed_event_ids) > 10000:
                    self._processed_event_ids.pop()

                # Dispatch to wildcard handlers and specific event handlers
                handlers = self._handlers.get(event.event_type, []) + self._handlers.get("*", [])
                for handler in handlers:
                    try:
                        if asyncio.iscoroutinefunction(handler):
                            await handler(event)
                        else:
                            handler(event)
                    except Exception as handler_err:
                        logger.error("Error in event handler %s for event %s: %s", handler, event.event_id, handler_err)

                self._memory_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error processing domain event from queue: %s", e)
                await asyncio.sleep(0.5)


event_bus = KafkaEventBus()
