# Roamly AI — Hotel Dataset, Ingestion & Recommendation Engine

This documentation details the integration of the normalized hotel dataset (59,707 records) into Roamly AI, covering the ingestion pipeline, data schema, recommendation scoring formula, RAG retrieval grounding, static vs. live enrichment, missing price handling, and testing instructions.

---

## 1. Dataset Overview & Provenance

### 1.1 Dataset Locations
- **Processed JSON (Primary Ingestion Source)**: `data/processed/hotels.json` (59,707 records)
- **Raw CSV**: `data/raw/hotels.csv`
- **Data Quality Report**: `data/processed/hotels_data_quality.json`

### 1.2 Preservation Guarantees
- **Strict Row Preservation**: Exactly 59,707 hotel records are preserved during ingestion. No hotel record is silently dropped, skipped, or truncated.
- **Duplicate Normalized Keys**: 13 hotel pairs sharing identical name, city, and country combinations are preserved as discrete rows using their unique, stable dataset IDs (`hotel-csv-XXXXXX`).
- **Data Quality Flags**: Warnings from `hotels_data_quality.json` (such as `PRICE_ZERO_OR_NEGATIVE`, `SUSPICIOUS_REVIEW_COUNT`, `COORDINATE_PRECISION_LOW`) are attached directly to each record's `data_quality_flags` field for provenance auditing.

---

## 2. Hotel Schema & Field Mapping

The JSON dataset fields map directly to the PostgreSQL `Hotel` model:

| Dataset Field | Database Column | Type | Notes / Nullability |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `VARCHAR(64)` | Stable dataset ID (e.g. `hotel-csv-000001`), Primary Key |
| `name` | `name` | `VARCHAR(255)` | Hotel name |
| `description` | `description` | `TEXT` | `null` when missing (never invented) |
| `category` | `category` | `VARCHAR(64)` | Hotel category / type |
| `avg_guest_rating` | `avg_guest_rating` | `FLOAT` | 0.0 – 5.0 guest rating |
| `review_count` | `review_count` | `INTEGER` | Total user reviews |
| `image_url` | `image_url` | `VARCHAR(500)` | Primary photo URL |
| `gallery_images` | `gallery_images` | `JSON` | Array of additional photo URLs |
| `latitude` | `latitude` | `FLOAT` | WGS84 coordinate (`null` when missing) |
| `longitude` | `longitude` | `FLOAT` | WGS84 coordinate (`null` when missing) |
| `address` | `address` | `VARCHAR(500)` | Formatted address |
| `price_per_night_min` | `price_per_night_min` | `FLOAT` | Minimum static rate (`null` when unavailable) |
| `price_per_night_max` | `price_per_night_max` | `FLOAT` | Maximum static rate (`null` when unavailable) |
| `price_currency` | `price_currency` | `VARCHAR(10)` | Currency code (`null` when missing; never invented) |
| `amenities` | `amenities` | `JSON` | Array of amenity strings |
| `is_pet_friendly` | `is_pet_friendly` | `BOOLEAN` | Boolean flag derived from amenities |
| `is_family_friendly` | `is_family_friendly` | `BOOLEAN` | Boolean flag |
| `has_pool` | `has_pool` | `BOOLEAN` | Boolean flag |
| `has_spa` | `has_spa` | `BOOLEAN` | Boolean flag |
| `booking_url` | `booking_url` | `VARCHAR(500)` | Catalog booking URL |
| `city` | `city` | `VARCHAR(128)` | City name for search & filtering |
| `country` | `country` | `VARCHAR(128)` | Country name |
| `continent` | `continent` | `VARCHAR(64)` | Continent name |
| `destination_slug` | `destination_slug` | `VARCHAR(128)` | Foreign link slug |
| `destination_id` | `destination_id` | `VARCHAR(64)` | Destination foreign key |
| `source` | `source` | `VARCHAR(64)` | Default: `"dataset"` |
| `source_row` | `source_row` | `INTEGER` | 1-based source CSV row number |
| `is_live_data` | `is_live_data` | `BOOLEAN` | `false` for static dataset catalog |
| `data_quality_flags` | `data_quality_flags` | `JSON` | Array of data-quality warnings |
| `static_price` | `static_price` | `FLOAT` | Preserved static price baseline |
| `live_price` | `live_price` | `FLOAT` | Real-time rate from Amadeus / Google Places |
| `live_currency` | `live_currency` | `VARCHAR(10)` | Currency of live offer |
| `availability_status` | `availability_status` | `VARCHAR(64)` | `"verified"`, `"unavailable"`, etc. |
| `live_provider` | `live_provider` | `VARCHAR(64)` | `"amadeus"`, `"google_places"`, `"serpapi"` |
| `live_retrieved_at` | `live_retrieved_at` | `TIMESTAMP` | ISO timestamp of live enrichment |

---

## 3. Ingestion Pipeline & Admin Endpoints

The ingestion pipeline is implemented in `backend/app/services/hotel_ingestion_service.py` and exposed via admin endpoints:

### 3.1 Endpoints
- `POST /api/admin/ingest/hotels`: Trigger asynchronous hotel ingestion.
  - Optional query param: `file_path` (defaults to `data/processed/hotels.json`).
- `GET /api/admin/ingest/hotels/status`: Retrieve the current status or final ingestion report.

### 3.2 Ingestion Guarantees
1. **Batch Upserts**: Records are ingested in chunks of 500 rows using PostgreSQL `on_conflict_do_update` (`INSERT ... ON CONFLICT (id) DO UPDATE`), preventing parameter overflow while maintaining high throughput.
2. **Idempotence**: Running ingestion repeatedly safely updates existing records without creating duplicates.
3. **Preserved Row Count**: Total row count matches 59,707.
4. **Standard Report Output**:
```json
{
  "input_rows": 59707,
  "inserted_rows": 59707,
  "updated_rows": 0,
  "failed_rows": 0,
  "preserved_row_count": true,
  "status": "completed",
  "duration_seconds": 38.45,
  "errors": []
}
```

---

## 4. Hotel Search & Filter API

Available at:
- `GET /api/search/hotels`
- `GET /api/hotels`
- `GET /api/hotels/{hotel_id}`
- `GET /api/hotels/nearby`
- `GET /api/hotels/compare`

### Supported Query Parameters
- `query`: Text search across hotel name, city, country, address, and amenities.
- `city`: Exact or case-insensitive city match.
- `country`: Exact or case-insensitive country match.
- `min_price`: Filter by minimum night rate.
- `max_price`: Filter by maximum night rate.
- `min_rating`: Filter by minimum guest rating (0.0 – 5.0).
- `min_review_count`: Filter by minimum number of reviews.
- `amenity`: Case-insensitive amenity filter (e.g., `"Pool"`, `"Free WiFi"`, `"Spa"`).
- `sort`: `"rating"`, `"price_asc"`, `"price_desc"`, `"reviews"`, or `"name"`.
- `page`: Page number (1-based, default 1).
- `limit`: Number of results per page (default 20, max 100).

### Missing Price Handling
If a hotel record does not contain pricing in the dataset:
- `price_per_night_min` and `price_per_night_max` remain `null`.
- The frontend explicitly renders **"Price unavailable"**.
- Missing price is **never converted to 0**.

---

## 5. Transparent Baseline Recommendation Algorithm

Implemented in `backend/app/services/hotel_recommendation_service.py` through the pluggable `BaseHotelRecommendationEngine` interface.

### 5.1 Mathematical Formula

$$\text{Final Score} = 0.25 \cdot S_{\text{dest}} + 0.20 \cdot S_{\text{rating}} + 0.15 \cdot S_{\text{review}} + 0.15 \cdot S_{\text{budget}} + 0.15 \cdot S_{\text{amenity}} + 0.10 \cdot S_{\text{pref}}$$

Where:
- **Destination Match ($S_{\text{dest}}$)**:
  - $1.0$ if the hotel city or country matches the requested destination.
  - $0.0$ otherwise.
- **Rating Score ($S_{\text{rating}}$)**:
  $$S_{\text{rating}} = \frac{\text{rating}}{5.0}$$
  (Defaults to $0.6$ if rating is missing).
- **Review Confidence ($S_{\text{review}}$)**:
  $$S_{\text{review}} = \frac{\ln(1 + \text{review\_count})}{\ln(1 + \text{maximum\_review\_count})}$$
  Where $\text{maximum\_review\_count} = 10,000$.
- **Budget Compatibility ($S_{\text{budget}}$)**:
  - If hotel price is unavailable: $0.6$ neutral score.
  - If $\text{price} \le \text{budget}$: $1.0$.
  - If $\text{price} > \text{budget}$: $\max\left(0.1, 1.0 - \frac{\text{price} - \text{budget}}{\text{budget}}\right)$.
- **Amenity Match ($S_{\text{amenity}}$)**:
  - Overlap ratio: $\frac{|\text{hotel\_amenities} \cap \text{preferred\_amenities}|}{|\text{preferred\_amenities}|}$.
- **User Preference Match ($S_{\text{pref}}$)**:
  - Overlap with user preferences, travel styles (e.g. family, luxury, romantic, pet-friendly), and saved hotels.

### 5.2 Recommendation Output Breakdown
```json
{
  "hotel_id": "hotel-csv-000002",
  "final_score": 0.86,
  "match_percentage": 86,
  "reasons": [
    "Located in the requested city Munnar",
    "Highly rated (4.5/5.0 stars)",
    "Strong guest review confidence (1,240 reviews)",
    "Matches your Free WiFi preference"
  ]
}
```

---

## 6. RAG Retrieval Integration

The RAG pipeline formats hotel catalog records into grounded retrieval documents (`backend/app/rag/retrieval.py`):

### Document Schema
```text
HOTEL: Munnar Mountain Palace
City: Munnar
Country: India
Rating: 4.5/5 (1,240 reviews)
Price: $85 - $130 USD/night
Amenities: Free WiFi, Pool, Breakfast, Parking
Provenance: dataset (Row #2)
Data Quality Warnings: None
Notice: Prices are static catalog estimates. Live availability and confirmed pricing require real-time verification.
```

### Strict Grounding Rules for AI Trip Assistant
1. **Never Invent Information**: If prices, coordinates, or photos are missing, the assistant reports them as missing.
2. **Static vs. Live Disclosure**: Catalog data is explicitly cited as static catalog data. The AI will never claim room inventory is confirmed without a live provider response.
3. **No Zero Price Conversion**: Missing prices are rendered as "Price unavailable".

---

## 7. Live API Enrichment

Implemented in `backend/app/services/hotel_enrichment_service.py` with multi-provider integration:
- **Amadeus Travel API**: Live room offers, current room prices, room types, and booking confirmation tokens.
- **Google Places API**: Real-time user photos, current guest ratings, formatted address, and verified coordinates.
- **SerpApi**: Real-time Google Maps local review snippets.

### Non-Destructive Data Merging
When live data is fetched, static baseline data is never lost:
- `static_price`: Remains unchanged.
- `live_price`: Populated with current rate.
- `live_currency`: Populated with live currency.
- `availability_status`: Updated to `"available"`, `"sold_out"`, or `"requires_verification"`.
- `live_provider`: Set to `"amadeus"` or `"google_places"`.
- `live_retrieved_at`: Timestamped with the retrieval instant.

---

## 8. Test Commands

Run the hotel test suite:

```bash
cd backend
PYTHONPATH=. /Library/Frameworks/Python.framework/Versions/3.13/bin/pytest tests/test_hotels.py -v
```

Run all system tests:
```bash
cd backend
PYTHONPATH=. /Library/Frameworks/Python.framework/Versions/3.13/bin/pytest tests/ -v
```

Run frontend typecheck:
```bash
cd frontend
npx tsc --noEmit
```
