import logging
import uuid
from typing import Optional, Tuple
import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.rbac import SYSTEM_ROLES_PERMISSIONS
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash, verify_password
from app.models.entities import Membership, Organization, Role, User
from app.schemas.auth import AuthContextResponse, LoginRequest, RegisterRequest, Token, UserResponse

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: LoginRequest) -> Tuple[User, str, str]:
        """Authenticate user with email and password, return user and tokens."""
        stmt = (
            select(User)
            .where(User.email == login_data.email)
            .options(
                selectinload(User.memberships).selectinload(Membership.organization),
                selectinload(User.memberships).selectinload(Membership.role),
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact organization administrator.",
            )

        access_token = create_access_token(user.id, {"email": user.email})
        refresh_token = create_refresh_token(user.id)
        return user, access_token, refresh_token

    @staticmethod
    async def dev_login(db: AsyncSession, target_role: str = "Owner", email: Optional[str] = None) -> Tuple[User, str, str]:
        """Safe local development login: quick switch to test permissions across roles."""
        if email:
            stmt = select(User).where(User.email == email)
        else:
            # Find a user with the requested role
            stmt = (
                select(User)
                .join(Membership, Membership.user_id == User.id)
                .join(Role, Role.id == Membership.role_id)
                .where(Role.name == target_role)
                .limit(1)
            )

        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            # Fallback to any active user
            user = (await db.execute(select(User).limit(1))).scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=404, detail="No users found in database")

        access_token = create_access_token(user.id, {"email": user.email})
        refresh_token = create_refresh_token(user.id)
        return user, access_token, refresh_token

    @staticmethod
    async def register_user(db: AsyncSession, register_data: RegisterRequest) -> Tuple[User, str, str]:
        """Register a new user, create their personal organization, and grant Owner role."""
        # Check if email is already registered
        existing = await db.execute(select(User).where(User.email == register_data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        # Create user
        user = User(
            id=str(uuid.uuid4()),
            email=register_data.email,
            full_name=register_data.full_name,
            hashed_password=get_password_hash(register_data.password),
            is_active=True,
            is_verified=True,
            is_sso=False,
        )
        db.add(user)
        await db.flush()

        # Create Organization
        org_name = register_data.organization_name or f"{register_data.full_name}'s Team"
        slug = f"{org_name.lower().replace(' ', '-')[:40]}-{uuid.uuid4().hex[:6]}"
        org = Organization(
            id=str(uuid.uuid4()),
            name=org_name,
            slug=slug,
            description="Default workspace",
        )
        db.add(org)
        await db.flush()

        # Find Owner role
        owner_role = (await db.execute(select(Role).where(Role.name == "Owner"))).scalar_one_or_none()
        if not owner_role:
            raise HTTPException(status_code=500, detail="Default Owner role not configured")

        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=user.id,
            organization_id=org.id,
            role_id=owner_role.id,
            status="active",
        )
        db.add(membership)
        await db.commit()
        await db.refresh(user)

        access_token = create_access_token(user.id, {"email": user.email})
        refresh_token = create_refresh_token(user.id)
        return user, access_token, refresh_token

    @staticmethod
    async def handle_google_sso(db: AsyncSession, code: str, state: Optional[str] = None) -> Tuple[User, str, str]:
        """Exchange Google authorization code for token, verify OIDC profile, and link or create user."""
        email: Optional[str] = None
        full_name: Optional[str] = None
        avatar_url: Optional[str] = None

        # Check if live Google credentials are provided
        is_live_google = (
            settings.GOOGLE_CLIENT_ID
            and not settings.GOOGLE_CLIENT_ID.startswith("mock-")
            and settings.GOOGLE_CLIENT_SECRET
            and not settings.GOOGLE_CLIENT_SECRET.startswith("mock-")
        )

        if is_live_google:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # 1. Exchange code for Google tokens
                    token_resp = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "code": code,
                            "client_id": settings.GOOGLE_CLIENT_ID,
                            "client_secret": settings.GOOGLE_CLIENT_SECRET,
                            "redirect_uri": settings.OAUTH_REDIRECT_URI,
                            "grant_type": "authorization_code",
                        },
                    )
                    if token_resp.status_code != 200:
                        logger.error("Google token exchange failed: %s", token_resp.text)
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Failed to authenticate with Google OAuth server",
                        )
                    tokens = token_resp.json()
                    google_access_token = tokens.get("access_token")

                    # 2. Fetch OIDC user profile
                    userinfo_resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {google_access_token}"},
                    )
                    if userinfo_resp.status_code != 200:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Failed to retrieve Google user profile",
                        )
                    user_info = userinfo_resp.json()
                    email = user_info.get("email")
                    full_name = user_info.get("name") or email.split("@")[0]
                    avatar_url = user_info.get("picture")
            except httpx.RequestError as e:
                logger.error("Network error during Google OAuth: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Google OAuth identity provider unreachable",
                )
        else:
            # Development simulation mode for environments without live Google credentials
            logger.info("Google SSO running in development sandbox mode (mock code: %s)", code[:8] if code else "empty")
            email = "sarah.chen@acmecloud.io"
            full_name = "Sarah Chen"
            avatar_url = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"

        if not email:
            raise HTTPException(status_code=400, detail="Google authentication failed to supply email")

        # Look up existing user
        stmt = (
            select(User)
            .where(User.email == email)
            .options(
                selectinload(User.memberships).selectinload(Membership.organization),
                selectinload(User.memberships).selectinload(Membership.role),
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            # Provision new SSO user
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                full_name=full_name or "Google User",
                avatar_url=avatar_url,
                is_active=True,
                is_verified=True,
                is_sso=True,
            )
            db.add(user)
            await db.flush()

            # Find default organization or create personal
            org = (await db.execute(select(Organization).limit(1))).scalar_one_or_none()
            if not org:
                org = Organization(
                    id="org-acme-corp",
                    name="Acme Cloud Infrastructure",
                    slug="acme-cloud",
                    description="Default workspace",
                )
                db.add(org)
                await db.flush()

            # Assign Developer role by default for new SSO signups
            dev_role = (await db.execute(select(Role).where(Role.name == "Developer"))).scalar_one_or_none()
            if not dev_role:
                dev_role = (await db.execute(select(Role).limit(1))).scalar_one_or_none()

            membership = Membership(
                id=str(uuid.uuid4()),
                user_id=user.id,
                organization_id=org.id,
                role_id=dev_role.id,
                status="active",
            )
            db.add(membership)
            await db.commit()
            await db.refresh(user)
        else:
            if not user.is_active:
                raise HTTPException(status_code=403, detail="Account is deactivated")
            # Update avatar and mark as SSO
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            user.is_sso = True
            await db.commit()

        access_token = create_access_token(user.id, {"email": user.email})
        refresh_token = create_refresh_token(user.id)
        return user, access_token, refresh_token

    @staticmethod
    async def get_auth_context(db: AsyncSession, user: User, org_id: Optional[str] = None) -> AuthContextResponse:
        """Get the full user context including active organization, role, and permissions."""
        stmt = (
            select(Membership)
            .where(Membership.user_id == user.id, Membership.status == "active")
            .options(
                selectinload(Membership.organization),
                selectinload(Membership.role),
            )
        )
        result = await db.execute(stmt)
        memberships = result.scalars().all()

        active_membership = None
        if org_id:
            for m in memberships:
                if m.organization_id == org_id:
                    active_membership = m
                    break
        if not active_membership and memberships:
            active_membership = memberships[0]

        role_name = active_membership.role.name if active_membership else None
        active_org_id = active_membership.organization_id if active_membership else None
        
        # Calculate permissions
        permissions = list(SYSTEM_ROLES_PERMISSIONS.get(role_name, set())) if role_name else []

        return AuthContextResponse(
            user=UserResponse.model_validate(user),
            active_organization_id=active_org_id,
            active_role=role_name,
            permissions=permissions,
        )


auth_service = AuthService()
