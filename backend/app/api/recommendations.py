"""Recommendations API — 8-factor hybrid scoring algorithm and feedback tracking."""
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import structlog

from app.db.database import get_db
from app.core.deps import get_optional_user
from app.models.models import User, Destination, UserPreferences
from app.services.recommendation_service import (
    recommendation_service,
    UserPreferenceProfile,
    ScoredRecommendation,
    RecommendationFeedback,
)

router = APIRouter()
log = structlog.get_logger()


class FeedbackRequest(BaseModel):
    place_id: str
    action: str  # like, dislike, save, hide, visited, not_interested


class ImpressionRequest(BaseModel):
    place_id: str


@router.get("", response_model=List[ScoredRecommendation])
async def get_recommendations(
    destination: str = Query("Goa", description="Target destination city or region"),
    interests: Optional[str] = Query(None, description="Comma-separated interests (e.g. Nature,Culture,Food)"),
    budget: Optional[float] = Query(50000.0, description="Budget in local currency"),
    limit: int = Query(6, ge=1, le=20, description="Number of recommendations"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Get personalized recommendations scored by the 8-factor hybrid formula:
    Final score = 0.30*user_pref + 0.20*content_sim + 0.15*rating + 0.10*budget
                + 0.10*season + 0.05*dist + 0.05*freshness + 0.05*diversity
    """
    profile = UserPreferenceProfile(
        user_id=str(current_user.id) if current_user else None,
        budget=budget or 50000.0,
    )
\
    if interests:
        profile.interests = [i.strip() for i in interests.split(",") if i.strip()]
    elif current_user:
        # Load user interests from preferences if available
        try:
            prefs_res = await db.execute(
                select(UserPreferences).where(UserPreferences.user_id == current_user.id)
            )
            prefs = prefs_res.scalar_one_or_none()
            if prefs and prefs.travel_interests:
                profile.interests = prefs.travel_interests
        except Exception:
            pass

    try:
        recommendations = await recommendation_service.get_recommendations(
            destination=destination,
            profile=profile,
            limit=limit,
        )
        return recommendations
    except Exception as exc:
        log.error("recommendations_fetch_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to compute recommendations")


@router.post("/feedback")
async def record_recommendation_feedback(
    body: FeedbackRequest,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Record user feedback action (like, dislike, save, hide, visited)."""
    feedback = RecommendationFeedback(
        user_id=str(current_user.id) if current_user else None,
        place_id=body.place_id,
        action=body.action,
    )
    recommendation_service.record_feedback(feedback)
    return {"status": "success", "action": body.action, "place_id": body.place_id}


@router.post("/impression")
async def record_recommendation_impression(
    body: ImpressionRequest,
):
    """Record recommendation card impression for popularity and diversity tuning."""
    recommendation_service.record_impression(body.place_id)
    return {"status": "success", "place_id": body.place_id}
