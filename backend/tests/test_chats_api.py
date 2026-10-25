import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config, store
from app.main import app

FIXTURES = Path(__file__).parent / "fixtures"
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def upload(content: bytes, filename: str = "result.json"):
    return client.post("/api/chats", files={"file": (filename, content, "application/json")})


def make_export(counts: dict[str, int]) -> bytes:
    messages = []
    for author_id, count in counts.items():
        for i in range(count):
            messages.append(
                {
                    "id": len(messages) + 1,
                    "type": "message",
                    "date_unixtime": str(1740820320 + len(messages) * 60),
                    "from": author_id.upper(),
                    "from_id": author_id,
                    "text": f"сообщение {i}",
                }
            )
    return json.dumps({"name": "Чат", "type": "private_group", "messages": messages}).encode()


def test_upload_personal_chat():
    resp = upload((FIXTURES / "personal_chat.json").read_bytes())
    assert resp.status_code == 201
    chat = resp.json()
    assert chat["id"].startswith("c_") and len(chat["id"]) == 8
    assert chat["title"] == "Саша"
    assert chat["kind"] == "personal"
    assert chat["message_count"] == 5
    assert chat["period"] == {"from": "2025-03-01T09:12:00Z", "to": "2025-03-03T22:40:00Z"}
    assert chat["authors"] == [
        {"id": "user2002", "name": "Саша", "message_count": 3, "enough_data": False},
        {"id": "user1001", "name": "Иван", "message_count": 2, "enough_data": False},
    ]


def test_author_name_is_latest_one():
    resp = upload((FIXTURES / "group_chat.json").read_bytes())
    authors = {a["id"]: a["name"] for a in resp.json()["authors"]}
    assert authors["user3004"] == "Дима_88"


def test_enough_data_threshold():
    resp = upload(make_export({"user1": config.MIN_MESSAGES, "user2": config.MIN_MESSAGES - 1}))
    enough = {a["id"]: a["enough_data"] for a in resp.json()["authors"]}
    assert enough == {"user1": True, "user2": False}


def test_get_uploaded_chat_and_same_file_same_id():
    content = (FIXTURES / "group_chat.json").read_bytes()
    chat = upload(content).json()
    assert upload(content).json()["id"] == chat["id"]

    resp = client.get(f"/api/chats/{chat['id']}")
    assert resp.status_code == 200
    assert resp.json() == chat


def test_get_unknown_chat():
    resp = client.get("/api/chats/c_000000")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_invalid_export():
    resp = upload(b"{oops")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_export"


def test_file_too_large(monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 100)
    resp = upload(b" " * 101)
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "file_too_large"


def test_missing_file_field():
    resp = client.post("/api/chats")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
