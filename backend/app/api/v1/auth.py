from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.dependencies.auth import get_active_membership
from app.models.entities import Membership, User
from app.schemas.auth import (
    AuthContextResponse,
    DevLoginRequest,
    GoogleCallbackRequest,
    LoginRequest,
    OAuthUrlResponse,
    RegisterRequest,
    Token,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password."""
    user, access_token, refresh_token = await auth_service.authenticate_user(db, login_data)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", response_model=Token)
async def register(register_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register new user, create personal workspace and issue access tokens."""
    user, access_token, refresh_token = await auth_service.register_user(db, register_data)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/dev-login", response_model=Token)
async def dev_login(req: DevLoginRequest, db: AsyncSession = Depends(get_db)):
    """Safe local development login: quick switch to test permissions across roles."""
    user, access_token, refresh_token = await auth_service.dev_login(db, req.role, req.email)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=AuthContextResponse)
async def get_current_user_context(
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
):
    """Fetch current user details, active workspace, active role, and calculated permissions."""
    return await auth_service.get_auth_context(db, membership.user, membership.organization_id)


@router.post("/refresh", response_model=Token)
async def refresh_token_endpoint(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Rotate access token using valid refresh token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or removed")

    new_access_token = create_access_token(user.id, {"email": user.email})
    new_refresh_token = create_refresh_token(user.id)
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/google/url", response_model=OAuthUrlResponse)
async def get_google_oauth_url():
    """Generate Google OAuth 2.0 / OpenID Connect authorization URL."""
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        "response_type=code&"
        "scope=openid%20email%20profile&"
        f"redirect_uri={settings.OAUTH_REDIRECT_URI}&"
        "access_type=offline&"
        "state=secureflow-oauth-state"
    )
    return OAuthUrlResponse(url=auth_url, client_id=settings.GOOGLE_CLIENT_ID)


@router.post("/google/callback", response_model=Token)
async def google_oauth_callback(req: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Exchange authorization code for token, verify OIDC userinfo, and log in."""
    user, access_token, refresh_token = await auth_service.handle_google_sso(db, req.code, req.state)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
