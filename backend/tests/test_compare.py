import json

import pytest

from app import store
from tests.test_features import IVAN, SASHA
from tests.test_profile_api import _msg, client
from tests.test_twins import ANYA

START = 1740823200  # 2025-03-01 10:00 UTC


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def personal_chat(title: str, other_id: str, other_texts: list[str], repeat: int = 2) -> str:
    """Личная переписка Ивана (он делал экспорт) с другим человеком."""
    messages = []
    for i, text in enumerate(other_texts * repeat * 2):
        messages.append(_msg(len(messages), other_id, title, text, START + i * 60))
    for i, text in enumerate(IVAN * 8):
        messages.append(_msg(len(messages), "user1001", "Иван", text, START + 8 * 3600 + i * 60))
    export = {"name": title, "type": "personal_chat", "messages": messages}
    resp = client.post(
        "/api/chats",
        files={"file": ("result.json", json.dumps(export).encode(), "application/json")},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def compare(a: str, b: str):
    return client.get("/api/compare", params={"a": a, "b": b})


def test_compare_same_person():
    # Alex пишет точь-в-точь как Саша
    sasha = personal_chat("Саша", "user2002", SASHA)
    alex = personal_chat("Alex", "user7007", SASHA)
    resp = compare(sasha, alex)
    assert resp.status_code == 200
    result = resp.json()

    assert result["a"]["id"] == sasha
    assert result["b"]["id"] == alex
    assert result["shared"] == ["user1001"]
    assert len(result["pairs"]) == 1
    pair = result["pairs"][0]
    assert (pair["a"], pair["b"]) == ("user2002", "user7007")
    assert pair["verdict"] == "likely_same"

    signals = {s["feature"]: s for s in pair["signals"]}
    assert {"style", "shared_words"} <= set(signals)
    assert "«кста»" in signals["shared_words"]["observed"]
    assert all(s["expected"] is None and s["span"] is None for s in pair["signals"])
    total = sum(s["weight"] for s in pair["signals"])
    assert pair["score"] == pytest.approx(min(1, total), abs=0.02)


def test_compare_different_people():
    sasha = personal_chat("Саша", "user2002", SASHA)
    anya = personal_chat("Аня", "user3001", ANYA, repeat=4)
    pair = compare(sasha, anya).json()["pairs"][0]
    assert (pair["a"], pair["b"]) == ("user2002", "user3001")
    assert pair["verdict"] == "different"


def test_compare_nobody_to_compare():
    sasha = personal_chat("Саша", "user2002", SASHA)
    # у Ани 5 сообщений — меньше порога
    few = personal_chat("Аня", "user3001", ANYA, repeat=1)
    few_result = compare(sasha, few).json()
    assert few_result["pairs"] == []
    assert few_result["shared"] == ["user1001"]


def test_compare_errors():
    sasha = personal_chat("Саша", "user2002", SASHA)
    same = compare(sasha, sasha)
    assert same.status_code == 422
    assert same.json()["error"]["code"] == "validation"

    missing = client.get("/api/compare", params={"a": sasha})
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "validation"

    unknown = compare(sasha, "c_000000")
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "not_found"
