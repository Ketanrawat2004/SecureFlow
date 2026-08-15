from typing import Annotated, Callable, List, Optional
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.rbac import SYSTEM_ROLES_PERMISSIONS
from app.core.database import get_db
from app.core.security import decode_token
from app.models.entities import Membership, Organization, Role, User

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the currently authenticated user from Bearer JWT."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_active_membership(
    user: User = Depends(get_current_user),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
) -> Membership:
    """Retrieve active organization membership and role for the current request."""
    # Find all active memberships for this user
    stmt = (
        select(Membership)
        .where(Membership.user_id == user.id, Membership.status == "active")
        .options(
            selectinload(Membership.organization),
            selectinload(Membership.role).selectinload(Role.role_permissions),
        )
    )
    result = await db.execute(stmt)
    memberships = result.scalars().all()

    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any active organization",
        )

    # If specific org requested via header, match it
    if x_organization_id:
        for m in memberships:
            if m.organization_id == x_organization_id:
                return m
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User is not an active member of organization {x_organization_id}",
        )

    # Otherwise return the first active organization membership
    return memberships[0]


def require_permission(permission_code: str) -> Callable:
    """
    FastAPI dependency factory to enforce RBAC permissions.
    Validates that the user's role in the active organization holds the given permission.
    """
    async def permission_checker(
        membership: Membership = Depends(get_active_membership),
    ) -> Membership:
        role_name = membership.role.name
        
        # Check system default permissions or custom role permissions
        allowed_permissions = SYSTEM_ROLES_PERMISSIONS.get(role_name, set())
        
        if permission_code not in allowed_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Requires '{permission_code}'. Current role '{role_name}' has insufficient privileges.",
            )
        return membership

    return permission_checker
