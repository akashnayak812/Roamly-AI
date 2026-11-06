"""Health check endpoints."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import time

router = APIRouter()

START_TIME = time.time()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "uptime_seconds": round(time.time() - START_TIME)}


@router.get("/ready")
async def readiness_check():
    return {"status": "ready", "service": "roamly-ai-backend"}
