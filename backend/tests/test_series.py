import pytest

from app import store
from tests.test_check import assert_spans, check, upload_chat

SCAM = ["Привет!", "Срочно займи 5000 на карту.", "Потом объясню."]


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def series(texts: list[str], sent_at: str | None = None) -> dict:
    return {"messages": [{"text": t, "sent_at": sent_at} for t in texts]}


def test_series_own_style():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", series(["кста ща гляну)", "го вечером", "норм)"])).json()
    assert result["verdict"] == "match"
    assert all(s["message"] in {0, 1, 2} for s in result["signals"])


def test_series_scam():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", series(SCAM)).json()
    assert result["verdict"] == "mismatch"

    signals = result["signals"]
    greeting = next(s for s in signals if s["feature"] == "greeting")
    assert (greeting["message"], greeting["span"]) == (0, [0, 6])
    # привычка — одна улика на серию, а не по одной на каждое сообщение
    assert sum(s["feature"] == "capitalization" for s in signals) == 1
    assert sum(s["feature"] == "final_dot" for s in signals) == 1
    for s in signals:
        if s["span"] is not None:
            assert_spans(SCAM[s["message"]], [s])


def test_series_habit_match_is_not_evidence():
    # скобки у этой Саши в 40% сообщений: серия без скобок не должна давать улику
    # «обычно без скобок» при наблюдении «без скобок»
    chat_id = upload_chat(
        ["кста ща гляну)", "го вечером))", "ваще не помню где", "ну норм", "ща буду"]
    )
    texts = ["кста ща гляну", "го вечером", "ну норм", "ща буду", "ваще не помню где"]
    result = check(chat_id, "user2002", series(texts)).json()
    assert "brackets_smile" not in {s["feature"] for s in result["signals"]}


def test_series_evidence_without_span_has_no_message():
    chat_id = upload_chat()
    texts = [
        "Привет! Переведи, пожалуйста, 3000 на карту, которую я сейчас скину",
        "Это срочно, очень прошу тебя, потом всё объясню подробно",
    ]
    signals = check(chat_id, "user2002", series(texts)).json()["signals"]
    no_span = [s for s in signals if s["span"] is None]
    assert {s["feature"] for s in no_span} >= {"length"}
    assert all(s["message"] is None for s in no_span)


def test_series_active_hours_once():
    chat_id = upload_chat()
    # Саша пишет только в 10:xx UTC
    result = check(chat_id, "user2002", series(SCAM, "2026-10-26T03:12:00Z")).json()
    hours = [s for s in result["signals"] if s["feature"] == "active_hours"]
    assert len(hours) == 1
    assert hours[0]["message"] is None


def test_single_text_has_no_message_index():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": " ".join(SCAM)}).json()
    assert result["signals"]
    assert all(s["message"] is None for s in result["signals"])


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": "привет", "messages": [{"text": "a"}, {"text": "b"}]},
        {"messages": [{"text": "одно"}]},
        {"messages": [{"text": "a"}] * 21},
        {"messages": [{"text": "a"}, {"text": "   "}]},
    ],
)
def test_series_validation(body):
    chat_id = upload_chat()
    resp = check(chat_id, "user2002", body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
    assert "Value error" not in resp.json()["error"]["message"]


def test_series_not_enough_data():
    chat_id = upload_chat()
    result = check(chat_id, "user1001", series(["Привет.", "Как дела?"])).json()
    assert result["verdict"] == "not_enough_data"
    assert result["reason"] == "few_messages"
    assert result["score"] is None


def test_series_no_style_text():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", series(["https://example.com", "@sasha"])).json()
    assert result["verdict"] == "not_enough_data"
    assert result["reason"] == "no_style_text"


def test_series_some_style_text_is_checked():
    chat_id = upload_chat()
    result = check(chat_id, "user2002", series(["https://example.com", "глянь)"])).json()
    assert result["verdict"] != "not_enough_data"
    assert result["reason"] is None
