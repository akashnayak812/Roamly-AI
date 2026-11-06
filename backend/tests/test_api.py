"""
Test suite for Roamly AI backend.
"""
import pytest
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.core.config import settings


def test_password_hashing():
    pw = "SuperSecret123!"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_roundtrip():
    user_id = "test-user-12345"
    token = create_access_token(user_id=user_id, email="test@example.com")
    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded["sub"] == user_id
    assert decoded["email"] == "test@example.com"


def test_settings_load():
    assert settings.APP_NAME == "Roamly AI"
    assert settings.APP_VERSION is not None
