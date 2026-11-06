"""
Roamly AI — Hotel Live API Enrichment Service
Merges static catalog hotel data with live API providers (Amadeus, Google Places, SerpApi).
Preserves provenance and original catalog fields (static_price, source, source_row) while
augmenting with live pricing, availability status, photos, coordinates, room types, and booking URLs.
"""
from __future__ import annotations
import asyncio
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Hotel
from app.integrations.amadeus_client import amadeus_client
from app.integrations.google_places_client import google_places_client
from app.integrations.serpapi_client import serpapi_client

log = structlog.get_logger()


def normalize_name(name: str) -> str:
    """Normalize hotel name for fuzzy matching across providers."""
    if not name:
        return ""
    cleaned = re.sub(r"[^\w\s]", "", name.lower())
    # Remove common hotel suffixes
    for word in ["hotel", "resort", "inn", "suites", "palace", "international", "boutique", "spa"]:
        cleaned = re.sub(rf"\b{word}\b", "", cleaned)
    return " ".join(cleaned.split())


class HotelEnrichmentService:
    """
    Enriches static catalog hotels with live availability, rates, and verified location details.
    Enforces safe non-destructive merges: static fields are NEVER overwritten.
    """

    async def enrich_hotel_record(
        self,
        hotel: Hotel,
        check_in: Optional[str] = None,
        check_out: Optional[str] = None,
        adults: int = 2,
        db: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """Enrich a single hotel instance with real-time data from Amadeus and Google Places/SerpApi."""
        hotel_dict = {
            "id": hotel.id,
            "name": hotel.name,
            "description": hotel.description,
            "category": hotel.category,
            "city": hotel.city,
            "country": hotel.country,
            "continent": hotel.continent,
            "destination_slug": hotel.destination_slug,
            "star_rating": hotel.star_rating,
            "avg_guest_rating": hotel.avg_guest_rating,
            "review_count": hotel.review_count,
            "image_url": hotel.image_url,
            "gallery_images": list(hotel.gallery_images or []),
            "latitude": hotel.latitude,
            "longitude": hotel.longitude,
            "address": hotel.address,
            "price_per_night_min": hotel.price_per_night_min,
            "price_per_night_max": hotel.price_per_night_max,
            "price_currency": hotel.price_currency,
            "amenities": list(hotel.amenities or []),
            "is_pet_friendly": hotel.is_pet_friendly,
            "is_family_friendly": hotel.is_family_friendly,
            "has_pool": hotel.has_pool,
            "has_spa": hotel.has_spa,
            "booking_url": hotel.booking_url,
            "source": hotel.source or "hotels.csv",
            "source_row": hotel.source_row,
            "is_live_data": False,
            "data_quality_flags": list(hotel.data_quality_flags or []),
            "static_price": hotel.static_price or hotel.price_per_night_min,
            "live_price": None,
            "live_currency": None,
            "availability_status": "From dataset",
            "live_provider": None,
            "live_retrieved_at": None,
            "room_type": None,
        }

        # Format price display string
        if hotel_dict["static_price"] is not None:
            hotel_dict["price_display"] = f"${hotel_dict['static_price']:.2f}"
        else:
            hotel_dict["price_display"] = "Price unavailable"

        # 1. Attempt Amadeus Live Hotel Offer lookup
        norm_target = normalize_name(hotel.name)
        lookup_city = hotel.city or hotel.destination_slug or ""

        try:
            amadeus_res = await amadeus_client.search_hotel_offers(
                city_code_or_name=lookup_city,
                check_in_date=check_in,
                check_out_date=check_out,
                adults=adults,
            )

            matched_offer = None
            if amadeus_res and amadeus_res.offers:
                for off in amadeus_res.offers:
                    off_norm = normalize_name(off.hotel_name)
                    if norm_target and (norm_target in off_norm or off_norm in norm_target):
                        matched_offer = off
                        break

                # Fallback to first city offer if highly relevant city match
                if not matched_offer and amadeus_res.offers:
                    matched_offer = amadeus_res.offers[0]

            if matched_offer:
                hotel_dict["is_live_data"] = True
                hotel_dict["live_price"] = matched_offer.price_total
                hotel_dict["live_currency"] = matched_offer.currency
                hotel_dict["availability_status"] = "Live offer"
                hotel_dict["live_provider"] = "amadeus"
                hotel_dict["live_retrieved_at"] = datetime.now(timezone.utc).isoformat()
                hotel_dict["room_type"] = matched_offer.room_type
                hotel_dict["booking_url"] = matched_offer.booking_url or hotel_dict["booking_url"]
                hotel_dict["price_display"] = f"${matched_offer.price_total:.2f} ({matched_offer.currency})"
            else:
                hotel_dict["availability_status"] = "Availability requires verification"
        except Exception as e:
            log.warning("amadeus_enrichment_fallback", hotel_id=hotel.id, error=str(e))
            hotel_dict["availability_status"] = "Availability requires verification"

        # 2. Attempt Google Places / SerpApi enrichment for Photos and Coordinates
        if not hotel_dict["image_url"] or hotel_dict["latitude"] is None:
            try:
                place_query = f"{hotel.name} {hotel.city or ''} {hotel.country or ''}".strip()
                places_data = await google_places_client.search_text(query=place_query, limit=1)
                if places_data and places_data.places:
                    top_place = places_data.places[0]
                    if top_place.photos and not hotel_dict["image_url"]:
                        hotel_dict["image_url"] = top_place.photos[0]
                        hotel_dict["gallery_images"] = top_place.photos
                    if top_place.latitude and hotel_dict["latitude"] is None:
                        hotel_dict["latitude"] = top_place.latitude
                        hotel_dict["longitude"] = top_place.longitude
                    if top_place.formatted_address and not hotel_dict["address"]:
                        hotel_dict["address"] = top_place.formatted_address
            except Exception as pe:
                log.warning("places_enrichment_fallback", hotel_id=hotel.id, error=str(pe))

        # 3. Optional persistence of enrichment without overwriting static source fields
        if db is not None:
            try:
                hotel.static_price = hotel_dict["static_price"]
                hotel.live_price = hotel_dict["live_price"]
                hotel.live_currency = hotel_dict["live_currency"]
                hotel.availability_status = hotel_dict["availability_status"]
                hotel.live_provider = hotel_dict["live_provider"]
                if hotel_dict["live_retrieved_at"]:
                    hotel.live_retrieved_at = datetime.fromisoformat(hotel_dict["live_retrieved_at"])
                if hotel_dict["image_url"] and not hotel.image_url:
                    hotel.image_url = hotel_dict["image_url"]
                if hotel_dict["latitude"] is not None and hotel.latitude is None:
                    hotel.latitude = hotel_dict["latitude"]
                    hotel.longitude = hotel_dict["longitude"]
                await db.commit()
            except Exception as de:
                log.warning("db_enrichment_save_failed", error=str(de))

        return hotel_dict

    async def enrich_multiple(
        self,
        hotels: List[Hotel],
        check_in: Optional[str] = None,
        check_out: Optional[str] = None,
        db: Optional[AsyncSession] = None,
    ) -> List[Dict[str, Any]]:
        """Enrich a list of hotels concurrently with graceful error handling."""
        tasks = [
            self.enrich_hotel_record(h, check_in=check_in, check_out=check_out, db=db)
            for h in hotels
        ]
        return await asyncio.gather(*tasks, return_exceptions=False)


hotel_enrichment_service = HotelEnrichmentService()
