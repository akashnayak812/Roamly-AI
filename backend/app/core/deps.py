"""
FastAPI dependency — current authenticated user.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.security import decode_access_token, get_user_by_id
from app.models.models import User
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        # The web client authenticates with Firebase. Verify its signed ID
        # token against the configured project, then map by immutable UID.
        if not settings.FIREBASE_PROJECT_ID:
            raise credentials_exception
        try:
            import asyncio
            import secrets
            from google.auth.transport.requests import Request
            from google.oauth2.id_token import verify_firebase_token
            claims = await asyncio.to_thread(verify_firebase_token, token, Request(), audience=settings.FIREBASE_PROJECT_ID)
            firebase_uid = claims.get("user_id") or claims.get("sub")
            if not firebase_uid:
                raise credentials_exception
            from sqlalchemy import select
            user = (await db.execute(select(User).where(User.firebase_uid == firebase_uid))).scalar_one_or_none()
            if user is None:
                email = claims.get("email")
                if not email:
                    raise credentials_exception
                user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
                if user is None:
                    from app.core.security import hash_password
                    user = User(email=email, full_name=claims.get("name") or email.split("@")[0],
                                hashed_password=hash_password(secrets.token_urlsafe(32)), firebase_uid=firebase_uid)
                    db.add(user)
                    await db.flush()
                else:
                    user.firebase_uid = firebase_uid
            if not user.is_active or user.is_deleted:
                raise credentials_exception
            return user
        except HTTPException:
            raise
        except Exception:
            raise credentials_exception

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active or user.is_deleted:
        raise credentials_exception
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user


async def get_optional_user(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Returns user if authenticated, None otherwise (for public endpoints)."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return await get_user_by_id(db, user_id)
    except JWTError:
        return None
