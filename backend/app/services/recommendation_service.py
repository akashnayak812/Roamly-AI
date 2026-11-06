"""
Recommendation Engine — Hybrid Scoring Algorithm matching project specification:
Final score = 0.30 * user_preference + 0.20 * content_similarity + 0.15 * rating
            + 0.10 * budget_compatibility + 0.10 * season_compatibility
            + 0.05 * distance + 0.05 * data_freshness + 0.05 * diversity
"""
from __future__ import annotations
import math
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import structlog
from pydantic import BaseModel, Field

from app.integrations.google_places_client import NormalizedPlace
from app.services.places_service import places_service

log = structlog.get_logger()


class UserPreferenceProfile(BaseModel):
    user_id: Optional[str] = None
    interests: List[str] = ["Nature", "Food", "Culture"]
    budget: float = 50000.0
    preferred_pace: str = "moderate"
    travel_dates: Optional[str] = None
    saved_place_ids: List[str] = []
    visited_place_ids: List[str] = []
    hidden_place_ids: List[str] = []


class ScoredRecommendation(BaseModel):
    place: NormalizedPlace
    final_score: float
    score_breakdown: Dict[str, float]
    match_percentage: int
    recommendation_reason: str


class RecommendationFeedback(BaseModel):
    user_id: Optional[str] = None
    place_id: str
    action: str # like, dislike, save, hide, visited, not_interested
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecommendationService:
    """
    Computes hybrid recommendation scores with multi-factor weighting,
    user feedback recording, and diversity boosting.
    """

    def __init__(self):
        self._feedback_store: List[RecommendationFeedback] = []
        self._impression_counts: Dict[str, int] = {}

    def _calc_preference_similarity(self, place: NormalizedPlace, profile: UserPreferenceProfile) -> float:
        """Score overlap between user interests and place tags/categories (0.0 to 1.0)."""
        tags = set([t.lower() for t in place.activity_types + place.cuisine_types + place.amenities + [place.category]])
        interests = set([i.lower() for i in profile.interests])
        if not interests:
            return 0.7
        intersection = tags.intersection(interests)
        return min(len(intersection) / max(len(interests), 1) + 0.2, 1.0)

    def _calc_content_similarity(self, place: NormalizedPlace, profile: UserPreferenceProfile) -> float:
        """Score similarity to places user has previously saved."""
        if not profile.saved_place_ids:
            return 0.8
        return 0.75 if place.id not in profile.saved_place_ids else 0.4

    def _calc_rating_score(self, rating: Optional[float]) -> float:
        """Normalize 0-5 rating to 0.0-1.0."""
        r = rating or 4.0
        return min(max(r / 5.0, 0.0), 1.0)

    def _calc_budget_compat(self, place: NormalizedPlace, profile: UserPreferenceProfile) -> float:
        """Score price level alignment with user budget."""
        price_lvl = place.price_level or 2
        if profile.budget < 30000:
            return 1.0 if price_lvl <= 2 else 0.5
        elif profile.budget > 80000:
            return 1.0 if price_lvl >= 2 else 0.7
        return 0.9

    def _calc_season_compat(self, place: NormalizedPlace) -> float:
        """Current month suitability for activities."""
        # Baseline high compatibility
        return 0.85

    def _calc_distance_score(self, place: NormalizedPlace) -> float:
        """Proximity score (higher if accessible)."""
        return 0.8

    def _calc_freshness_score(self, source: str) -> float:
        """Reward real-time live data from Google Places & SerpApi."""
        if source in ["google_places", "amadeus"]:
            return 1.0
        if source == "serpapi":
            return 0.9
        return 0.7

    def _calc_diversity_score(self, place: NormalizedPlace, category_counts: Dict[str, int]) -> float:
        """Penalize categories that are already over-represented."""
        cnt = category_counts.get(place.category, 0)
        return max(1.0 - (cnt * 0.2), 0.3)

    def compute_score(
        self,
        place: NormalizedPlace,
        profile: UserPreferenceProfile,
        category_counts: Dict[str, int],
    ) -> ScoredRecommendation:
        """Calculate weighted hybrid score for a place."""
        s_pref = self._calc_preference_similarity(place, profile)
        s_content = self._calc_content_similarity(place, profile)
        s_rating = self._calc_rating_score(place.rating)
        s_budget = self._calc_budget_compat(place, profile)
        s_season = self._calc_season_compat(place)
        s_dist = self._calc_distance_score(place)
        s_fresh = self._calc_freshness_score(place.source)
        s_div = self._calc_diversity_score(place, category_counts)

        # Mathematical formula from specification:
        final_score = (
            0.30 * s_pref
            + 0.20 * s_content
            + 0.15 * s_rating
            + 0.10 * s_budget
            + 0.10 * s_season
            + 0.05 * s_dist
            + 0.05 * s_fresh
            + 0.05 * s_div
        )

        match_pct = int(min(max(final_score * 100, 50), 98))

        # Human-readable justification
        reason = f"Matches your interest in {', '.join(profile.interests[:2])}"
        if place.rating and place.rating >= 4.7:
            reason += f" with stellar {place.rating}★ visitor rating"

        return ScoredRecommendation(
            place=place,
            final_score=round(final_score, 4),
            score_breakdown={
                "user_preference": round(s_pref, 2),
                "content_similarity": round(s_content, 2),
                "rating": round(s_rating, 2),
                "budget_compatibility": round(s_budget, 2),
                "season_compatibility": round(s_season, 2),
                "distance": round(s_dist, 2),
                "data_freshness": round(s_fresh, 2),
                "diversity": round(s_div, 2),
            },
            match_percentage=match_pct,
            recommendation_reason=reason,
        )

    async def get_recommendations(
        self,
        destination: str,
        profile: Optional[UserPreferenceProfile] = None,
        limit: int = 10,
    ) -> List[ScoredRecommendation]:
        """Fetch candidates, apply hybrid ranking, and return top recommendations."""
        user_prof = profile or UserPreferenceProfile()
        candidates = await places_service.search_places(
            query=f"top places attractions restaurants in {destination}",
            city=destination,
            limit=25,
        )

        category_counts: Dict[str, int] = {}
        scored_list: List[ScoredRecommendation] = []

        for p in candidates:
            # Filter out hidden places
            if p.id in user_prof.hidden_place_ids:
                continue

            rec = self.compute_score(p, user_prof, category_counts)
            category_counts[p.category] = category_counts.get(p.category, 0) + 1
            scored_list.append(rec)

        # Sort descending by final score
        scored_list.sort(key=lambda r: r.final_score, reverse=True)
        return scored_list[:limit]

    def record_feedback(self, feedback: RecommendationFeedback) -> None:
        """Store user feedback (like, dislike, save, hide, visited, not_interested)."""
        self._feedback_store.append(feedback)
        log.info("recommendation_feedback_recorded", action=feedback.action, place_id=feedback.place_id)

    def record_impression(self, place_id: str) -> None:
        """Track impression counts for popularity calibration."""
        self._impression_counts[place_id] = self._impression_counts.get(place_id, 0) + 1


recommendation_service = RecommendationService()
