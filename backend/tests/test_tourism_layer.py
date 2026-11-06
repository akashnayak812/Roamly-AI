"""
Comprehensive unit and integration test suite for Roamly AI's Tourism Data Acquisition
and Recommendation Layer.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.integrations.google_places_client import GooglePlacesClient, NormalizedPlace, GooglePlacesResponse
from app.integrations.amadeus_client import AmadeusClient, AmadeusHotelOffer, AmadeusResponse
from app.integrations.maps_client import MapsClient, RouteResult
from app.integrations.weather_client import WeatherClient, WeatherCondition
from app.services.places_service import PlacesService, SOURCE_TRUST_HIERARCHY
from app.services.recommendation_service import (
    RecommendationService,
    UserPreferenceProfile,
    RecommendationFeedback,
)
from app.services.ingestion_service import IngestionService


# ── 1. Google Places Client Tests ─────────────────────────

@pytest.mark.asyncio
async def test_google_places_text_search():
    client = GooglePlacesClient(api_key="mock-key")
    mock_payload = {
        "status": "OK",
        "results": [
            {
                "place_id": "ChIJ_test1",
                "name": "Chowmahalla Palace",
                "formatted_address": "Motigall, Hyderabad, Telangana",
                "geometry": {"location": {"lat": 17.3578, "lng": 78.4717}},
                "rating": 4.6,
                "user_ratings_total": 24000,
                "price_level": 2,
                "types": ["tourist_attraction", "point_of_interest"],
                "opening_hours": {"open_now": True},
            }
        ],
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_payload
        mock_get.return_value = mock_resp

        result = await client.text_search(query="Chowmahalla Palace Hyderabad")
        assert len(result.results) == 1
        place = result.results[0]
        assert place.name == "Chowmahalla Palace"
        assert place.rating == 4.6
        assert place.source == "google_places"
        assert place.category == "attraction"


# ── 2. Amadeus Client Tests ───────────────────────────────

@pytest.mark.asyncio
async def test_amadeus_fallback_offers():
    client = AmadeusClient(client_id="", client_secret="")
    result = await client.search_hotel_offers(city_code_or_name="Goa", price_max=200.0)
    assert result.status == "OK"
    assert len(result.offers) > 0
    for offer in result.offers:
        assert offer.city == "Goa"
        assert offer.price_total <= 200.0
        assert offer.provider == "amadeus"


# ── 3. Maps Client Directions Tests ───────────────────────

@pytest.mark.asyncio
async def test_maps_client_directions():
    client = MapsClient(api_key="mock-key")
    mock_directions = {
        "status": "OK",
        "routes": [
            {
                "summary": "Expressway Route",
                "legs": [
                    {
                        "distance": {"value": 12500, "text": "12.5 km"},
                        "duration": {"value": 1500, "text": "25 mins"},
                        "steps": [
                            {
                                "html_instructions": "Head north",
                                "distance": {"text": "500 m"},
                                "duration": {"text": "1 min"},
                            }
                        ],
                    }
                ],
                "overview_polyline": {"points": "mock_poly_123"},
            }
        ],
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_directions
        mock_get.return_value = mock_resp

        route = await client.get_directions(origin="Point A", destination="Point B")
        assert route.distance_km == 12.5
        assert route.duration_mins == 25
        assert route.summary == "Expressway Route"
        assert len(route.steps) == 1


# ── 4. Weather Client Activity Compatibility Tests ─────────

@pytest.mark.asyncio
async def test_weather_client_outdoor_compat():
    client = WeatherClient(api_key="")
    # Rain test
    is_outdoor, recs = client._determine_activity_compat("Rain", 24.0)
    assert not is_outdoor
    assert any("Museum" in r for r in recs)

    # Clear test
    is_outdoor, recs = client._determine_activity_compat("Clear", 24.0)
    assert is_outdoor
    assert any("Outdoor" in r or "Parks" in r for r in recs)


# ── 5. Places Service Deduplication & Hierarchy Tests ─────

def test_places_service_spatial_deduplication():
    service = PlacesService()

    place_gp = NormalizedPlace(
        id="gp-1",
        name="Taj Mahal Palace",
        category="hotel",
        city="Mumbai",
        latitude=18.9217,
        longitude=72.8333,
        source="google_places",
        rating=4.8,
        review_count=12000,
        amenities=["Pool", "Spa"],
    )

    place_dataset = NormalizedPlace(
        id="ds-1",
        name="The Taj Mahal Palace",
        category="hotel",
        city="Mumbai",
        latitude=18.9219,
        longitude=72.8335,
        source="dataset",
        description="Historic luxury hotel opened in 1903",
        amenities=["Historic Suites"],
    )

    deduped = service._deduplicate_and_merge([place_dataset, place_gp])
    assert len(deduped) == 1
    merged = deduped[0]
    # Google Places has higher priority than dataset
    assert merged.source == "google_places"
    assert merged.rating == 4.8
    # Non-empty fields from dataset are retained
    assert merged.description == "Historic luxury hotel opened in 1903"
    # Amenities are merged
    assert "Pool" in merged.amenities
    assert "Historic Suites" in merged.amenities


# ── 6. Recommendation Service 8-Factor Formula Tests ──────

def test_recommendation_formula_exact_weights():
    service = RecommendationService()
    profile = UserPreferenceProfile(
        interests=["Culture", "History", "Food"],
        budget=50000.0,
    )

    place = NormalizedPlace(
        id="test-p1",
        name="Heritage Fort & Cultural Centre",
        category="attraction",
        rating=4.8,
        review_count=5000,
        activity_types=["Culture", "History"],
        source="google_places",
    )

    scored = service.compute_score(place, profile, category_counts={})
    # Check that score breakdown keys match the 8 factors
    breakdown = scored.score_breakdown
    assert "user_preference" in breakdown
    assert "content_similarity" in breakdown
    assert "rating" in breakdown
    assert "budget_compatibility" in breakdown
    assert "season_compatibility" in breakdown
    assert "distance" in breakdown
    assert "data_freshness" in breakdown
    assert "diversity" in breakdown

    # Check that weighted sum matches final score within floating precision
    expected_sum = (
        0.30 * breakdown["user_preference"]
        + 0.20 * breakdown["content_similarity"]
        + 0.15 * breakdown["rating"]
        + 0.10 * breakdown["budget_compatibility"]
        + 0.10 * breakdown["season_compatibility"]
        + 0.05 * breakdown["distance"]
        + 0.05 * breakdown["data_freshness"]
        + 0.05 * breakdown["diversity"]
    )
    assert abs(scored.final_score - expected_sum) < 0.01
    assert 50 <= scored.match_percentage <= 98


def test_recommendation_feedback_recording():
    service = RecommendationService()
    feedback = RecommendationFeedback(
        user_id="user-123",
        place_id="place-abc",
        action="like",
    )
    service.record_feedback(feedback)
    assert len(service._feedback_store) == 1
    assert service._feedback_store[0].action == "like"


# ── 7. Ingestion Service Status Tests ─────────────────────

def test_ingestion_service_initial_state():
    service = IngestionService()
    status = service.get_status()
    assert status["status"] == "idle"
    errors = service.get_errors()
    assert errors == []
