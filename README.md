# Roamly AI — Smart Tourism Recommendation & Travel Planning Platform

> An intelligent, AI-powered travel planning platform designed to generate personalized, day-by-day itineraries, smart destination recommendations, and budget-optimized routes matching the uploaded UI references down to every pixel, typographic choice, and interaction pattern.

---

## 🌟 Visual Reference Implementations

The four core screens from the provided visual references have been faithfully recreated:

| Screen | Route | Visual Reference Match | Key Highlights |
|---|---|---|---|
| **1. Destination Details** | [`/destinations/kyoto-japan`](http://localhost:3000/destinations/kyoto-japan) | **Image 1** | Panoramic sunset hero with Japanese temple, breadcrumbs, best-time/cost/safety stat badges, tab bar, *"Why you'll love it"* with Kyoto watercolor calligraphy box, *"Top attractions"* cards (Fushimi Inari, Arashiyama, Nishiki Market), *"Perfect for you"* 94% match donut gauge & category breakdown bars, interactive city map. |
| **2. Itinerary Dashboard** | [`/trips/kerala-escape`](http://localhost:3000/trips/kerala-escape) | **Image 2** | Kerala backwaters houseboat hero, floating budget (`₹46,800`)/duration/travelers/pace metric badges, 5-day vertical timeline selector with thumbnails on the left, time-stamped activity schedule cards (09:00 AM – 06:00 PM), interactive route map, trip highlights, Share/PDF export/Ask Roamly action bar. |
| **3. Explore Dashboard** | [`/explore`](http://localhost:3000/explore) | **Image 3** | Sage-green sidebar with custom mountain brand badge & tropical bottom sunset art, search bar, hero banner (*"Plan a trip you'll remember"*), *"AI picks for you"* right-hand cards (Kyoto, Santorini, Queenstown), 4-column *"Popular destinations"* grid. |
| **4. AI Trip Planner** | [`/plan`](http://localhost:3000/plan) | **Image 4** | Planner sidebar with `+ New trip` and recent chat sessions, header with Kerala backwater photo, conversational stream, structured multi-day breakdown with map route preview & 4 metric pills, interactive prompt bar with Web Speech STT & attachments, right *"Trip preferences"* panel with budget range slider (`₹50,000`), travel dates, interactive interest chips, and pace toggle. |

---

## 🚀 Full Route Sitemap

- **`/`**: Premium landing page with interactive hero, how it works, destination showcase, and CTA.
- **`/explore`**: Explore dashboard matching Screenshot 3.
- **`/plan`**: AI Trip Planner conversational interface matching Screenshot 4.
- **`/trips/kerala-escape`** (or `/trips/[tripId]`): 5-Day Kerala Escape itinerary dashboard matching Screenshot 2.
- **`/destinations/kyoto-japan`** (or `/destinations/[slug]`): Kyoto Destination details page matching Screenshot 1.
- **`/trips`**: My Trips dashboard with active, planning, and past journeys.
- **`/saved`**: Saved destinations & wishlists.
- **`/profile`**: Traveler persona, diet preferences, currency, and AI travel style configuration.
- **`/login`** & **`/register`**: Authentication with one-click guest demo account.

---

## 🏗️ Architecture & Technology Stack

### Frontend
- **Framework**: Next.js 16 (Turbopack, App Router)
- **Styling**: Tailwind CSS + Custom Design System Tokens (Warm Cream `#FCFAF7`, Forest Emerald `#1C4A2A`, Terracotta Coral `#E76F51`)
- **Typography**: Google Playfair Display (Headings) & Inter (Body UI)
- **Animation**: Framer Motion
- **Icons**: Lucide Icons
- **State & Data**: TanStack Query + Zustand

### Backend
- **Framework**: FastAPI (Async Python 3.11)
- **Database**: PostgreSQL 16 + `pgvector` for semantic vector search
- **Cache & Message Broker**: Redis 7
- **AI Engine**: Google Gemini API with RAG (Retrieval-Augmented Generation)
- **Voice Capabilities**: Web Speech API client + FastAPI Voice adapter

---

## 💻 Running Locally

### 1. Frontend Development Server
```bash
cd frontend
npm install
npm run dev
# App will run on http://localhost:3000
```

### 2. Full Stack with Docker Compose
```bash
# Start PostgreSQL (pgvector), Redis, FastAPI backend, and Next.js frontend
docker-compose up --build
```

---

## 🌐 SerpApi Integration & Live Web Search

Roamly AI features a secure, backend-only **SerpApi integration** that powers real-time tourism discoveries without compromising the curated database or exposing credentials to the client.

### 1. Environment Variables

Add the following variables to your backend `.env` file (see `.env.example`):

```env
# SerpApi Live Web Search Configuration
SERPAPI_API_KEY=your_serpapi_api_key_here
SERPAPI_ENGINE=google
SERPAPI_TIMEOUT_SECONDS=15
SERPAPI_CACHE_TTL_SECONDS=1800
```

> **Note:** The `SERPAPI_API_KEY` is **never exposed** to the frontend. All live web searches route strictly through the FastAPI backend service layer.

---

### 2. Supported Search Categories

The service optimizes search parameters and queries based on the requested domain category:

| Category | Description | Query Augmentation Example |
|---|---|---|
| `destination` | City, state, or regional exploration | `"hidden gems in Kerala"` |
| `attraction` | Sights, landmarks, shrines, museums | `"top sights attractions Kyoto Japan"` |
| `hotel` | Hotels, boutique stays, ryokans, resorts | `"best hotels accommodations Munnar"` |
| `restaurant` | Local cuisine, street food, dining spots | `"best restaurants authentic dining Fort Kochi"` |
| `activity` | Experiences, cruises, treks, workshops | `"things to do activities experiences Alleppey"` |
| `event` | Local festivals, celebrations, seasonal dates | `"upcoming events festivals Thrissur"` |
| `guide` | Travel itineraries, blogs, insider tips | `"travel guide recommendations Kyoto"` |
| `general` | General web queries, "near me" searches | `"weather today near Munnar"` |

---

### 3. Backend API Endpoint

#### `GET /api/search/web`

Executes cached, deduplicated web searches via SerpApi.

**Query Parameters:**
- `q` (required, `str`): User search query (2–250 chars).
- `location` (optional, `str`): Geographic location filter (e.g. `"India"`, `"Kyoto, Japan"`).
- `category` (optional, `str`): Domain category (default: `"general"`).
- `language` (optional, `str`): Language code (default: `"en"`).
- `country` (optional, `str`): Two-letter country code (default: `"in"`).
- `limit` (optional, `int`): Maximum results to return (1–20, default: `10`).

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/search/web?q=hidden%20gems%20in%20Kerala&location=India&category=destination&limit=5"
```

**Normalized Response Schema:**
```json
{
  "query": "hidden gems in Kerala",
  "results": [
    {
      "title": "Hidden Gems in Kerala You Must Visit",
      "url": "https://travelkerala.example.com/hidden-gems",
      "snippet": "Discover secret backwaters, serene hill stations, and untouched beaches across Kerala.",
      "source": "Travel Kerala",
      "image_url": "https://travelkerala.example.com/thumb1.jpg",
      "position": 1,
      "category": "destination",
      "retrieved_at": "2026-10-07T16:00:00Z"
    }
  ],
  "source": "serpapi",
  "cached": false,
  "engine": "google",
  "live_search_available": true,
  "error": null
}
```

---

### 4. RAG Pipeline Integration Flow

When a user chats with the AI assistant, the RAG retrieval pipeline evaluates freshness requirements dynamically:

```text
User Question
    │
    ▼
Intent Detection & Freshness Evaluation
    ├─ Static Knowledge Query ───► Standard pgvector Vector Search
    │
    └─ Temporal/Freshness Query (e.g., "today", "current", "prices", "events", "monsoon")
            │
            ▼
    Generate Category-Tuned SerpApi Query
            │
            ▼
    Execute Live Web Search with Redis Cache Check
            │
            ▼
    Clean & Canonical URL / Title Deduplication
            │
            ▼
    Neutralize Untrusted Web Content (Strip prompt injection vectors)
            │
            ▼
    Synthesize Context Chunks ([UNTRUSTED EXTERNAL WEB RESULT])
            │
            ▼
    Gemini Generates Grounded Answer
            │
            ▼
    Stream Answer + Citations with Live Web Badges & Timestamps
```

#### Security & Untrusted Web Data Defense
- **Prompt Injection Neutralization**: All scraped snippet text is preprocessed with `_sanitize_untrusted_web_content` to neutralize jailbreak prompts like `[IGNORE ALL INSTRUCTIONS]`.
- **Untrusted Context Encapsulation**: LLM prompts explicitly bracket external data with `[UNTRUSTED EXTERNAL WEB RESULT - FACTUAL REFERENCE ONLY]` to instruct the model to treat external content strictly as factual data rather than instructions.

#### Embedding Model Migration
- The backend uses `gemini-embedding-001` with 768 dimensions to match the `document_chunks.embedding` column.
- When changing the embedding model, re-embed all stored document chunks before relying on semantic results; vectors from different embedding models are not interchangeable.
- Preview the row count with `cd backend && PYTHONPATH=. python scripts/reindex_embeddings.py --dry-run`, then run `cd backend && PYTHONPATH=. python scripts/reindex_embeddings.py` to rebuild the vectors. The script commits the new vectors together so a failed run preserves the existing index.

---

### 5. Caching & Reliability Architecture

- **Composite Redis Cache Key**:
  `serpapi:cache:{sha256(q + loc + hl + gl + eng + cat)}`
- **Configurable TTL**: Defaults to 1800 seconds (30 minutes).
- **In-Memory Fallback**: If Redis is offline, the service automatically falls back to an in-memory TTL dictionary without throwing errors.
- **Retry with Exponential Backoff**: Transient errors (502, 503, 504, network timeouts) are retried up to 3 times with progressive delays (`[0.5s, 1.5s, 3.0s]`).
- **Rate-Limit Handling**: HTTP 429 responses are captured gracefully; the application falls back seamlessly to internal vector database knowledge.
- **Graceful Degradation**: If SerpApi is unavailable or unconfigured, `live_search_available: false` is returned, allowing the user to view curated database results without interruption.

---

### 6. Frontend Integration

SerpApi live discovery is integrated into the existing UI components:
- **Explore Dashboard (`/explore`)**: Dedicated "Live Web" tab toggle rendering `LiveWebResultCard` items with animated live status indicators, images, sources, snippets, timestamps, external links, loading skeletons, empty states, and retry buttons.
- **AI Trip Planner (`/plan`)**: Assistant messages automatically include live search results with citation cards and timestamps when asking for real-time rates or events.
- **Destination Details (`/destinations/[slug]`)**: Tab switching ("Things to do", "Stay", "Eat", "Reviews") fetches live SerpApi results, and the "Ask Roamly" modal features a live web toggle.
- **Itinerary Dashboard (`/trips/[tripId]`)**: The "Ask Roamly" slideover drawer provides live recommendations with quick chips for food, tickets, and weather.

---

### 7. Automated Testing

Run the automated test suite with mocked SerpApi HTTP responses:

```bash
cd backend
PYTHONPATH=. pytest tests/test_serpapi.py -v
```

The test suite covers:
- Successful SerpApi searches and payload normalization.
- Empty search results handling.
- Query validation, control character stripping, and length limits.
- Network timeouts (`httpx.TimeoutException`) and retries.
- Rate-limit (HTTP 429) and server failure (HTTP 500) responses.
- Redis cache hit and cache miss scenarios.
- Duplicate and canonical URL removal.
- RAG freshness intent detection (`detect_live_search_intent`).
- Untrusted content neutralization and citation preservation.
- FastAPI `GET /api/search/web` endpoint schemas and 422 validations.

---

### 8. Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| `live_search_available: false` | Missing or invalid `SERPAPI_API_KEY` | Set a valid API key in `.env` and restart the backend. |
| Cache always returns `cached: false` | Redis server not running | Ensure Redis is started (`redis-server`), or rely on the automatic in-memory fallback. |
| Empty results for local queries | Location parameter too restrictive | Try broadening the `location` parameter or include the city name directly in `q`. |
| Rate limit error (HTTP 429) | SerpApi monthly quota exhausted | Verify your SerpApi plan quota at [serpapi.com/dashboard](https://serpapi.com/dashboard). |

---

## 🏨 Normalized Hotel Dataset & Recommendation Engine

Roamly AI features a fully ingested catalog of **59,707 hotel records** across 2,015 global cities, integrated into search, filtering, itinerary planning, comparison, wishlist, RAG retrieval, and live API enrichment.

### 1. Dataset & Ingestion
- **Source Files**:
  - `data/processed/hotels.json` (59,707 records, primary catalog source)
  - `data/raw/hotels.csv` (Raw source)
  - `data/processed/hotels_data_quality.json` (Quality flags & provenance warnings)
- **Preservation Policy**:
  - Exactly 59,707 rows preserved without deletion, truncating, or skipping.
  - 13 duplicate normalized keys (identical name, city, country) are preserved with their unique dataset IDs.
  - Missing prices and coordinates remain `null` and are rendered as `"Price unavailable"`—never converted to 0.
- **Admin Ingestion Endpoints**:
  - `POST /api/admin/ingest/hotels`: Run or resume idempotent batch upsert (`on_conflict_do_update`).
  - `GET /api/admin/ingest/hotels/status`: Check current progress or completed report:
    ```json
    {
      "input_rows": 59707,
      "inserted_rows": 0,
      "updated_rows": 59707,
      "failed_rows": 0,
      "preserved_row_count": true
    }
    ```

### 2. Transparent Recommendation Algorithm
Pluggable via `BaseHotelRecommendationEngine`:

$$\text{Final Score} = 0.25 \times \text{dest} + 0.20 \times \text{rating} + 0.15 \times \text{review\_confidence} + 0.15 \times \text{budget} + 0.15 \times \text{amenity} + 0.10 \times \text{user\_preference}$$

Where:
- $\text{rating score} = \frac{\text{rating}}{5.0}$
- $\text{review confidence} = \frac{\ln(1 + \text{review\_count})}{\ln(1 + \text{max\_review\_count})}$

Each recommendation returns a full transparent reasoning breakdown (e.g., `"Located in Munnar"`, `"Highly rated (4.6/5)"`, `"Matches Free WiFi preference"`).

### 3. RAG Grounding & Live API Enrichment
- **RAG Retrieval**: Formats hotel catalog documents with full provenance (source row, dataset ID, data-quality warnings, disclaimer that catalog rates are static estimates).
- **Live Provider Enrichment**: Non-destructively merges Amadeus live room offers and Google Places photos/ratings while preserving `static_price`, `source`, and `source_row`.

### 4. Test Commands
```bash
# Run hotel backend test suite
cd backend
PYTHONPATH=. /Library/Frameworks/Python.framework/Versions/3.13/bin/pytest tests/test_hotels.py -v

# Run frontend typecheck
cd frontend
npx tsc --noEmit
```

---

## 🔒 Security & Best Practices
- Zero hardcoded frontend API secrets; all backend communications route through protected FastAPI endpoints.
- Type-safe schema validation across Next.js and FastAPI with Zod and Pydantic v2.
- Untrusted web content is sanitized before reaching the Gemini prompt context.
- Static catalog data is strictly distinguished from live API availability and pricing.

# Roamly-AI
