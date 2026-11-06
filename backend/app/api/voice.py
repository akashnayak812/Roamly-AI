"""Voice API adapter — STT and TTS via Sarvam AI and configured Voice APIs."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import base64
import io
from app.core.config import settings

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice: str = "default"


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = "en",
):
    """Convert voice to text using Sarvam AI or configured Voice API."""
    if not settings.VOICE_API_KEY or not settings.VOICE_API_BASE_URL:
        # Fallback: return empty transcription with warning
        return {"text": "", "warning": "Voice API not configured", "language": language}

    audio_bytes = await audio.read()
    async with httpx.AsyncClient() as client:
        try:
            headers = {
                "Authorization": f"Bearer {settings.VOICE_API_KEY}",
                "api-subscription-key": settings.VOICE_API_KEY,
            }

            # First-class Sarvam AI support
            if "sarvam.ai" in settings.VOICE_API_BASE_URL:
                url = f"{settings.VOICE_API_BASE_URL.rstrip('/')}/speech-to-text"
                data = {
                    "language_code": "en-IN" if language.startswith("en") else language,
                    "model": "saaras:v2",
                }
                files = {"file": (audio.filename or "audio.wav", audio_bytes, audio.content_type or "audio/wav")}
            else:
                url = f"{settings.VOICE_API_BASE_URL.rstrip('/')}/transcribe"
                data = {"language": language}
                files = {"audio": (audio.filename or "audio.wav", audio_bytes, audio.content_type or "audio/wav")}

            response = await client.post(
                url,
                headers=headers,
                files=files,
                data=data,
                timeout=30.0,
            )
            response.raise_for_status()
            res_json = response.json()
            transcript = res_json.get("transcript") or res_json.get("text") or ""
            return {"text": transcript, "raw": res_json, "language": language}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Voice API error: {str(e)}")


@router.post("/synthesize")
async def synthesize_speech(payload: TTSRequest):
    """Convert text to speech using Sarvam AI or configured Voice API."""
    if not settings.VOICE_API_KEY or not settings.VOICE_API_BASE_URL:
        raise HTTPException(status_code=503, detail="Voice API not configured")

    async with httpx.AsyncClient() as client:
        try:
            headers = {
                "Authorization": f"Bearer {settings.VOICE_API_KEY}",
                "api-subscription-key": settings.VOICE_API_KEY,
                "Content-Type": "application/json",
            }

            if "sarvam.ai" in settings.VOICE_API_BASE_URL:
                url = f"{settings.VOICE_API_BASE_URL.rstrip('/')}/text-to-speech"
                req_json = {
                    "inputs": [payload.text],
                    "target_language_code": "en-IN" if payload.language.startswith("en") else payload.language,
                    "speaker": payload.voice if payload.voice in ["aditya", "priya", "kavya", "rahul", "ritu", "rohan"] else "aditya",
                    "model": "bulbul:v3",
                }
            else:
                url = f"{settings.VOICE_API_BASE_URL.rstrip('/')}/synthesize"
                req_json = {"text": payload.text, "language": payload.language, "voice": payload.voice}

            response = await client.post(
                url,
                headers=headers,
                json=req_json,
                timeout=30.0,
            )
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                data = response.json()
                audios = data.get("audios", [])
                if audios:
                    audio_data = base64.b64decode(audios[0])
                    return StreamingResponse(
                        io.BytesIO(audio_data),
                        media_type="audio/wav",
                        headers={"Content-Disposition": "attachment; filename=response.wav"},
                    )
                return data

            return StreamingResponse(
                response.aiter_bytes(),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "attachment; filename=response.mp3"},
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Voice synthesis error: {str(e)}")
