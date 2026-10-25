import json

import pytest

from app import check as checker
from app import features, store
from tests.test_features import IVAN, SASHA
from tests.test_profile_api import _msg, client

SCAM = "Привет! Срочно займи 5000 на карту, потом объясню."


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def upload_chat(sasha: list[str] = SASHA) -> str:
    """Как в test_profile_api, но Саши в 10 раз больше: улики набирают силу от объёма."""
    messages = []
    for i, text in enumerate(sasha * 10):
        messages.append(_msg(len(messages), "user2002", "Саша", text, 1740823200 + i * 5))
    for i, text in enumerate(IVAN):
        messages.append(_msg(len(messages), "user1001", "Иван", text, 1740852000 + i * 60))
    export = {"name": "Саша", "type": "personal_chat", "messages": messages}
    resp = client.post(
        "/api/chats",
        files={"file": ("result.json", json.dumps(export).encode(), "application/json")},
    )
    return resp.json()["id"]


def check(chat_id: str, author_id: str, body: dict):
    return client.post(f"/api/chats/{chat_id}/authors/{author_id}/check", json=body)


def assert_spans(text: str, signals: list[dict]):
    for s in signals:
        if s["span"] is None:
            continue
        start, end = s["span"]
        assert 0 <= start < end <= len(text)
        if s["observed"].startswith("«"):
            assert s["observed"] == f"«{text[start:end]}»"


def test_check_own_style():
    chat_id = upload_chat()
    resp = check(chat_id, "user2002", {"text": "кста ща гляну)"})
    assert resp.status_code == 200
    result = resp.json()
    assert result["author_id"] == "user2002"
    assert result["verdict"] == "match"
    assert result["score"] >= 0.6
    assert result["explanation"] is None
    assert result["challenge_question"] is None


def test_check_scam():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["verdict"] == "mismatch"
    assert result["score"] <= 0.35

    signals = {s["feature"]: s for s in result["signals"]}
    assert signals["greeting"]["span"] == [0, 6]
    assert signals["greeting"]["observed"] == "«Привет»"
    assert signals["capitalization"]["span"] == [0, 1]
    assert signals["capitalization"]["observed"] == "заглавная"
    assert signals["final_dot"]["span"] == [len(SCAM) - 1, len(SCAM)]
    assert_spans(SCAM, result["signals"])

    weights = [s["weight"] for s in result["signals"]]
    assert weights == sorted(weights, reverse=True)
    assert all(0 < w <= 1 for w in weights)


def test_check_scam_greeting_counted_once():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    greeting = next(s for s in result["signals"] if s["feature"] == "greeting")
    rare = [s for s in result["signals"] if s["feature"] == "rare_words"]
    assert greeting["span"] not in [s["span"] for s in rare]


def test_check_own_greeting_is_not_evidence(monkeypatch):
    # приветствие обычно у всех — тогда и своё «прив» у Саши выглядело бы уликой
    monkeypatch.setattr(checker, "GREETING_RATE", 1.0)
    chat_id = upload_chat([*SASHA, "прив кста ты где"])
    result = check(chat_id, "user2002", {"text": "прив ща гляну)"}).json()
    assert "greeting" not in {s["feature"] for s in result["signals"]}
    assert result["verdict"] == "match"
    # чужое приветствие — по-прежнему улика
    scam = check(chat_id, "user2002", {"text": SCAM}).json()
    assert "greeting" in {s["feature"] for s in scam["signals"]}


def test_check_one_comma_is_not_mismatch():
    # Саша почти не ставит запятые, но одна запятая в своём сообщении — ещё не подделка
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": "ну норм, го ща буду)"}).json()
    [signal] = result["signals"]
    assert signal["feature"] == "commas"
    assert signal["weight"] < 0.5
    assert result["verdict"] != "mismatch"


def test_check_span_in_code_points():
    chat_id = upload_chat()
    # «созвонимся» пишет Иван, но не Саша
    text = "🔥 созвонимся вечером"
    result = check(chat_id, "user2002", {"text": text}).json()
    rare = [s for s in result["signals"] if s["feature"] == "rare_words"]
    assert [s["span"] for s in rare] == [[2, 12]]
    assert_spans(text, result["signals"])


def test_check_ignores_links():
    chat_id = upload_chat()
    text = "ща скину https://Example.COM/Login)"
    result = check(chat_id, "user2002", {"text": text}).json()
    assert not [s for s in result["signals"] if s["feature"] in {"latin_words", "caps_words"}]


def test_check_active_hours():
    chat_id = upload_chat()
    # Саша пишет только в 10:xx UTC
    night = check(chat_id, "user2002", {"text": "ща буду)", "sent_at": "2026-10-26T03:12:00Z"})
    signal = next(s for s in night.json()["signals"] if s["feature"] == "active_hours")
    assert signal["observed"] == "03:12 UTC"
    assert signal["expected"] == "обычно 10:00–11:00 UTC"
    assert signal["span"] is None

    day = check(chat_id, "user2002", {"text": "ща буду)", "sent_at": "2026-10-26T10:30:00Z"})
    assert "active_hours" not in {s["feature"] for s in day.json()["signals"]}


def test_check_not_enough_data():
    chat_id = upload_chat()
    # у Ивана 20 сообщений — меньше порога
    result = check(chat_id, "user1001", {"text": "Привет. Как дела?"}).json()
    assert result == {
        "author_id": "user1001",
        "score": None,
        "verdict": "not_enough_data",
        "signals": [],
        "explanation": None,
        "challenge_question": None,
    }


@pytest.mark.parametrize("text", ["", "   \n"])
def test_check_empty_text(text):
    chat_id = upload_chat()
    resp = check(chat_id, "user2002", {"text": text})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"


def test_check_unknown_author_and_chat():
    chat_id = upload_chat()
    resp = check(chat_id, "user9999", {"text": "привет"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
    resp = check("c_000000", "user2002", {"text": "привет"})
    assert resp.status_code == 404


def test_bracket_smile_spans():
    assert features.bracket_smile_spans("ок))) (да) ну(") == [(2, 5), (13, 14)]
