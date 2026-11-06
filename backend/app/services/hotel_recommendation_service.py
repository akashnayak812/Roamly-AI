"""
Roamly AI — Hotel Recommendation Service
Implements a pluggable interface for hotel ranking and personalized recommendation scoring.
Includes a transparent baseline heuristic model:
Final Score = 0.25 × destination + 0.20 × rating + 0.15 × review_confidence + 0.15 × budget + 0.15 × amenity + 0.10 × user_preference
Designed for seamless future upgrade to collaborative filtering, Matrix Factorization (SVD), XGBoost, or Neural Ranking models.
"""
from __future__ import annotations
import abc
import math
from typing import Dict, List, Optional, Any, Set, Tuple
from pydantic import BaseModel, Field
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.models.models import Hotel

log = structlog.get_logger()


class HotelRecommendationInput(BaseModel):
    destination: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    budget: Optional[float] = None
    travel_dates: Optional[Tuple[str, str]] = None
    travelers: int = 1
    preferred_amenities: List[str] = Field(default_factory=list)
    min_rating: Optional[float] = None
    travel_style: Optional[str] = None  # luxury, budget, relaxed, fast, family, romantic
    saved_hotels: List[str] = Field(default_factory=list)
    previously_viewed: List[str] = Field(default_factory=list)
    previous_feedback: Optional[Dict[str, Any]] = None
    preference_type: Optional[str] = None  # family, romantic, luxury, budget


class HotelScoreBreakdown(BaseModel):
    hotel_id: str
    final_score: float
    match_percentage: int
    destination_score: float
    rating_score: float
    review_confidence: float
    budget_compatibility: float
    amenity_score: float
    user_preference_score: float
    reasons: List[str] = Field(default_factory=list)


class BaseHotelRecommendationEngine(abc.ABC):
    """Abstract interface for hotel recommendation engines."""

    @abc.abstractmethod
    def score_hotel(
        self,
        hotel: Hotel | Dict[str, Any],
        inputs: HotelRecommendationInput,
        max_review_count: int = 10000,
    ) -> HotelScoreBreakdown:
        pass

    @abc.abstractmethod
    def rank_hotels(
        self,
        hotels: List[Hotel | Dict[str, Any]],
        inputs: HotelRecommendationInput,
        max_review_count: int = 10000,
    ) -> List[Tuple[Any, HotelScoreBreakdown]]:
        pass


class BaselineHotelRecommendationEngine(BaseHotelRecommendationEngine):
    """
    Transparent, interpretable baseline scoring model:
    Final Score =
      0.25 × destination match
      + 0.20 × rating score
      + 0.15 × review confidence
      + 0.15 × budget compatibility
      + 0.15 × amenity match
      + 0.10 × user preference match
    """

    def score_hotel(
        self,
        hotel: Hotel | Dict[str, Any],
        inputs: HotelRecommendationInput,
        max_review_count: int = 10000,
    ) -> HotelScoreBreakdown:
        h_id = hotel.id if isinstance(hotel, Hotel) else hotel.get("id", "")
        h_name = hotel.name if isinstance(hotel, Hotel) else hotel.get("name", "")
        h_city = (hotel.city if isinstance(hotel, Hotel) else hotel.get("city") or "")
        h_country = (hotel.country if isinstance(hotel, Hotel) else hotel.get("country") or "")
        h_rating = (hotel.avg_guest_rating if isinstance(hotel, Hotel) else hotel.get("avg_guest_rating")) or 0.0
        h_reviews = (hotel.review_count if isinstance(hotel, Hotel) else hotel.get("review_count")) or 0
        h_min_price = hotel.price_per_night_min if isinstance(hotel, Hotel) else hotel.get("price_per_night_min")
        h_amenities = (hotel.amenities if isinstance(hotel, Hotel) else hotel.get("amenities")) or []
        h_pool = bool(hotel.has_pool if isinstance(hotel, Hotel) else hotel.get("has_pool", False))
        h_spa = bool(hotel.has_spa if isinstance(hotel, Hotel) else hotel.get("has_spa", False))
        h_family = hotel.is_family_friendly if isinstance(hotel, Hotel) else hotel.get("is_family_friendly")
        h_pet = hotel.is_pet_friendly if isinstance(hotel, Hotel) else hotel.get("is_pet_friendly")

        reasons: List[str] = []

        # 1. Destination Match (weight 0.25)
        dest_target = (inputs.city or inputs.destination or "").lower().strip()
        country_target = (inputs.country or "").lower().strip()

        if dest_target and (dest_target in h_city.lower() or h_city.lower() in dest_target):
            dest_score = 1.0
            reasons.append(f"Located in the requested city ({h_city})")
        elif country_target and (country_target in h_country.lower() or h_country.lower() in country_target):
            dest_score = 0.6
            reasons.append(f"Located in requested country ({h_country})")
        elif not dest_target and not country_target:
            dest_score = 0.8
        else:
            dest_score = 0.2

        # 2. Rating Score (weight 0.20): rating / 5.0
        rating_score = min(max(h_rating / 5.0, 0.0), 1.0)
        if h_rating >= 4.5:
            reasons.append(f"Highly rated by travelers ({h_rating:.1f}/5)")
        elif h_rating >= 4.0:
            reasons.append(f"Solid positive reviews ({h_rating:.1f}/5)")

        # 3. Review Confidence (weight 0.15): log(1 + review_count) / log(1 + max_review_count)
        norm_max = max(max_review_count, 100)
        review_conf = math.log(1 + max(h_reviews, 0)) / math.log(1 + norm_max)
        review_conf = min(max(review_conf, 0.0), 1.0)
        if h_reviews > 1000:
            reasons.append(f"Trusted choice with high review confidence ({h_reviews:,} reviews)")

        # 4. Budget Compatibility (weight 0.15)
        if h_min_price is not None:
            if inputs.budget and inputs.budget > 0:
                if h_min_price <= inputs.budget:
                    # Within budget: bonus if close to sweet spot, full score if within limit
                    budget_score = 1.0 - min(0.3, max(0.0, (inputs.budget - h_min_price) / inputs.budget * 0.2))
                    reasons.append("Within your specified nightly budget")
                else:
                    # Over budget: linearly decayed
                    overage_ratio = (h_min_price - inputs.budget) / inputs.budget
                    budget_score = max(0.0, 1.0 - overage_ratio)
            else:
                budget_score = 0.85
        else:
            # Catalog price unavailable: neutral fallback without penalizing or inventing numbers
            budget_score = 0.55
            reasons.append("Price unavailable in static catalog; live check recommended")

        # 5. Amenity Match (weight 0.15)
        if inputs.preferred_amenities:
            h_amenities_lower = [a.lower() for a in h_amenities]
            matches = [
                pref for pref in inputs.preferred_amenities
                if any(pref.lower() in ha for ha in h_amenities_lower)
            ]
            amenity_score = len(matches) / max(len(inputs.preferred_amenities), 1)
            for m in matches[:2]:
                reasons.append(f"Matches your {m} preference")
        else:
            amenity_score = 0.85
            if h_pool:
                reasons.append("Includes swimming pool")
            if "free wifi" in [a.lower() for a in h_amenities]:
                reasons.append("Includes Free WiFi")

        # 6. User Preference Match (weight 0.10)
        user_pref_score = 0.5
        style = (inputs.travel_style or inputs.preference_type or "").lower()

        if style in ["family", "family-friendly"]:
            if h_family is True or any("family" in a.lower() for a in h_amenities):
                user_pref_score += 0.35
                reasons.append("Certified family-friendly stay")
        elif style in ["romantic", "luxury"]:
            if h_spa or h_rating >= 4.8 or (h_min_price and h_min_price > 200):
                user_pref_score += 0.35
                reasons.append("Ideal for romantic luxury getaway")
        elif style in ["budget", "backpacking"]:
            if h_min_price and h_min_price < 80:
                user_pref_score += 0.35
                reasons.append("Budget-friendly value accommodation")

        if h_id in inputs.saved_hotels:
            user_pref_score += 0.25
            reasons.append("In your saved hotels list")

        user_pref_score = min(max(user_pref_score, 0.0), 1.0)

        # Final weighted aggregation
        final_score = (
            0.25 * dest_score
            + 0.20 * rating_score
            + 0.15 * review_conf
            + 0.15 * budget_score
            + 0.15 * amenity_score
            + 0.10 * user_pref_score
        )
        final_score = round(min(max(final_score, 0.0), 1.0), 4)
        match_pct = int(round(final_score * 100))

        # Deduplicate reasons while preserving order
        dedup_reasons: List[str] = []
        for r in reasons:
            if r not in dedup_reasons:
                dedup_reasons.append(r)

        return HotelScoreBreakdown(
            hotel_id=h_id,
            final_score=final_score,
            match_percentage=match_pct,
            destination_score=round(dest_score, 3),
            rating_score=round(rating_score, 3),
            review_confidence=round(review_conf, 3),
            budget_compatibility=round(budget_score, 3),
            amenity_score=round(amenity_score, 3),
            user_preference_score=round(user_pref_score, 3),
            reasons=dedup_reasons[:4],
        )

    def rank_hotels(
        self,
        hotels: List[Hotel | Dict[str, Any]],
        inputs: HotelRecommendationInput,
        max_review_count: int = 10000,
    ) -> List[Tuple[Any, HotelScoreBreakdown]]:
        scored = [
            (h, self.score_hotel(h, inputs, max_review_count=max_review_count))
            for h in hotels
        ]
        scored.sort(key=lambda item: item[1].final_score, reverse=True)
        return scored


class HotelRecommendationService:
    """High-level recommendation service orchestrator."""

    def __init__(self, engine: Optional[BaseHotelRecommendationEngine] = None):
        self.engine = engine or BaselineHotelRecommendationEngine()

    def set_engine(self, engine: BaseHotelRecommendationEngine):
        """Allows hot-swapping baseline with ML models (XGBoost, SVD, etc.)."""
        self.engine = engine

    async def get_max_review_count(self, db: AsyncSession) -> int:
        """Retrieve highest review count in database for logarithmic normalization."""
        try:
            res = await db.execute(select(func.max(Hotel.review_count)))
            max_val = res.scalar()
            return int(max_val) if max_val and max_val > 0 else 10000
        except Exception:
            return 10000

    async def recommend(
        self,
        db: AsyncSession,
        inputs: HotelRecommendationInput,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Retrieve candidates from DB and score using active recommendation engine."""
        max_reviews = await self.get_max_review_count(db)

        # Candidate selection query
        query = select(Hotel)
        conditions = []

        if inputs.city:
            conditions.append(Hotel.city.ilike(f"%{inputs.city.strip()}%"))
        elif inputs.destination:
            conditions.append(
                or_(
                    Hotel.city.ilike(f"%{inputs.destination.strip()}%"),
                    Hotel.country.ilike(f"%{inputs.destination.strip()}%"),
                    Hotel.destination_slug.ilike(f"%{inputs.destination.strip()}%"),
                )
            )

        if inputs.country:
            conditions.append(Hotel.country.ilike(f"%{inputs.country.strip()}%"))

        if inputs.min_rating is not None:
            conditions.append(Hotel.avg_guest_rating >= inputs.min_rating)

        if inputs.budget is not None and inputs.budget > 0:
            # Include hotels with prices within reasonable range, OR hotels with missing price
            conditions.append(
                or_(
                    Hotel.price_per_night_min <= inputs.budget * 1.5,
                    Hotel.price_per_night_min.is_(None),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        # Retrieve candidates sorted by ratings / reviews
        query = query.order_by(Hotel.avg_guest_rating.desc().nullslast(), Hotel.review_count.desc()).limit(150)
        result = await db.execute(query)
        candidates = result.scalars().all()

        if not candidates and (inputs.city or inputs.destination):
            # Fallback relaxed query if city had 0 matches
            relaxed_query = select(Hotel).order_by(Hotel.avg_guest_rating.desc().nullslast(), Hotel.review_count.desc()).limit(50)
            result = await db.execute(relaxed_query)
            candidates = result.scalars().all()

        ranked = self.engine.rank_hotels(candidates, inputs, max_review_count=max_reviews)

        output = []
        for h, breakdown in ranked[:limit]:
            hotel_dict = {
                "id": h.id,
                "name": h.name,
                "description": h.description,
                "category": h.category,
                "city": h.city,
                "country": h.country,
                "continent": h.continent,
                "destination_slug": h.destination_slug,
                "avg_guest_rating": h.avg_guest_rating,
                "review_count": h.review_count,
                "image_url": h.image_url,
                "gallery_images": h.gallery_images or [],
                "latitude": h.latitude,
                "longitude": h.longitude,
                "address": h.address,
                "price_per_night_min": h.price_per_night_min,
                "price_per_night_max": h.price_per_night_max,
                "price_currency": h.price_currency,
                "price_display": f"${h.price_per_night_min:.2f}" if h.price_per_night_min is not None else "Price unavailable",
                "amenities": h.amenities or [],
                "is_pet_friendly": h.is_pet_friendly,
                "is_family_friendly": h.is_family_friendly,
                "has_pool": h.has_pool,
                "has_spa": h.has_spa,
                "booking_url": h.booking_url,
                "source": h.source,
                "source_row": h.source_row,
                "is_live_data": h.is_live_data,
                "data_quality_flags": h.data_quality_flags or [],
                "static_price": h.static_price or h.price_per_night_min,
                "live_price": h.live_price,
                "live_currency": h.live_currency,
                "availability_status": h.availability_status or ("Live offer" if h.is_live_data else "From dataset"),
                "live_provider": h.live_provider,
                "live_retrieved_at": h.live_retrieved_at.isoformat() if h.live_retrieved_at else None,
                "recommendation": breakdown.dict(),
            }
            output.append(hotel_dict)

        return output


hotel_recommendation_service = HotelRecommendationService()
