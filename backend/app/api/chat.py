"""
Chat API — AI conversation with streaming SSE responses.
"""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import structlog

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, ChatSession, ChatMessage, MessageRole
from app.services.gemini_service import gemini_service
from app.rag.retrieval import rag_pipeline

router = APIRouter()
log = structlog.get_logger()


class NewSessionRequest(BaseModel):
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    session_id: str
    content: str
    trip_parameters: Optional[dict] = None


class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    include_personal_documents: bool = True


class SessionResponse(BaseModel):
    id: str
    title: Optional[str]
    created_at: str
    message_count: int = 0


@router.post("/ask")
async def ask_roamly(payload: AskRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Ground a one-shot answer in global and the caller's private documents."""
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Message is required")
    if payload.conversation_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == payload.conversation_id, ChatSession.user_id == current_user.id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Conversation not found")
    filters = {"owner_user_id": current_user.id} if payload.include_personal_documents else None
    docs, citations, metadata = await rag_pipeline.retrieve(payload.message, db, filters=filters, top_k=8)
    answer_parts = []
    async for chunk in gemini_service.chat_stream(messages=[{"role": "user", "content": payload.message}], context_docs=docs):
        event = json.loads(chunk)
        if event.get("type") == "content":
            answer_parts.append(event.get("text", ""))
        elif event.get("type") == "error":
            # Keep the experience useful during a model outage without
            # pretending an extractive quote is a generated summary.
            source = next((item for item in citations if item.get("snippet")), None)
            if source:
                source_name = source.get("source_name") or "your travel document"
                quote = source["snippet"].strip()
                answer_parts = [f"I couldn't write a full answer just now. The closest passage in {source_name} says: “{quote}”"]
                break
            error_type = event.get("error_type", "AI service error")
            raise HTTPException(status_code=503, detail=f"Roamly couldn't generate an answer this time. Please try again. ({error_type})")
    answer = "".join(answer_parts).strip()
    if not answer:
        source = next((item for item in citations if item.get("snippet")), None)
        if source:
            answer = f"I couldn't write a full answer just now. The closest passage in {source.get('source_name') or 'your travel document'} says: “{source['snippet'].strip()}”"
        else:
            raise HTTPException(status_code=502, detail="Roamly couldn't generate an answer this time. Please try again.")
    return {"answer": answer, "citations": citations, "metadata": metadata}


@router.post("/sessions")
async def create_session(
    payload: NewSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(
        user_id=current_user.id,
        title=payload.title or "New trip",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": str(session.id),
        "title": session.title,
        "created_at": session.created_at.isoformat(),
    }


@router.get("/sessions")
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id, ChatSession.is_active.is_(True))
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "trip_parameters": s.trip_parameters,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = messages_result.scalars().all()

    return {
        "id": str(session.id),
        "title": session.title,
        "trip_parameters": session.trip_parameters,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role.value,
                "content": m.content,
                "citations": m.citations,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/messages/stream")
async def stream_message(
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream AI response via Server-Sent Events."""
    # Verify session ownership
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == payload.session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content=payload.content,
    )
    db.add(user_msg)
    await db.commit()

    # Get conversation history (last 10 messages)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history_msgs = list(reversed(history_result.scalars().all()))
    messages = [{"role": m.role.value, "content": m.content} for m in history_msgs]

    # Auto-extract trip parameters from first user message
    if len(messages) == 1:
        params = await gemini_service.extract_trip_parameters(payload.content)
        if params and not params.get("missing_fields"):
            session.trip_parameters = params
            await db.commit()

    # RAG retrieval
    query_for_rag = payload.content
    if session.trip_parameters:
        dest = session.trip_parameters.get("destination", "")
        if dest:
            query_for_rag = f"{dest} {payload.content}"

    context_docs, citations, retrieval_meta = await rag_pipeline.retrieve(
        query=query_for_rag,
        db=db,
        filters={"owner_user_id": current_user.id},
        top_k=8,
    )

    # Update session title from first message
    if not session.title or session.title == "New trip":
        session.title = payload.content[:60] + ("..." if len(payload.content) > 60 else "")
        await db.commit()

    # Collect full response for saving
    full_response = []
    final_citations = citations

    async def event_generator():
        nonlocal final_citations
        # Emit citations and live search status at start of stream
        if citations:
            yield f"data: {json.dumps({'type': 'citations', 'citations': citations, 'metadata': retrieval_meta})}\n\n"

        async for chunk in gemini_service.chat_stream(
            messages=messages,
            context_docs=context_docs,
            trip_parameters=payload.trip_parameters or session.trip_parameters,
        ):
            chunk_data = json.loads(chunk)
            if chunk_data["type"] == "content":
                full_response.append(chunk_data["text"])
            elif chunk_data["type"] == "citations":
                final_citations = chunk_data["citations"]
            yield f"data: {chunk}\n\n"

        # Save assistant message
        assistant_content = "".join(full_response)
        assistant_msg = ChatMessage(
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content=assistant_content,
            citations=final_citations,
        )
        db.add(assistant_msg)
        await db.commit()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/extract-parameters")
async def extract_parameters(
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    """Extract structured trip parameters from natural language."""
    message = payload.get("message", "")
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    params = await gemini_service.extract_trip_parameters(message)
    return params


class QuickPlanRequest(BaseModel):
    destination: str
    duration_days: int = 5
    budget: Optional[float] = 50000
    currency: str = "INR"
    travelers: str = "2 people"
    interests: List[str] = []


@router.post("/quick-plan")
async def quick_plan(payload: QuickPlanRequest):
    """Generate quick AI itinerary without requiring pre-saved trip ID or authentication."""
    try:
        plan = await gemini_service.generate_itinerary(
            trip_parameters={
                "destination": payload.destination,
                "duration_days": payload.duration_days,
                "travelers": payload.travelers,
                "budget": payload.budget,
                "currency": payload.currency,
                "interests": payload.interests,
            }
        )
        return plan
    except Exception as e:
        log.warning("quick_plan_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

