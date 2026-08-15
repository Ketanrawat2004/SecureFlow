import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import Base, async_session_maker, engine
from app.core.redis_client import redis_manager
from app.events.kafka_client import DomainEvent, event_bus
from app.events.realtime_hub import realtime_hub
from app.middleware.rate_limiter import RateLimitMiddleware
from app.models.entities import Membership, Notification, Role, User
from app.schemas.common import HealthResponse
from app.services.seed_service import seed_database

# Configure Logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("secureflow")


# Domain Event Handlers (Worker callbacks)
async def handle_notification_events(event: DomainEvent):
    """Notification Worker: Persists notifications and dispatches real-time user alerts."""
    logger.info("NotificationWorker: Processing event %s (%s) for aggregate %s", event.event_id, event.event_type, event.aggregate_id)
    org_id = event.organization_id
    if not org_id:
        return

    try:
        async with async_session_maker() as session:
            target_user_ids = []
            title = ""
            message = ""
            notification_type = "workflow"

            if event.event_type == "WorkflowCreated":
                title = "Workflow Submitted"
                message = f"New workflow '{event.payload.get('name')}' created by {event.payload.get('creator_name')} requires review."
                # Find Admins and Owners in this organization to notify
                stmt = (
                    select(Membership)
                    .where(Membership.organization_id == org_id, Membership.status == "active")
                    .options(selectinload(Membership.role))
                )
                members = (await session.execute(stmt)).scalars().all()
                for m in members:
                    if m.role and m.role.name in ["Owner", "Admin"]:
                        target_user_ids.append(m.user_id)

            elif event.event_type in ["WorkflowApproved", "WorkflowRejected", "WorkflowChangesRequested"]:
                decision_verbs = {
                    "WorkflowApproved": "approved",
                    "WorkflowRejected": "rejected",
                    "WorkflowChangesRequested": "changes requested",
                }
                verb = decision_verbs.get(event.event_type, "decided")
                title = f"Workflow {verb.capitalize()}"
                message = f"Workflow '{event.payload.get('workflow_name')}' was {verb} by {event.payload.get('decided_by_name')}."
                creator_id = event.payload.get("creator_id")
                if creator_id:
                    target_user_ids.append(creator_id)

            elif event.event_type == "MemberInvited":
                title = "Workspace Member Invited"
                message = f"{event.payload.get('email')} was invited with role {event.payload.get('role_name')}."
                notification_type = "system"
                invited_user_id = event.payload.get("user_id")
                if invited_user_id:
                    target_user_ids.append(invited_user_id)

            for uid in set(target_user_ids):
                notif = Notification(
                    id=str(uuid.uuid4()),
                    user_id=uid,
                    organization_id=org_id,
                    type=notification_type,
                    title=title,
                    message=message,
                    resource_id=event.aggregate_id,
                    is_read=False,
                )
                session.add(notif)

            await session.commit()

            # Broadcast real-time NotificationCreated event
            for uid in set(target_user_ids):
                await realtime_hub.broadcast_domain_event(
                    DomainEvent(
                        event_type="NotificationCreated",
                        aggregate_id=event.aggregate_id,
                        organization_id=org_id,
                        payload={"recipient_user_id": uid, "title": title, "message": message},
                    )
                )
    except Exception as e:
        logger.error("Error generating notifications for event %s: %s", event.event_id, e)


async def handle_audit_events(event: DomainEvent):
    """Audit Worker logic for real-time event distribution and logging."""
    logger.debug("AuditWorker: Ingesting audit domain event %s (%s)", event.event_id, event.event_type)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and graceful shutdown lifecycle."""
    logger.info("Starting %s in %s mode...", settings.APP_NAME, settings.ENVIRONMENT)

    # 1. Initialize Database Schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Seed Initial Database Data if configured
    if settings.AUTO_SEED_DATABASE:
        async with async_session_maker() as session:
            try:
                await seed_database(session)
            except Exception as e:
                logger.error("Error during initial seeding: %s", e)

    # 3. Connect to Redis
    await redis_manager.connect()

    # 4. Register Event Bus Handlers & Start Kafka Client
    event_bus.register_handler("WorkflowCreated", handle_notification_events)
    event_bus.register_handler("WorkflowApproved", handle_notification_events)
    event_bus.register_handler("WorkflowRejected", handle_notification_events)
    event_bus.register_handler("WorkflowChangesRequested", handle_notification_events)
    event_bus.register_handler("MemberInvited", handle_notification_events)
    event_bus.register_handler("*", handle_audit_events)
    event_bus.register_handler("*", realtime_hub.broadcast_domain_event)
    await event_bus.start()

    logger.info("%s backend successfully initialized.", settings.APP_NAME)

    yield

    logger.info("Shutting down %s backend...", settings.APP_NAME)
    await event_bus.stop()
    await redis_manager.disconnect()
    await engine.dispose()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="SecureFlow API",
    description="Enterprise Access Management and Secure Workflow Governance API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable Swagger/ReDoc in production for reduced attack surface
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

# Build effective CORS origins — merge CORS_ORIGINS list with optional FRONTEND_URL
_effective_cors_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in _effective_cors_origins:
    _effective_cors_origins.append(settings.FRONTEND_URL)
    logger.info("CORS: Added FRONTEND_URL %s to allowed origins", settings.FRONTEND_URL)

logger.info("CORS allowed origins: %s", _effective_cors_origins)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_effective_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# Mount API Routers
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check probe for container orchestrators and load balancers."""
    db_status = "healthy"
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    redis_status = "connected" if redis_manager._is_connected else "in-memory-fallback"
    kafka_status = "connected" if event_bus._is_connected else "in-memory-fallback"

    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        version="1.0.0",
        environment=settings.ENVIRONMENT,
        database=db_status,
        redis=redis_status,
        kafka=kafka_status,
    )


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness probe."""
    return {"status": "ready"}
