from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.auth import router as auth_router
from app.api.v1.members import router as members_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.roles import router as roles_router
from app.api.v1.users import router as users_router
from app.api.v1.workflows import router as workflows_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(projects_router)
api_v1_router.include_router(workflows_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(members_router)
api_v1_router.include_router(roles_router)
api_v1_router.include_router(audit_logs_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(realtime_router)
