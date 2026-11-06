"""Users API — profile management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, UserPreferences

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UpdatePreferencesRequest(BaseModel):
    travel_interests: Optional[List[str]] = None
    preferred_pace: Optional[str] = None
    budget_range_min: Optional[float] = None
    budget_range_max: Optional[float] = None
    currency: Optional[str] = None
    food_preferences: Optional[List[str]] = None
    travel_style: Optional[str] = None
    language: Optional[str] = None


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "avatar_url": current_user.avatar_url,
        "is_verified": current_user.is_verified,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at.isoformat(),
    }


@router.patch("/me")
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in payload.dict(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    return {"message": "Profile updated"}


@router.get("/me/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {}
    return {
        "travel_interests": prefs.travel_interests or [],
        "preferred_pace": prefs.preferred_pace,
        "budget_range_min": prefs.budget_range_min,
        "budget_range_max": prefs.budget_range_max,
        "currency": prefs.currency,
        "food_preferences": prefs.food_preferences or [],
        "travel_style": prefs.travel_style,
        "language": prefs.language,
    }


@router.patch("/me/preferences")
async def update_preferences(
    payload: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    for field, value in payload.dict(exclude_none=True).items():
        setattr(prefs, field, value)

    await db.commit()
    return {"message": "Preferences updated"}
