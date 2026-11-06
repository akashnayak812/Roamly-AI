"""
Amadeus Travel APIs Client — Backend-only secure client for Amadeus hotel & flight search.
Handles OAuth2 token lifecycle, hotel availability, rates, and travel inventory.
Provides graceful fallback inventory when API keys are unconfigured.
"""
from __future__ import annotations
import asyncio
import hashlib
import json
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
import httpx
from pydantic import BaseModel, Field
import structlog
import redis.asyncio as aioredis

from app.core.config import settings

log = structlog.get_logger()


class AmadeusHotelOffer(BaseModel):
    id: str
    hotel_name: str
    hotel_id: str
    city: str
    check_in: str
    check_out: str
    room_type: str = "Standard Room"
    price_total: float
    currency: str = "USD"
    rating: Optional[float] = 4.5
    amenities: List[str] = ["Free WiFi", "Air Conditioning"]
    booking_url: Optional[str] = None
    provider: str = "amadeus"


class AmadeusResponse(BaseModel):
    query: str
    offers: List[AmadeusHotelOffer] = []
    source: str = "amadeus"
    cached: bool = False
    status: str = "OK"
    error: Optional[str] = None


class AmadeusClient:
    """
    Asynchronous Amadeus API client managing OAuth2 tokens, rate limits,
    Redis caching, and fallback hotel inventory.
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: int = 15,
    ):
        self.client_id = client_id or settings.AMADEUS_CLIENT_ID
        self.client_secret = client_secret or settings.AMADEUS_CLIENT_SECRET
        self.base_url = (base_url or settings.AMADEUS_BASE_URL or "https://test.api.amadeus.com").rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._token: Optional[str] = None
        self._token_expires_at: float = 0
        self._redis: Optional[aioredis.Redis] = None
        self._mem_cache: Dict[str, Tuple[float, Any]] = {}
        self.cache_ttl = settings.CACHE_TTL_HOTEL_AVAILABILITY or 300

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1.5,
                )
                await self._redis.ping()
            except Exception:
                self._redis = None
        return self._redis

    async def _get_token(self) -> Optional[str]:
        """Fetch or refresh OAuth2 Bearer token."""
        if not self.client_id or not self.client_secret:
            return None

        if self._token and time.time() < (self._token_expires_at - 60):
            return self._token

        url = f"{self.base_url}/v1/security/oauth2/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, data=data)
                res.raise_for_status()
                payload = res.json()
                self._token = payload.get("access_token")
                expires_in = payload.get("expires_in", 1799)
                self._token_expires_at = time.time() + expires_in
                return self._token
        except Exception as e:
            log.warning("amadeus_auth_failed", error=str(e))
            return None

    def _get_fallback_offers(self, city: str, check_in: str, check_out: str) -> List[AmadeusHotelOffer]:
        """Provide realistic hotel offers if Amadeus credentials are unset or test mode is inactive."""
        city_clean = city.split(",")[0].strip().title()
        return [
            AmadeusHotelOffer(
                id=f"ama-{city_clean.lower()}-1",
                hotel_name=f"The Grand {city_clean} Heritage Palace",
                hotel_id=f"HOTEL-{city_clean.upper()}-01",
                city=city_clean,
                check_in=check_in,
                check_out=check_out,
                room_type="Deluxe King Room with City View",
                price_total=145.0,
                currency="USD",
                rating=4.8,
                amenities=["Free High-Speed WiFi", "Infinity Pool", "Spa & Wellness", "Breakfast Included", "Airport Shuttle"],
                booking_url=f"https://www.google.com/travel/hotels?q={city_clean}+hotels",
                provider="amadeus",
            ),
            AmadeusHotelOffer(
                id=f"ama-{city_clean.lower()}-2",
                hotel_name=f"{city_clean} Boutique Suites & Spa",
                hotel_id=f"HOTEL-{city_clean.upper()}-02",
                city=city_clean,
                check_in=check_in,
                check_out=check_out,
                room_type="Executive Suite",
                price_total=98.0,
                currency="USD",
                rating=4.6,
                amenities=["Free WiFi", "Fitness Center", "Rooftop Lounge", "Complimentary Breakfast"],
                booking_url=f"https://www.google.com/travel/hotels?q={city_clean}+hotels",
                provider="amadeus",
            ),
            AmadeusHotelOffer(
                id=f"ama-{city_clean.lower()}-3",
                hotel_name=f"Courtyard by Marriott {city_clean}",
                hotel_id=f"HOTEL-{city_clean.upper()}-03",
                city=city_clean,
                check_in=check_in,
                check_out=check_out,
                room_type="Premium Double Room",
                price_total=120.0,
                currency="USD",
                rating=4.5,
                amenities=["Pool", "Gym", "Restaurant", "Business Center"],
                booking_url=f"https://www.google.com/travel/hotels?q={city_clean}+hotels",
                provider="amadeus",
            ),
        ]

    async def search_hotel_offers(
        self,
        city_code_or_name: str,
        check_in_date: Optional[str] = None,
        check_out_date: Optional[str] = None,
        adults: int = 2,
        room_quantity: int = 1,
        price_max: Optional[float] = None,
    ) -> AmadeusResponse:
        """Search hotels and live rate offers for a city."""
        today = datetime.now(timezone.utc)
        check_in = check_in_date or (today + timedelta(days=7)).strftime("%Y-%m-%d")
        check_out = check_out_date or (today + timedelta(days=12)).strftime("%Y-%m-%d")

        token = await self._get_token()
        if not token:
            # Return realistic fallback inventory
            offers = self._get_fallback_offers(city_code_or_name, check_in, check_out)
            if price_max:
                offers = [o for o in offers if o.price_total <= price_max]
            return AmadeusResponse(
                query=city_code_or_name,
                offers=offers,
                source="amadeus_fallback",
                status="OK",
            )

        headers = {"Authorization": f"Bearer {token}"}
        # Step 1: Find hotels in city
        url = f"{self.base_url}/v1/reference-data/locations/hotels/by-city"
        params = {"cityCode": city_code_or_name[:3].upper()}

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    data = res.json()
                    hotel_list = data.get("data", [])[:5]
                    hotel_ids = [h.get("hotelId") for h in hotel_list if h.get("hotelId")]

                    if hotel_ids:
                        # Step 2: Query offers
                        offers_url = f"{self.base_url}/v3/shopping/hotel-offers"
                        offers_params = {
                            "hotelIds": ",".join(hotel_ids),
                            "adults": adults,
                            "checkInDate": check_in,
                            "checkOutDate": check_out,
                        }
                        offers_res = await client.get(offers_url, headers=headers, params=offers_params)
                        if offers_res.status_code == 200:
                            offers_data = offers_res.json()
                            results = []
                            for item in offers_data.get("data", []):
                                hotel = item.get("hotel", {})
                                raw_offers = item.get("offers", [])
                                if raw_offers:
                                    first_offer = raw_offers[0]
                                    price = float(first_offer.get("price", {}).get("total", 100.0))
                                    results.append(
                                        AmadeusHotelOffer(
                                            id=f"ama-{item.get('id', hotel.get('hotelId'))}",
                                            hotel_name=hotel.get("name", "Boutique Hotel"),
                                            hotel_id=hotel.get("hotelId", ""),
                                            city=city_code_or_name,
                                            check_in=check_in,
                                            check_out=check_out,
                                            room_type=first_offer.get("room", {}).get("typeEstimated", {}).get("category", "Standard"),
                                            price_total=price,
                                            currency=first_offer.get("price", {}).get("currency", "USD"),
                                            rating=4.5,
                                            booking_url=f"https://www.google.com/travel/hotels?q={hotel.get('name')}",
                                        )
                                    )
                            if results:
                                return AmadeusResponse(query=city_code_or_name, offers=results)

            return AmadeusResponse(
                query=city_code_or_name,
                offers=self._get_fallback_offers(city_code_or_name, check_in, check_out),
                source="amadeus_fallback",
            )
        except Exception as e:
            log.warning("amadeus_search_exception", error=str(e))
            return AmadeusResponse(
                query=city_code_or_name,
                offers=self._get_fallback_offers(city_code_or_name, check_in, check_out),
                source="amadeus_fallback",
            )

    async def check_health(self) -> Dict[str, Any]:
        """Verify Amadeus credentials and API health."""
        if not self.client_id or not self.client_secret:
            return {"provider": "amadeus", "status": "fallback_mode", "message": "Using fallback inventory"}
        token = await self._get_token()
        if token:
            return {"provider": "amadeus", "status": "healthy", "authenticated": True}
        return {"provider": "amadeus", "status": "degraded", "error": "Authentication failed, fallback active"}


amadeus_client = AmadeusClient()
