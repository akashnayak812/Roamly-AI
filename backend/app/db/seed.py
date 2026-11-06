"""
Seed database with curated destination, attraction and demo data.
"""
import asyncio
import json
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import AsyncSessionLocal, engine, Base
from app.models.models import Destination, Attraction, User, UserRole
from app.core.security import get_password_hash

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "processed"


async def seed():
    print("Beginning database seed...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed demo user
        user_res = await session.execute(select(User).where(User.email == "anya.sharma@example.com"))
        if not user_res.scalar_one_or_none():
            demo_user = User(
                email="anya.sharma@example.com",
                hashed_password=get_password_hash("password123"),
                full_name="Anya Sharma",
                role=UserRole.TRAVELER,
                travel_style="relaxed",
                budget_tier="moderate",
                interests=["Nature", "Food", "Photography", "Culture"],
                preferred_currency="INR",
            )
            session.add(demo_user)
            print("Created demo user: anya.sharma@example.com")

        # 2. Seed destinations
        dest_file = DATA_DIR / "destinations.json"
        if dest_file.exists():
            with open(dest_file, "r") as f:
                destinations_data = json.load(f)

            for d in destinations_data:
                exists = await session.execute(
                    select(Destination).where(Destination.slug == d["slug"])
                )
                if not exists.scalar_one_or_none():
                    dest = Destination(
                        name=d["name"],
                        slug=d["slug"],
                        country=d["country"],
                        state=d.get("state"),
                        region=d.get("region"),
                        continent=d.get("continent"),
                        latitude=d.get("latitude"),
                        longitude=d.get("longitude"),
                        description=d.get("description"),
                        ai_summary=d.get("ai_summary"),
                        hero_image_url=d.get("hero_image_url"),
                        best_time_to_visit=d.get("best_time_to_visit"),
                        climate_type=d.get("climate_type"),
                        avg_rating=d.get("avg_rating", 4.5),
                        review_count=d.get("review_count", 100),
                        safety_score=d.get("safety_score", 90),
                        popularity_score=d.get("popularity_score", 90),
                        avg_daily_cost_min=d.get("avg_daily_cost_min", 50),
                        avg_daily_cost_max=d.get("avg_daily_cost_max", 150),
                        cost_currency=d.get("cost_currency", "USD"),
                        categories=d.get("categories", []),
                        tags=d.get("tags", []),
                        is_romantic=d.get("is_romantic", False),
                        is_family_friendly=d.get("is_family_friendly", True),
                    )
                    session.add(dest)
                    print(f"Added destination: {d['name']}")

        await session.commit()
        print("Seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
