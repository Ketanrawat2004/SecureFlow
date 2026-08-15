"""
SecureFlow - Analytics Aggregation Worker
Consumes domain events, aggregates metrics, and proactively invalidates or updates Redis analytics caches.
"""

import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import settings
from app.core.redis_client import redis_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ANALYTICS-WORKER] %(levelname)s: %(message)s")
logger = logging.getLogger("analytics_worker")


async def process_analytics_event(event_data: dict) -> None:
    """Proactively invalidate analytics cache on new domain event."""
    org_id = event_data.get("organization_id") or "org-acme-corp"
    cache_pattern = f"analytics:{org_id}:*"
    await redis_manager.invalidate_pattern(cache_pattern)
    logger.info("Invalidated analytics cache pattern '%s' for event %s", cache_pattern, event_data.get("event_id"))


async def run_worker() -> None:
    logger.info("Starting Analytics Worker...")
    await redis_manager.connect()
    if not settings.KAFKA_ENABLED:
        logger.info("Kafka is disabled. Analytics worker running in standby mode.")
        while True:
            await asyncio.sleep(60)
        return

    try:
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            "^secureflow\\.events\\..*",
            bootstrap_servers=settings.KAFKA_BROKERS,
            group_id="secureflow-analytics-worker-group",
            auto_offset_reset="earliest",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        await consumer.start()
        try:
            async for msg in consumer:
                await process_analytics_event(msg.value)
        finally:
            await consumer.stop()
    except Exception as e:
        logger.warning("Analytics worker standing by: %s", e)
        while True:
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(run_worker())
