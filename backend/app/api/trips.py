"""
Trips API — CRUD, AI generation, sharing, export.
"""
import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
import structlog

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Trip, TripDay, TripActivity, TripStatus, Hotel
from app.services.gemini_service import gemini_service
from app.services.hotel_recommendation_service import hotel_recommendation_service, HotelRecommendationInput
from app.rag.retrieval import rag_pipeline

router = APIRouter()
log = structlog.get_logger()


class CreateTripRequest(BaseModel):
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    num_travelers: int = 1
    pace: str = "moderate"
    budget_total: Optional[float] = None
    budget_currency: str = "USD"
    ai_parameters: Optional[dict] = None


class GenerateItineraryRequest(BaseModel):
    destination: str
    duration_days: int
    travelers: int = 1
    budget: Optional[float] = None
    currency: str = "USD"
    interests: List[str] = []
    travel_style: str = "moderate"
    start_date: Optional[str] = None


class UpdateActivityRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    duration_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None
    order_index: Optional[int] = None


class AddHotelToTripRequest(BaseModel):
    hotel_id: str
    day_number: Optional[int] = 1
    notes: Optional[str] = None
    custom_price: Optional[float] = None


def trip_to_dict(trip: Trip) -> dict:
    return {
        "id": str(trip.id),
        "title": trip.title,
        "status": trip.status.value,
        "destination_summary": trip.destination_summary,
        "hero_image_url": trip.hero_image_url,
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
        "num_travelers": trip.num_travelers,
        "pace": trip.pace,
        "budget_total": trip.budget_total,
        "budget_currency": trip.budget_currency,
        "estimated_cost": trip.estimated_cost,
        "share_token": trip.share_token,
        "is_public": trip.is_public,
        "ai_generated": trip.ai_generated,
        "created_at": trip.created_at.isoformat(),
        "updated_at": trip.updated_at.isoformat(),
    }


def day_to_dict(day: TripDay) -> dict:
    return {
        "id": str(day.id),
        "day_number": day.day_number,
        "date": day.date.isoformat() if day.date else None,
        "location": day.location,
        "description": day.description,
        "hero_image_url": day.hero_image_url,
        "estimated_cost": day.estimated_cost,
        "weather_summary": day.weather_summary,
        "activities": [activity_to_dict(a) for a in (day.trip_activities or [])],
    }


def activity_to_dict(a: TripActivity) -> dict:
    return {
        "id": str(a.id),
        "order_index": a.order_index,
        "name": a.name,
        "description": a.description,
        "activity_type": a.activity_type,
        "start_time": a.start_time,
        "duration_hours": a.duration_hours,
        "image_url": a.image_url,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "address": a.address,
        "estimated_cost": a.estimated_cost,
        "cost_currency": a.cost_currency,
        "avg_rating": a.avg_rating,
        "review_count": a.review_count,
        "travel_time_from_prev_mins": a.travel_time_from_prev_mins,
        "travel_distance_km": a.travel_distance_km,
        "notes": a.notes,
        "booking_url": a.booking_url,
    }


@router.get("")
async def list_trips(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Trip).where(
        Trip.user_id == current_user.id,
        Trip.deleted_at.is_(None),
    )
    if status:
        query = query.where(Trip.status == status)
    query = query.order_by(Trip.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    trips = result.scalars().all()
    return [trip_to_dict(t) for t in trips]


@router.post("", status_code=201)
async def create_trip(
    payload: CreateTripRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = Trip(
        user_id=current_user.id,
        title=payload.title,
        start_date=datetime.fromisoformat(payload.start_date) if payload.start_date else None,
        end_date=datetime.fromisoformat(payload.end_date) if payload.end_date else None,
        num_travelers=payload.num_travelers,
        pace=payload.pace,
        budget_total=payload.budget_total,
        budget_currency=payload.budget_currency,
        ai_parameters=payload.ai_parameters,
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip_to_dict(trip)


@router.get("/{trip_id}")
async def get_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.deleted_at.is_(None))
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Check ownership or public
    if str(trip.user_id) != str(current_user.id) and not trip.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    # Load days with activities
    days_result = await db.execute(
        select(TripDay)
        .where(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number)
    )
    days = days_result.scalars().all()
    for day in days:
        acts_result = await db.execute(
            select(TripActivity)
            .where(TripActivity.trip_day_id == day.id)
            .order_by(TripActivity.order_index)
        )
        day.trip_activities = acts_result.scalars().all()

    data = trip_to_dict(trip)
    data["days"] = [day_to_dict(d) for d in days]
    return data


@router.post("/{trip_id}/generate")
async def generate_itinerary(
    trip_id: str,
    payload: GenerateItineraryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI itinerary and save to trip."""
    # Verify ownership
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # RAG retrieval for destination context
    context_docs, _ = await rag_pipeline.retrieve(
        query=f"{payload.destination} travel itinerary attractions restaurants hotels",
        db=db,
        filters={"owner_user_id": current_user.id},
        top_k=10,
    )

    # Generate itinerary via Gemini
    try:
        itinerary_data = await gemini_service.generate_itinerary(
            trip_parameters={
                "destination": payload.destination,
                "duration_days": payload.duration_days,
                "travelers": payload.travelers,
                "budget": payload.budget,
                "currency": payload.currency,
                "interests": payload.interests,
                "travel_style": payload.travel_style,
                "start_date": payload.start_date,
            },
            context_docs=context_docs,
        )
    except Exception as e:
        log.error("itinerary_generation_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate itinerary. Please try again.")

    # Clear existing days
    existing_days = await db.execute(select(TripDay).where(TripDay.trip_id == trip.id))
    for day in existing_days.scalars().all():
        await db.delete(day)

    # 1. Search and rank hotels for this destination and budget
    top_hotel = None
    try:
        hotel_recs = await hotel_recommendation_service.recommend(
            db=db,
            inputs=HotelRecommendationInput(
                destination=payload.destination,
                budget=payload.budget,
                travelers=payload.travelers,
                preferred_amenities=payload.interests,
                travel_style=payload.travel_style,
            ),
            limit=3,
        )
        if hotel_recs:
            top_hotel = hotel_recs[0]
    except Exception as he:
        log.warning("itinerary_hotel_search_fallback", error=str(he))

    # Update trip metadata
    trip.title = itinerary_data.get("trip_title", f"{payload.destination} Trip")
    trip.destination_summary = itinerary_data.get("destination_summary", "")

    base_estimate = itinerary_data.get("total_estimated_cost") or 0.0
    if top_hotel and top_hotel.get("static_price"):
        # Add hotel nightly estimate across trip duration
        hotel_nightly = top_hotel["static_price"]
        hotel_total = hotel_nightly * max(payload.duration_days - 1, 1)
        trip.estimated_cost = round(base_estimate + hotel_total, 2)
    else:
        trip.estimated_cost = base_estimate

    trip.budget_currency = itinerary_data.get("cost_currency", payload.currency)
    trip.ai_generated = True
    trip.ai_parameters = payload.dict()
    trip.status = TripStatus.ACTIVE

    # Create days
    for day_data in itinerary_data.get("days", []):
        trip_day = TripDay(
            trip_id=trip.id,
            day_number=day_data["day_number"],
            location=day_data.get("location", ""),
            description=day_data.get("description", ""),
            estimated_cost=day_data.get("estimated_cost"),
        )
        if payload.start_date:
            from datetime import timedelta
            start = datetime.fromisoformat(payload.start_date)
            trip_day.date = start + timedelta(days=day_data["day_number"] - 1)

        db.add(trip_day)
        await db.flush()

        for idx, act_data in enumerate(day_data.get("activities", [])):
            activity = TripActivity(
                trip_day_id=trip_day.id,
                order_index=idx,
                name=act_data.get("name", ""),
                description=act_data.get("description", ""),
                activity_type=act_data.get("activity_type"),
                start_time=act_data.get("start_time"),
                duration_hours=act_data.get("duration_hours"),
                image_url=act_data.get("image_url"),
                latitude=act_data.get("latitude"),
                longitude=act_data.get("longitude"),
                address=act_data.get("address"),
                estimated_cost=act_data.get("estimated_cost"),
                cost_currency=act_data.get("cost_currency", payload.currency),
                avg_rating=act_data.get("avg_rating"),
                review_count=act_data.get("review_count"),
                travel_time_from_prev_mins=act_data.get("travel_time_from_prev_mins"),
            )
            db.add(activity)

    await db.commit()

    # Return full trip
    return await get_trip(trip_id, current_user, db)


@router.patch("/{trip_id}/activities/{activity_id}")
async def update_activity(
    trip_id: str,
    activity_id: str,
    payload: UpdateActivityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a single trip activity."""
    # Verify ownership
    trip_result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    if not trip_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    act_result = await db.execute(
        select(TripActivity).where(TripActivity.id == activity_id)
    )
    activity = act_result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(activity, field, value)

    await db.commit()
    return activity_to_dict(activity)


@router.delete("/{trip_id}/activities/{activity_id}")
async def delete_activity(
    trip_id: str,
    activity_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trip_result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    if not trip_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    act_result = await db.execute(select(TripActivity).where(TripActivity.id == activity_id))
    activity = act_result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    await db.delete(activity)
    await db.commit()
    return {"message": "Activity removed"}


@router.post("/{trip_id}/share")
async def share_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if not trip.share_token:
        trip.share_token = str(uuid.uuid4())
    trip.is_public = True
    await db.commit()

    return {"share_token": trip.share_token, "share_url": f"/trips/shared/{trip.share_token}"}


@router.delete("/{trip_id}")
async def delete_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id, Trip.deleted_at.is_(None))
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Trip deleted"}


@router.post("/{trip_id}/hotel")
async def add_hotel_to_trip(
    trip_id: str,
    payload: AddHotelToTripRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Select and attach a hotel to the trip itinerary, updating estimated budget."""
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    hotel_result = await db.execute(select(Hotel).where(Hotel.id == payload.hotel_id))
    hotel = hotel_result.scalar_one_or_none()
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    # Find target day
    day_result = await db.execute(
        select(TripDay).where(TripDay.trip_id == trip.id, TripDay.day_number == payload.day_number)
    )
    target_day = day_result.scalar_one_or_none()

    if not target_day:
        target_day = TripDay(
            trip_id=trip.id,
            day_number=payload.day_number or 1,
            location=hotel.city or trip.destination_summary or "Destination",
            description=f"Stay at {hotel.name}",
        )
        db.add(target_day)
        await db.flush()

    cost_val = payload.custom_price or hotel.price_per_night_min
    price_note = (
        f"Estimated rate: ${cost_val:.2f}/night. Note: Static catalog price; live availability requires verification."
        if cost_val is not None
        else "Price unavailable in static catalog; check live rates."
    )

    activity = TripActivity(
        trip_day_id=target_day.id,
        order_index=0,
        name=f"Check-in: {hotel.name}",
        description=hotel.description or f"Hotel accommodation in {hotel.city or 'destination'}.",
        activity_type="hotel",
        start_time="14:00",
        duration_hours=12.0,
        image_url=hotel.image_url,
        latitude=hotel.latitude,
        longitude=hotel.longitude,
        address=hotel.address or f"{hotel.city}, {hotel.country}",
        estimated_cost=cost_val,
        cost_currency=hotel.price_currency or "USD",
        avg_rating=hotel.avg_guest_rating,
        review_count=hotel.review_count,
        hotel_id=hotel.id,
        notes=payload.notes or price_note,
        booking_url=hotel.booking_url,
    )
    db.add(activity)

    if cost_val:
        trip.estimated_cost = round((trip.estimated_cost or 0.0) + cost_val, 2)

    await db.commit()
    return await get_trip(trip_id, current_user, db)


@router.get("/{trip_id}/hotels/recommendations")
async def get_trip_hotel_recommendations(
    trip_id: str,
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve hotels ranked specifically for this trip's destination and budget."""
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    dest_str = trip.destination_summary or trip.title
    budget_nightly = (trip.budget_total / max(trip.num_travelers, 1) / 3) if trip.budget_total else None

    recs = await hotel_recommendation_service.recommend(
        db=db,
        inputs=HotelRecommendationInput(
            destination=dest_str,
            budget=budget_nightly,
            travelers=trip.num_travelers,
            travel_style=trip.pace,
        ),
        limit=limit,
    )
    return {"trip_id": str(trip.id), "destination": dest_str, "recommendations": recs}
