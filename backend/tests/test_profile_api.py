import json

import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app
from tests.test_features import IVAN, SASHA

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def upload_chat() -> str:
    messages = []
    # Саша пишет в 10:xx UTC, Иван — в 18:xx
    for i, text in enumerate(SASHA):
        messages.append(_msg(len(messages), "user2002", "Саша", text, 1740823200 + i * 60))
    for i, text in enumerate(IVAN):
        messages.append(_msg(len(messages), "user1001", "Иван", text, 1740852000 + i * 60))
    export = {"name": "Саша", "type": "personal_chat", "messages": messages}
    resp = client.post(
        "/api/chats",
        files={"file": ("result.json", json.dumps(export).encode(), "application/json")},
    )
    return resp.json()["id"]


def _msg(i: int, author_id: str, name: str, text: str, unixtime: int) -> dict:
    return {
        "id": i + 1,
        "type": "message",
        "date_unixtime": str(unixtime),
        "from": name,
        "from_id": author_id,
        "text": text,
    }


def test_profile():
    chat_id = upload_chat()
    resp = client.get(f"/api/chats/{chat_id}/authors/user2002/profile")
    assert resp.status_code == 200
    profile = resp.json()

    assert profile["author_id"] == "user2002"
    assert profile["name"] == "Саша"
    assert profile["message_count"] == len(SASHA)
    assert profile["enough_data"] is True
    assert profile["avg_length"] == pytest.approx(sum(map(len, SASHA)) / len(SASHA), abs=0.05)

    assert 5 <= len(profile["traits"]) <= 8
    keys = [t["key"] for t in profile["traits"]]
    assert {"lowercase_start", "no_final_dot", "brackets_smile"} <= set(keys)
    assert set(profile["traits"][0]) == {"key", "label", "value", "description"}

    assert {"ща", "кста"} <= set(profile["top_words"])
    assert profile["emoji"][0] == {"char": ")", "count": 20}
    assert {"char": "🔥", "count": 4} in profile["emoji"]

    hours = profile["active_hours"]
    assert len(hours) == 24
    assert sum(hours) == pytest.approx(1)
    assert hours[10] == 1.0


def test_profile_unknown_author():
    chat_id = upload_chat()
    resp = client.get(f"/api/chats/{chat_id}/authors/user9999/profile")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_profile_unknown_chat():
    resp = client.get("/api/chats/c_000000/authors/user2002/profile")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
