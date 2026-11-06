from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.user_documents import _owned
from app.services.document_service import chunk_text


def test_owner_can_access_private_document():
    owner = SimpleNamespace(id="user-1")
    doc = SimpleNamespace(id="doc-1", owner_id="user-1", access_scope="private")
    assert _owned(doc, owner) is doc


def test_other_user_cannot_access_private_document():
    attacker = SimpleNamespace(id="user-2")
    doc = SimpleNamespace(id="doc-1", owner_id="user-1", access_scope="private")
    with pytest.raises(HTTPException) as exc:
        _owned(doc, attacker)
    assert exc.value.status_code == 404


def test_user_document_routes_do_not_allow_global_document_mutation():
    user = SimpleNamespace(id="user-1")
    global_doc = SimpleNamespace(id="doc-global", owner_id=None, access_scope="global")
    with pytest.raises(HTTPException) as exc:
        _owned(global_doc, user)
    assert exc.value.status_code == 404


def test_chunker_prefers_paragraphs_and_applies_overlap_for_long_sections():
    content = ("A" * 5000) + "\n\nSecond section has practical travel advice."
    chunks = chunk_text(content, max_chars=1000, overlap_chars=100)
    assert len(chunks) >= 5
    assert all(chunks)
    assert any("Second section" in chunk for chunk in chunks)
