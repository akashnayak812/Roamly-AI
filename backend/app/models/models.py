"""
SQLAlchemy ORM Models — Roamly AI
All models include timestamps, soft-delete, and audit fields.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Text, Float, Integer, Boolean, DateTime, JSON, ForeignKey,
    Enum as SAEnum, Index, func, ARRAY
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
import enum

from app.db.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class TripStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    SHARED = "shared"

class TravelPace(str, enum.Enum):
    RELAXED = "relaxed"
    MODERATE = "moderate"
    FAST = "fast"

class SavedItemType(str, enum.Enum):
    DESTINATION = "destination"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    ATTRACTION = "attraction"
    ACTIVITY = "activity"

class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class DocumentCategory(str, enum.Enum):
    DESTINATION = "destination"
    ATTRACTION = "attraction"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    ACTIVITY = "activity"
    REVIEW = "review"
    BLOG = "blog"
    GUIDE = "guide"
    SAFETY = "safety"
    VISA = "visa"
    TRANSPORT = "transport"
    WEATHER = "weather"


# ── Mixins ─────────────────────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class SoftDeleteMixin:
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


# ── User Models ────────────────────────────────────────────────────────────

class User(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    firebase_uid: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)

    # Relationships
    preferences: Mapped[Optional["UserPreferences"]] = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    trips: Mapped[List["Trip"]] = relationship("Trip", back_populates="user", cascade="all, delete-orphan")
    saved_items: Mapped[List["SavedItem"]] = relationship("SavedItem", back_populates="user", cascade="all, delete-orphan")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    chat_sessions: Mapped[List["ChatSession"]] = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    reviews: Mapped[List["Review"]] = relationship("Review", back_populates="user")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class UserPreferences(TimestampMixin, Base):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Travel preferences
    travel_interests: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    preferred_pace: Mapped[str] = mapped_column(String(50), default="moderate")
    budget_range_min: Mapped[Optional[float]] = mapped_column(Float)
    budget_range_max: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    preferred_regions: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    food_preferences: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    accessibility_needs: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    preferred_transport: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    travel_style: Mapped[Optional[str]] = mapped_column(String(100))
    language: Mapped[str] = mapped_column(String(10), default="en")

    # Privacy
    share_activity: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_recommendations: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship("User", back_populates="preferences")


class RefreshToken(TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


# ── Destination Models ─────────────────────────────────────────────────────

class Destination(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "destinations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    region: Mapped[Optional[str]] = mapped_column(String(100))
    continent: Mapped[Optional[str]] = mapped_column(String(100))

    # Location
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)

    # Content
    description: Mapped[Optional[str]] = mapped_column(Text)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    hero_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    gallery_images: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)

    # Metadata
    categories: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    best_time_to_visit: Mapped[Optional[str]] = mapped_column(String(255))
    climate_type: Mapped[Optional[str]] = mapped_column(String(100))
    language_spoken: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    currency_used: Mapped[Optional[str]] = mapped_column(String(50))
    time_zone: Mapped[Optional[str]] = mapped_column(String(100))

    # Scores
    avg_rating: Mapped[Optional[float]] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    safety_score: Mapped[Optional[float]] = mapped_column(Float)
    popularity_score: Mapped[Optional[float]] = mapped_column(Float)

    # Cost estimates
    avg_daily_cost_min: Mapped[Optional[float]] = mapped_column(Float)
    avg_daily_cost_max: Mapped[Optional[float]] = mapped_column(Float)
    cost_currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Crowd & demand
    crowd_level: Mapped[Optional[str]] = mapped_column(String(50))
    is_hidden_gem: Mapped[bool] = mapped_column(Boolean, default=False)
    is_family_friendly: Mapped[bool] = mapped_column(Boolean, default=True)
    is_romantic: Mapped[bool] = mapped_column(Boolean, default=False)

    # Full-text search
    search_vector: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    attractions: Mapped[List["Attraction"]] = relationship("Attraction", back_populates="destination", cascade="all, delete-orphan")
    hotels: Mapped[List["Hotel"]] = relationship("Hotel", back_populates="destination", cascade="all, delete-orphan")
    restaurants: Mapped[List["Restaurant"]] = relationship("Restaurant", back_populates="destination", cascade="all, delete-orphan")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="destination", cascade="all, delete-orphan")
    reviews: Mapped[List["Review"]] = relationship("Review", back_populates="destination")

    __table_args__ = (
        Index("ix_destinations_country", "country"),
        Index("ix_destinations_categories", "categories", postgresql_using="gin"),
    )


class Attraction(TimestampMixin, Base):
    __tablename__ = "attractions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    avg_rating: Mapped[Optional[float]] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)
    cost_currency: Mapped[str] = mapped_column(String(10), default="USD")
    opening_hours: Mapped[Optional[dict]] = mapped_column(JSONB)
    distance_from_center_km: Mapped[Optional[float]] = mapped_column(Float)
    is_free: Mapped[bool] = mapped_column(Boolean, default=False)

    destination: Mapped["Destination"] = relationship("Destination", back_populates="attractions")


class Hotel(TimestampMixin, Base):
    __tablename__ = "hotels"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    destination_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    star_rating: Mapped[Optional[float]] = mapped_column(Float)
    avg_guest_rating: Mapped[Optional[float]] = mapped_column(Float, index=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    gallery_images: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    price_per_night_min: Mapped[Optional[float]] = mapped_column(Float, index=True)
    price_per_night_max: Mapped[Optional[float]] = mapped_column(Float, index=True)
    price_currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    amenities: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    is_pet_friendly: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    is_family_friendly: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    has_pool: Mapped[bool] = mapped_column(Boolean, default=False)
    has_spa: Mapped[bool] = mapped_column(Boolean, default=False)
    booking_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Location, Provenance & Data Quality
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    continent: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    destination_slug: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    source: Mapped[Optional[str]] = mapped_column(String(100), default="hotels.csv")
    source_row: Mapped[Optional[int]] = mapped_column(Integer)
    is_live_data: Mapped[bool] = mapped_column(Boolean, default=False)
    data_quality_flags: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    raw_source_fields: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Live API enrichment fields
    static_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    live_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    live_currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    availability_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    live_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    live_retrieved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    destination: Mapped[Optional["Destination"]] = relationship("Destination", back_populates="hotels")


class Restaurant(TimestampMixin, Base):
    __tablename__ = "restaurants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    cuisine_types: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    avg_rating: Mapped[Optional[float]] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    price_range: Mapped[Optional[str]] = mapped_column(String(20))
    avg_meal_cost: Mapped[Optional[float]] = mapped_column(Float)
    cost_currency: Mapped[str] = mapped_column(String(10), default="USD")
    opening_hours: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_vegetarian_friendly: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vegan_friendly: Mapped[bool] = mapped_column(Boolean, default=False)
    serves_alcohol: Mapped[bool] = mapped_column(Boolean, default=False)

    destination: Mapped["Destination"] = relationship("Destination", back_populates="restaurants")


class Activity(TimestampMixin, Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    avg_rating: Mapped[Optional[float]] = mapped_column(Float)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    cost_per_person: Mapped[Optional[float]] = mapped_column(Float)
    cost_currency: Mapped[str] = mapped_column(String(10), default="USD")
    difficulty_level: Mapped[Optional[str]] = mapped_column(String(50))
    is_group_activity: Mapped[bool] = mapped_column(Boolean, default=False)
    min_age: Mapped[Optional[int]] = mapped_column(Integer)
    max_group_size: Mapped[Optional[int]] = mapped_column(Integer)
    booking_required: Mapped[bool] = mapped_column(Boolean, default=False)

    destination: Mapped["Destination"] = relationship("Destination", back_populates="activities")


# ── Trip Models ─────────────────────────────────────────────────────────────

class Trip(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TripStatus] = mapped_column(SAEnum(TripStatus), default=TripStatus.DRAFT)
    destination_summary: Mapped[Optional[str]] = mapped_column(String(500))
    hero_image_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Trip details
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    num_travelers: Mapped[int] = mapped_column(Integer, default=1)
    pace: Mapped[str] = mapped_column(String(50), default="moderate")
    budget_total: Mapped[Optional[float]] = mapped_column(Float)
    budget_currency: Mapped[str] = mapped_column(String(10), default="USD")
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)

    # Sharing
    share_token: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI metadata
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_parameters: Mapped[Optional[dict]] = mapped_column(JSONB)
    chat_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="trips")
    days: Mapped[List["TripDay"]] = relationship("TripDay", back_populates="trip", cascade="all, delete-orphan", order_by="TripDay.day_number")
    chat_session: Mapped[Optional["ChatSession"]] = relationship("ChatSession")

    __table_args__ = (
        Index("ix_trips_user_status", "user_id", "status"),
    )


class TripDay(TimestampMixin, Base):
    __tablename__ = "trip_days"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    hero_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)
    weather_summary: Mapped[Optional[str]] = mapped_column(String(500))

    trip: Mapped["Trip"] = relationship("Trip", back_populates="days")
    trip_activities: Mapped[List["TripActivity"]] = relationship("TripActivity", back_populates="trip_day", cascade="all, delete-orphan", order_by="TripActivity.order_index")


class TripActivity(TimestampMixin, Base):
    __tablename__ = "trip_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_day_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trip_days.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    activity_type: Mapped[Optional[str]] = mapped_column(String(100))
    start_time: Mapped[Optional[str]] = mapped_column(String(10))
    duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)
    cost_currency: Mapped[str] = mapped_column(String(10), default="USD")
    avg_rating: Mapped[Optional[float]] = mapped_column(Float)
    review_count: Mapped[Optional[int]] = mapped_column(Integer)
    travel_time_from_prev_mins: Mapped[Optional[int]] = mapped_column(Integer)
    travel_distance_km: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    booking_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Reference to source entities
    attraction_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("attractions.id"), nullable=True)
    hotel_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("hotels.id"), nullable=True)
    restaurant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=True)
    activity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=True)

    trip_day: Mapped["TripDay"] = relationship("TripDay", back_populates="trip_activities")


# ── Review Model ───────────────────────────────────────────────────────────

class Review(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    destination_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    author_name: Mapped[Optional[str]] = mapped_column(String(255))
    source: Mapped[Optional[str]] = mapped_column(String(100))
    source_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Sentiment analysis results
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)
    aspect_sentiments: Mapped[Optional[dict]] = mapped_column(JSONB)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="reviews")
    destination: Mapped[Optional["Destination"]] = relationship("Destination", back_populates="reviews")


# ── Saved Items & Collections ──────────────────────────────────────────────

class Collection(TimestampMixin, Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="collections")
    saved_items: Mapped[List["SavedItem"]] = relationship("SavedItem", back_populates="collection")


class SavedItem(TimestampMixin, Base):
    __tablename__ = "saved_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("collections.id"), nullable=True)
    item_type: Mapped[SavedItemType] = mapped_column(SAEnum(SavedItemType), nullable=False)
    item_id: Mapped[str] = mapped_column(String(64), nullable=False)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_image_url: Mapped[Optional[str]] = mapped_column(String(500))
    item_metadata: Mapped[Optional[dict]] = mapped_column(JSONB)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["User"] = relationship("User", back_populates="saved_items")
    collection: Mapped[Optional["Collection"]] = relationship("Collection", back_populates="saved_items")

    __table_args__ = (
        Index("ix_saved_items_user_type", "user_id", "item_type"),
    )


# ── Chat Models ─────────────────────────────────────────────────────────────

class ChatSession(TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trip_parameters: Mapped[Optional[dict]] = mapped_column(JSONB)

    user: Mapped["User"] = relationship("User", back_populates="chat_sessions")
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[MessageRole] = mapped_column(SAEnum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_calls: Mapped[Optional[List[dict]]] = mapped_column(JSONB)
    citations: Mapped[Optional[List[dict]]] = mapped_column(JSONB)
    message_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)
    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


# ── RAG / Document Models ──────────────────────────────────────────────────

class Document(TimestampMixin, Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_name: Mapped[Optional[str]] = mapped_column(String(255))
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    title: Mapped[Optional[str]] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    language: Mapped[str] = mapped_column(String(10), default="en")
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    doc_metadata: Mapped[Optional[dict]] = mapped_column(JSONB)
    description: Mapped[Optional[str]] = mapped_column(Text)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255))
    file_type: Mapped[Optional[str]] = mapped_column(String(20))
    storage_path: Mapped[Optional[str]] = mapped_column(String(1000))
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    access_scope: Mapped[str] = mapped_column(String(20), nullable=False, default="global", server_default="global", index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed", server_default="completed", index=True)
    total_chunks: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tags: Mapped[Optional[List[str]]] = mapped_column(JSONB)

    chunks: Mapped[List["DocumentChunk"]] = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(TimestampMixin, Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768))
    chunk_metadata: Mapped[Optional[dict]] = mapped_column(JSONB)
    page_number: Mapped[Optional[int]] = mapped_column(Integer)

    # Full-text search
    search_vector: Mapped[Optional[str]] = mapped_column(Text)

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("ix_document_chunks_embedding", "embedding", postgresql_using="ivfflat", postgresql_with={"lists": 100}),
    )


class DocumentProcessingJob(TimestampMixin, Base):
    __tablename__ = "document_processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


# ── Recommendation & ML Models ─────────────────────────────────────────────

class Recommendation(TimestampMixin, Base):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    algorithm: Mapped[Optional[str]] = mapped_column(String(100))
    reason: Mapped[Optional[str]] = mapped_column(Text)
    is_clicked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)


class WeatherRecord(TimestampMixin, Base):
    __tablename__ = "weather_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    destination_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id"), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    temperature_c: Mapped[Optional[float]] = mapped_column(Float)
    feels_like_c: Mapped[Optional[float]] = mapped_column(Float)
    humidity_pct: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    wind_speed_ms: Mapped[Optional[float]] = mapped_column(Float)
    visibility_m: Mapped[Optional[float]] = mapped_column(Float)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)


# ── Normalized Tourism Places & Multi-Source Models ─────────────────────────

class Place(TimestampMixin, SoftDeleteMixin, Base):
    """
    Unified normalized place entity matching all providers (Google Places,
    Amadeus, SerpApi, internal datasets).
    """
    __tablename__ = "places"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    provider: Mapped[str] = mapped_column(String(50), default="internal", index=True) # google_places, serpapi, amadeus, dataset
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # destination, attraction, restaurant, hotel, activity
    description: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    region: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, index=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    rating: Mapped[Optional[float]] = mapped_column(Float, index=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    price_level: Mapped[Optional[int]] = mapped_column(Integer) # 1-4
    price_range: Mapped[Optional[str]] = mapped_column(String(50))
    opening_hours: Mapped[Optional[dict]] = mapped_column(JSONB)
    amenities: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    cuisine_types: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    activity_types: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    gallery_images: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    source: Mapped[str] = mapped_column(String(50), default="internal")
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    data_freshness: Mapped[str] = mapped_column(String(50), default="static") # live, cached, static, dataset
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    search_vector: Mapped[Optional[str]] = mapped_column(Text)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)

    __table_args__ = (
        Index("ix_places_cat_city", "category", "city"),
        Index("ix_places_lat_lng", "latitude", "longitude"),
    )


class Event(TimestampMixin, SoftDeleteMixin, Base):
    """Local tourism events and festivals."""
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ticket_url: Mapped[Optional[str]] = mapped_column(String(500))
    price: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(50), default="serpapi")
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=func.now())


class HotelOffer(TimestampMixin, Base):
    """Amadeus & live booking hotel availability and pricing offers."""
    __tablename__ = "hotel_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    hotel_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hotel_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("hotels.id"), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    check_in: Mapped[Optional[str]] = mapped_column(String(20))
    check_out: Mapped[Optional[str]] = mapped_column(String(20))
    room_type: Mapped[Optional[str]] = mapped_column(String(100))
    price_total: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    provider: Mapped[str] = mapped_column(String(50), default="amadeus") # amadeus, serpapi, direct
    booking_url: Mapped[Optional[str]] = mapped_column(String(500))
    availability_status: Mapped[str] = mapped_column(String(50), default="available")
    amenities: Mapped[Optional[List[str]]] = mapped_column(JSONB, default=list)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=func.now())


class TransportOption(TimestampMixin, Base):
    """Directions, routes, distance, and transit options."""
    __tablename__ = "transport_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    transport_mode: Mapped[str] = mapped_column(String(50), default="driving") # driving, transit, flight, walking, bicycling
    distance_km: Mapped[Optional[float]] = mapped_column(Float)
    duration_mins: Mapped[Optional[int]] = mapped_column(Integer)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    carrier_or_route: Mapped[Optional[str]] = mapped_column(String(255))
    polyline: Mapped[Optional[str]] = mapped_column(Text)
    departure_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    arrival_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    booking_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(50), default="google_maps")
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=func.now())


class LiveSearchResultRecord(TimestampMixin, Base):
    """Persisted live web search result for audit, provenance and cache."""
    __tablename__ = "live_search_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    snippet: Mapped[Optional[str]] = mapped_column(Text)
    source_name: Mapped[Optional[str]] = mapped_column(String(255))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(50), default="general")
    location: Mapped[Optional[str]] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(50), default="serpapi")
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB)


class ApiCache(TimestampMixin, Base):
    """Relational cache table for multi-provider API responses."""
    __tablename__ = "api_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cache_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(100))
    response_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class SourceCitation(TimestampMixin, Base):
    """Source citations attached to grounded answers and recommendations."""
    __tablename__ = "source_citations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    snippet: Mapped[Optional[str]] = mapped_column(Text)
    reliability_score: Mapped[float] = mapped_column(Float, default=1.0)
    last_verified: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=func.now())

