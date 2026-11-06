# Roamly AI — Tourism Data Acquisition & Recommendation Layer

This document describes the architecture, data provider integrations, normalization pipeline, deduplication algorithms, 8-factor hybrid recommendation engine, and API references implemented in Roamly AI.

---

## 1. Architecture Overview

Roamly AI features a unified multi-provider data acquisition and recommendation layer that powers:
- **Explore Dashboard (`/explore`)**: Curated and real-time destination and activity discovery.
- **AI Trip Planner (`/plan`)**: Context-aware itinerary generation grounded in real-time verified places.
- **Destination Details (`/destinations/[slug]`)**: Live attractions, stays, dining, weather, and maps.
- **Interactive Maps & Routes (`/trips/[tripId]`)**: Turn-by-turn directions, elevation, and distance matrices.

All third-party credentials and keys are strictly contained within backend adapters and never exposed to the frontend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (Next.js)                              │
│  - Explore Page   - AI Planner   - Destination Page   - Trips / Itinerary   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ /api/* (Authenticated, No Keys Exposed)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (FastAPI)                                │
│                                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────────────────────┐  │
│  │   Places Service      │  │        Recommendation Engine               │  │
│  │   - Deduplication     │  │  - 8-Factor Hybrid Scoring Formula         │  │
│  │   - Source Hierarchy  │  │  - Feedback & Impression Tracking          │  │
│  └───────────┬───────────┘  └─────────────────────┬──────────────────────┘  │
│              │                                    │                         │
│  ┌───────────▼────────────────────────────────────▼──────────────────────┐  │
│  │                      Provider Integration Clients                     │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│  │  │Google Places │ │ Google Maps  │ │   Amadeus    │ │  OpenWeather │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │
│  │  ┌──────────────┐ ┌───────────────────────────────────────────────┐  │  │
│  │  │   SerpApi    │ │ Curated Datasets (destinations, attractions)   │  │  │
│  │  └──────────────┘ └───────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Provider Integrations

### 2.1 Google Places API
- **Location**: `backend/app/integrations/google_places_client.py`
- **Capabilities**:
  - `text_search`: Discovers destinations, sightseeing spots, cafes, hotels with query/city biasing.
  - `nearby_search`: Point-of-interest discovery around latitude/longitude coordinates with radius.
  - `get_place_details`: Full details including ratings, user reviews, opening hours, formatted address, photos, and price level.
  - High-performance caching with Redis and memory fallback (TTL: 86400s / 24 hours).

### 2.2 Google Maps API
- **Location**: `backend/app/integrations/maps_client.py`
- **Capabilities**:
  - Geocoding and reverse geocoding.
  - Directions and routing between origins, waypoints, and destinations.
  - Distance (km), duration (mins), overview polyline, and step-by-step navigation instructions.
  - Caching with Redis/memory (TTL: 900s).

### 2.3 Amadeus Travel APIs
- **Location**: `backend/app/integrations/amadeus_client.py`
- **Capabilities**:
  - OAuth2 client credential token lifecycle management.
  - Hotel search and live rate room offers by city code or name.
  - Realistic fallback inventory when credentials are in sandbox/test mode, preventing UI disruption.
  - Caching with Redis/memory (TTL: 300s).

### 2.4 OpenWeatherMap API
- **Location**: `backend/app/integrations/weather_client.py`
- **Capabilities**:
  - Current weather conditions: temperature, humidity, wind speed, condition main.
  - Rain probability percentage and outdoor compatibility scoring (`is_outdoor_friendly`).
  - Weather-adaptive activity recommendations (e.g., museums on rainy days; gardens on pleasant days).
  - Caching with Redis/memory (TTL: 900s).

### 2.5 SerpApi Live Web Search
- **Location**: `backend/app/integrations/serpapi_client.py` & `backend/app/services/live_search_service.py`
- **Capabilities**:
  - Real-time Google Maps local results and web travel content.
  - Local events, festivals, food guides, and travel blogs.
  - Freshness intent detection in RAG pipeline (`backend/app/rag/retrieval.py`).
  - Untrusted data sanitization to prevent prompt injection vectors.

---

## 3. Provenance Trust Hierarchy & Deduplication

### 3.1 Provenance Trust Hierarchy
When multiple providers return data for the same venue, fields are merged using strict trust priorities:
1. **Official Tourism Source**: Weight 100
2. **Google Places**: Weight 85
3. **Amadeus**: Weight 80
4. **SerpApi**: Weight 70
5. **Uploaded / Curated Dataset**: Weight 65
6. **Internal / Other**: Weight 40–60

### 3.2 Spatial & Name Deduplication
- **Algorithm**: Spatial proximity (Haversine distance < 0.3 km) combined with normalized name substring / token overlap.
- **Merge Strategy**: Non-empty fields (descriptions, amenities, operating hours, photos) from secondary sources are merged into the higher-priority primary record.

---

## 4. 8-Factor Hybrid Recommendation Engine

### 4.1 Mathematical Formula
Implemented in `backend/app/services/recommendation_service.py`:

$$\text{Final Score} = 0.30 \cdot S_{\text{pref}} + 0.20 \cdot S_{\text{content}} + 0.15 \cdot S_{\text{rating}} + 0.10 \cdot S_{\text{budget}} + 0.10 \cdot S_{\text{season}} + 0.05 \cdot S_{\text{dist}} + 0.05 \cdot S_{\text{fresh}} + 0.05 \cdot S_{\text{div}}$$

Where:
- $S_{\text{pref}}$ (User Preference): Overlap between user travel interests and place categories/amenities.
- $S_{\text{content}}$ (Content Similarity): Similarity to previously saved or positive-rated items.
- $S_{\text{rating}}$ (Rating): Normalized 0–5 star visitor rating ($r / 5.0$).
- $S_{\text{budget}}$ (Budget Compatibility): Alignment between user budget and place price level.
- $S_{\text{season}}$ (Season Compatibility): Suitability for current calendar month and weather.
- $S_{\text{dist}}$ (Accessibility / Proximity): Spatial convenience and accessibility score.
- $S_{\text{fresh}}$ (Data Freshness): Priority boost for live real-time providers (Google Places / Amadeus / SerpApi).
- $S_{\text{div}}$ (Diversity Boost): Penalty for categories already over-represented in the current recommendation set.

### 4.2 Feedback & Impressions
- **Actions Recorded**: `like`, `dislike`, `save`, `hide`, `visited`, `not_interested`.
- **Endpoints**:
  - `POST /api/recommendations/feedback`
  - `POST /api/recommendations/impression`

---

## 5. API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/search/destinations` | `GET` | Search destinations across Google Places, local catalog, and SerpApi |
| `/api/search/attractions` | `GET` | Search attractions, monuments, sightseeing spots |
| `/api/search/restaurants` | `GET` | Search dining spots, cafes, rooftop restaurants |
| `/api/search/hotels` | `GET` | Search hotels and resorts |
| `/api/search/activities` | `GET` | Search tours, outdoor adventures, cooking classes |
| `/api/search/live` | `GET` | Unified real-time local search via SerpApi |
| `/api/places/{id}` | `GET` | Get full place details by internal ID or Google Places ID |
| `/api/places/nearby` | `GET` | Search points of interest nearby coordinates (`lat`, `lng`, `radius_km`) |
| `/api/hotels/offers` | `GET` | Live hotel room availability, prices, and room types via Amadeus |
| `/api/events` | `GET` | Live local festivals, exhibitions, and cultural events by city |
| `/api/maps/route` | `GET` | Route directions with distance (km), duration, and polyline steps |
| `/api/weather/current` | `GET` | Weather, outdoor suitability, rain probability, and activity recommendations |
| `/api/recommendations` | `GET` | 8-factor hybrid personalized destination & place recommendations |
| `/api/recommendations/feedback` | `POST` | Record user feedback (`like`, `save`, `hide`, etc.) |
| `/api/recommendations/impression` | `POST` | Track recommendation impressions |
| `/api/hotels` | `GET` | Search and filter 59,707 catalog hotels with pagination & sorting |
| `/api/hotels/{hotel_id}` | `GET` | Get single hotel details, provenance, and live enrichment |
| `/api/hotels/recommendations` | `GET` | Personalized hotel recommendations with transparent score breakdown |
| `/api/hotels/compare` | `GET` | Side-by-side comparison of up to 4 hotels |
| `/api/trips/{trip_id}/hotel` | `POST` | Attach selected hotel to trip itinerary |
| `/api/trips/{trip_id}/hotels/recommendations` | `GET` | Destination-tailored hotel recommendations for an itinerary |
| `/api/admin/ingest/hotels` | `POST` | Batch upsert 59,707 hotel dataset preserving all records |
| `/api/admin/ingest/hotels/status` | `GET` | Get hotel ingestion status, report, and row preservation guarantee |

---

## 6. Test Suite

Run tests:
```bash
cd backend
PYTHONPATH=. /Library/Frameworks/Python.framework/Versions/3.13/bin/pytest tests/test_hotels.py tests/test_tourism_layer.py -v
```

All unit and integration tests verify:
- Complete 59,707 hotel record count preservation.
- Non-destructive upserts and idempotence.
- Stable ID mapping and duplicate normalized key retention.
- Missing price handling ("Price unavailable") without converting to 0.
- 6-factor transparent hotel recommendation formula and breakdown reasons.
- RAG document formatting and grounding disclaimers.
- Google Places, Amadeus, and SerpApi live API fallback.
- Places service spatial deduplication and field merging.
- 8-factor mathematical scoring calculation and breakdown.
- Ingestion service lifecycle and status reporting.
