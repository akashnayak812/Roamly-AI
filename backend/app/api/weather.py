"""Weather API adapter — OpenWeather with outdoor activity suitability and caching."""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any
import httpx
from app.core.config import settings
from app.integrations.weather_client import weather_client, WeatherCondition

router = APIRouter()


@router.get("/current")
async def get_current_weather(
    lat: float = Query(...),
    lon: float = Query(...),
    city: Optional[str] = Query(None),
):
    """
    Get current weather with temperature, outdoor suitability, rain probability,
    and recommended activity types.
    """
    try:
        condition = await weather_client.get_current_weather(lat=lat, lon=lon, city_name=city)
        return {
            "temperature": condition.temperature_c,
            "feels_like": condition.feels_like_c,
            "humidity": condition.humidity_pct,
            "wind_speed": condition.wind_speed_ms,
            "description": condition.description,
            "condition": condition.condition_main,
            "rain_probability_pct": condition.rain_probability_pct,
            "is_rainy": condition.is_rainy,
            "is_outdoor_friendly": condition.is_outdoor_friendly,
            "recommended_activity_types": condition.recommended_activity_types,
            "city": condition.city_name,
            "recorded_at": condition.recorded_at,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather: {str(exc)}")


@router.get("/forecast")
async def get_forecast(
    lat: float = Query(...),
    lon: float = Query(...),
    days: int = 7,
):
    """Get multi-day weather forecast."""
    if not settings.WEATHER_API_KEY:
        return {"error": "Weather API not configured", "mock": True}

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.WEATHER_API_BASE_URL}/forecast",
            params={"lat": lat, "lon": lon, "appid": settings.WEATHER_API_KEY, "units": "metric"},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()
