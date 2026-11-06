"""Normalize the supplied Indian citywise and tourist spot CSVs for Roamly search.

Usage: python backend/scripts/prepare_india_places.py \
  --source '/Users/akashdegavath/Downloads/Data' \
  --output data/processed/india_places.json
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import re
from pathlib import Path

CITY_STATES = {
    "guwahati": "Assam", "coimbatore": "Tamil Nadu", "kolkata": "West Bengal",
    "chennai": "Tamil Nadu", "delhi": "Delhi", "mumbai": "Maharashtra",
    "hyderabad": "Telangana", "chandigarh": "Chandigarh", "manali": "Himachal Pradesh",
    "palakkad": "Kerala", "bangalore": "Karnataka", "munnar": "Kerala", "pune": "Maharashtra",
}


def rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def tags(value):
    return [part.strip().lower() for part in re.split(r"[,;|]", value or "") if part.strip()]


def distance(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371 * 2 * math.atan2(math.sqrt(h), math.sqrt(1-h))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/processed/india_places.json"))
    args = parser.parse_args()
    source = args.source

    records = []
    city_centers = {}
    for path in sorted((source / "Citywise Destinations").glob("Destinations_*.csv")):
        city = path.stem.removeprefix("Destinations_").replace("_", " ").title()
        state = CITY_STATES.get(city.lower(), "")
        for row in rows(path):
            name = (row.get("Name") or row.get("POI_Name") or "").strip()
            lat, lng = number(row.get("Latitude")), number(row.get("Longitude"))
            if not name or lat is None or lng is None:
                continue
            tags_value = row.get("Characteristics", "")
            ext = f"india-city-{city.lower().replace(' ', '-')}-{row.get('DestinationID') or len(records)+1}"
            records.append({
                "external_id": ext, "name": name[:255], "category": "attraction",
                "description": tags_value.strip() or f"Visitor destination in {city}, {state}, India.",
                "city": city, "region": state, "country": "India", "latitude": lat, "longitude": lng,
                "address": None, "rating": None, "review_count": 0, "image_url": None,
                "activity_types": tags(tags_value), "source": "india_citywise_dataset",
            })
            city_centers.setdefault(city, []).append((lat, lng))

    centers = {city: (sum(x for x, _ in coords)/len(coords), sum(y for _, y in coords)/len(coords)) for city, coords in city_centers.items()}
    for row in rows(source / "Tourist_Spots.csv"):
        name = (row.get("Name") or "").strip()
        lat, lng = number(row.get("Latitude")), number(row.get("Longitude"))
        if not name or lat is None or lng is None:
            continue
        nearest, km = min(((city, distance((lat, lng), center)) for city, center in centers.items()), key=lambda pair: pair[1])
        city = nearest if km <= 180 else None
        tags_value = row.get("Characteristics", "")
        records.append({
            "external_id": f"india-tourist-spot-{row.get('DestinationID') or len(records)+1}",
            "name": name[:255], "category": "attraction",
            "description": tags_value.strip() or f"Tourist spot in {city or 'India'}.",
            "city": city, "region": CITY_STATES.get((city or "").lower()), "country": "India",
            "latitude": lat, "longitude": lng, "address": None, "rating": None, "review_count": 0,
            "image_url": None, "activity_types": tags(tags_value), "source": "india_tourist_spots_dataset",
        })

    # Stable deduplication by exact coordinates, then normalized name.
    seen = set()
    unique = []
    for place in records:
        key = (re.sub(r"[^a-z0-9]+", " ", place["name"].lower()).strip(), round(place["latitude"], 5), round(place["longitude"], 5))
        if key in seen:
            continue
        seen.add(key)
        unique.append(place)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(unique, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(unique)} Indian attractions to {args.output}")


if __name__ == "__main__":
    main()
