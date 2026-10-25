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


def make_export(counts: dict[str, int], forwarded: dict[str, int] | None = None) -> bytes:
    messages = []

    def add(author_id: str, text: str, **extra):
        messages.append(
            {
                "id": len(messages) + 1,
                "type": "message",
                "date_unixtime": str(1740820320 + len(messages) * 60),
                "from": author_id.upper(),
                "from_id": author_id,
                "text": text,
                **extra,
            }
        )

    for author_id, count in counts.items():
        for i in range(count):
            add(author_id, f"сообщение {i}")
    for author_id, count in (forwarded or {}).items():
        for i in range(count):
            add(author_id, f"репост {i}", forwarded_from="Канал")
    return json.dumps({"name": "Чат", "type": "private_group", "messages": messages}).encode()


def test_upload_personal_chat():
    resp = upload((FIXTURES / "personal_chat.json").read_bytes())
    assert resp.status_code == 201
    chat = resp.json()
    # 16 hex: при коллизии чат молча перезаписался бы другим
    assert chat["id"].startswith("c_") and len(chat["id"]) == 18
    assert chat["title"] == "Саша"
    assert chat["kind"] == "personal"
    # пересланные, через бота и только-ссылки тоже считаются сообщениями
    assert chat["message_count"] == 8
    assert chat["period"] == {"from": "2025-03-01T09:12:00Z", "to": "2025-03-03T22:40:00Z"}
    assert chat["authors"] == [
        {"id": "user2002", "name": "Саша", "message_count": 5, "enough_data": False},
        {"id": "user1001", "name": "Иван", "message_count": 3, "enough_data": False},
    ]


def test_author_name_is_latest_one():
    resp = upload((FIXTURES / "group_chat.json").read_bytes())
    authors = {a["id"]: a["name"] for a in resp.json()["authors"]}
    assert authors["user3004"] == "Дима_88"


def test_enough_data_threshold():
    resp = upload(make_export({"user1": config.MIN_MESSAGES, "user2": config.MIN_MESSAGES - 1}))
    enough = {a["id"]: a["enough_data"] for a in resp.json()["authors"]}
    assert enough == {"user1": True, "user2": False}


def test_forwarded_do_not_count_for_enough_data():
    n = config.MIN_MESSAGES
    resp = upload(make_export({"user1": n - 1}, forwarded={"user1": 10}))
    author = resp.json()["authors"][0]
    assert author["message_count"] == n - 1 + 10
    assert author["enough_data"] is False


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


def single_message_export(message: dict | None = None, **chat) -> bytes:
    msg = {
        "id": 1,
        "type": "message",
        "date_unixtime": "1740820320",
        "from": "Саша",
        "from_id": "user1",
        "text": "привет",
        **(message or {}),
    }
    return json.dumps({"name": "Чат", "type": "personal_chat", "messages": [msg], **chat}).encode()


@pytest.mark.parametrize(
    "message",
    [
        {"id": "abc"},
        {"id": None},
        {"id": [1]},
        {"from_id": {"id": 1}},
        {"date_unixtime": "99999999999999999"},
    ],
)
def test_broken_message_is_skipped(message):
    # единственное сообщение битое — значит, текстовых сообщений нет
    resp = upload(single_message_export(message))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_export"


@pytest.mark.parametrize(
    ("message", "chat", "title", "author"),
    [
        ({"from": 123}, {}, "Чат", "Удалённый аккаунт"),
        ({}, {"name": 5}, "Без названия", "Саша"),
        ({}, {"type": ["personal_chat"]}, "Чат", "Саша"),
    ],
)
def test_odd_fields_fall_back_to_defaults(message, chat, title, author):
    resp = upload(single_message_export(message, **chat))
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == title
    assert body["authors"][0]["name"] == author


def test_body_not_json():
    resp = client.post(
        "/api/chats/c_000000/authors/user1/check",
        content=b"{oops",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"] == {"code": "validation", "message": "Тело запроса — не JSON"}


def test_store_keeps_last_chats(monkeypatch):
    monkeypatch.setattr(store, "MAX_CHATS", 2)
    first, second, third = (upload(make_export({f"user{i}": 3})).json()["id"] for i in range(3))
    assert client.get(f"/api/chats/{first}").status_code == 404
    # недавно открытый чат вытесняется последним
    assert client.get(f"/api/chats/{second}").status_code == 200
    upload(make_export({"user9": 3}))
    assert client.get(f"/api/chats/{second}").status_code == 200
    assert client.get(f"/api/chats/{third}").status_code == 404
