from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.dependencies.auth import get_current_user
from app.models.entities import User
from app.schemas.auth import UserProfileUpdate, UserResponse
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_my_profile(user: User = Depends(get_current_user)):
    """Get current user's profile."""
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile information."""
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password, user.hashed_password or ""):
            raise HTTPException(status_code=400, detail="Current password verification failed")
        user.hashed_password = get_password_hash(data.new_password)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
