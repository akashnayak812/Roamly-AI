"""Events API — live local festivals, performances, exhibitions, and seasonal events."""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import structlog

from app.services.live_search_service import live_search_service

router = APIRouter()
log = structlog.get_logger()


class EventItem(BaseModel):
    id: str
    title: str
    date_summary: Optional[str] = "Upcoming"
    venue: Optional[str] = None
    city: str
    category: str = "cultural_event"
    description: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    source: str = "serpapi"


class EventsResponse(BaseModel):
    city: str
    events: List[EventItem]
    total_count: int


@router.get("", response_model=EventsResponse)
async def get_events(
    city: str = Query(..., min_length=2, description="Target city for events discovery"),
    query: Optional[str] = Query(None, description="Optional theme or festival name"),
    limit: int = Query(10, ge=1, le=25, description="Max results count"),
):
    """
    Search for live local events, cultural festivals, concerts, and exhibitions.
    Combines SerpApi live search with curated seasonal event intelligence.
    """
    try:
        search_query = f"festivals events exhibitions happening in {city}"
        if query:
            search_query = f"{query} events in {city}"

        web_res = await live_search_service.search_web(
            query=search_query,
            location=city,
            category="event",
            num_results=limit,
        )

        events: List[EventItem] = []
        for i, res in enumerate(web_res.results):
            events.append(
                EventItem(
                    id=f"event-{city.lower().replace(' ', '-')}-{i+1}",
                    title=res.title,
                    venue=city,
                    city=city,
                    category="local_event",
                    description=res.snippet,
                    source_url=res.url,
                    image_url=res.image_url or "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
                    source=res.source,
                )
            )

        # If SerpApi returned empty or had an issue, provide fallback curated local events
        if not events:
            curated_samples = [
                {
                    "title": f"Heritage & Cultural Walks — {city}",
                    "desc": f"Explore historic lanes, royal architecture, and local street stories across {city}.",
                    "category": "heritage_walk",
                    "img": "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&q=80",
                },
                {
                    "title": f"Sunset Food Crawl & Spice Tour",
                    "desc": f"Curated evening tasting trail covering iconic culinary hotspots and historic sweet shops.",
                    "category": "food_festival",
                    "img": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
                },
                {
                    "title": f"Artisan Crafts & Handloom Bazaar",
                    "desc": f"Traditional textile exhibits, folk performances, and live artisan workshops.",
                    "category": "art_exhibit",
                    "img": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
                },
            ]
            for idx, item in enumerate(curated_samples):
                events.append(
                    EventItem(
                        id=f"event-curated-{idx+1}",
                        title=item["title"],
                        venue=city,
                        city=city,
                        category=item["category"],
                        description=item["desc"],
                        source_url="",
                        image_url=item["img"],
                        source="curated",
                    )
                )

        return EventsResponse(
            city=city,
            events=events[:limit],
            total_count=len(events[:limit]),
        )
    except Exception as exc:
        log.error("events_search_error", city=city, error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to retrieve events")
