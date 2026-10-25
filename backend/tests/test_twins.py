import json

import pytest

from app import store
from app.twins import Baselines, PairStats, _switch_signal
from scripts.split_author import split_export
from tests.test_features import IVAN, SASHA
from tests.test_profile_api import _msg, client
from tests.test_profile_api import upload_chat as upload_personal_chat

ANYA = [
    "Ого!! Это ВООБЩЕ топ 😍",
    "Слушайте, а давайте в кино!!",
    "Я за!! Только не поздно 🙏",
    "АААА как круто 😍😍",
    "Кто со мной на выходных?!",
]
DAY = 86400
START = 1740787200  # 2025-03-01 00:00 UTC


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def group_export() -> dict:
    """Группа: Иван, Аня и Саша с двух аккаунтов (утром с одного, вечером с другого).

    Лёша написал мало и в поиск двойников не попадает.
    """
    messages = []
    said = {"user1001": 0, "user3001": 0, "user2002": 0}
    texts = {"user1001": IVAN, "user3001": ANYA, "user2002": SASHA}
    for day in range(10):
        for session, hour in enumerate((10, 18)):
            # аккаунты Саши чередуются по дням, чтобы у обоих были и утро, и вечер
            sasha = ("user2002", "user2003")[(day + session) % 2]
            t = START + day * DAY + hour * 3600
            for _ in range(4):
                for author, name in (("user1001", "Иван"), ("user3001", "Аня"), ("user2002", "")):
                    text = texts[author][said[author] % len(texts[author])]
                    said[author] += 1
                    if author == "user2002":
                        author, name = sasha, "Саша" if sasha == "user2002" else "Дима_88"
                    messages.append(_msg(len(messages), author, name, text, t))
                    t += 20
    for i in range(5):
        messages.append(_msg(len(messages), "user3005", "Лёша", "всем привет", START + i * 999))
    messages.sort(key=lambda m: int(m["date_unixtime"]))
    return {"name": "Компания", "type": "private_group", "messages": messages}


def upload(export: dict) -> str:
    resp = client.post(
        "/api/chats",
        files={"file": ("result.json", json.dumps(export).encode(), "application/json")},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_twins_found():
    chat_id = upload(group_export())
    resp = client.get(f"/api/chats/{chat_id}/twins")
    assert resp.status_code == 200
    result = resp.json()

    assert result["chat_id"] == chat_id
    assert {a["id"] for a in result["authors"]} == {
        "user1001",
        "user2002",
        "user2003",
        "user3001",
        "user3005",
    }
    pairs = result["pairs"]
    # все сочетания четырёх авторов с enough_data, Лёши нет
    assert len(pairs) == 6
    assert all("user3005" not in (p["a"], p["b"]) for p in pairs)
    assert [p["score"] for p in pairs] == sorted((p["score"] for p in pairs), reverse=True)

    top = pairs[0]
    assert {top["a"], top["b"]} == {"user2002", "user2003"}
    assert top["verdict"] == "likely_same"
    signals = {s["feature"]: s for s in top["signals"]}
    assert {"style", "rare_words", "no_overlap"} <= set(signals)
    assert "«кста»" in signals["rare_words"]["observed"]
    assert signals["no_overlap"]["observed"].startswith("0 случаев")
    assert all(s["expected"] is None and s["span"] is None for s in top["signals"])
    assert top["score"] == pytest.approx(min(1, sum(s["weight"] for s in top["signals"])), abs=0.02)

    assert all(p["verdict"] == "different" for p in pairs[1:])
    assert result["validation"] == {"self_match_rate": 1.0, "authors_tested": 4}


def test_twins_personal_chat():
    # Саша и Иван — разные люди; двое, поэтому без самопроверки
    export = group_export()
    export["messages"] = [m for m in export["messages"] if m["from_id"] in {"user1001", "user3001"}]
    result = client.get(f"/api/chats/{upload(export)}/twins").json()
    assert len(result["pairs"]) == 1
    assert result["pairs"][0]["verdict"] == "different"
    assert result["validation"] is None


def test_twins_not_enough_authors():
    # у Ивана 20 сообщений — сравнивать Сашу не с кем
    chat_id = upload_personal_chat()
    result = client.get(f"/api/chats/{chat_id}/twins").json()
    assert result["pairs"] == []
    assert result["validation"] is None


def test_twins_unknown_chat():
    resp = client.get("/api/chats/c_000000/twins")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_switch_signal():
    stats = PairStats(
        ratio=1.0,
        common_days=5,
        overlap_minutes=0,
        overlap_rate=0.0,
        switches=[25, 31, 40, 28, 35],
        rare_words=None,
    )
    fast = _switch_signal(stats, Baselines(0.9, 0.3, switch_seconds=90, rare_words=None))
    assert fast[0].feature == "switch_time"
    assert fast[0].observed == "медиана 31 с между сообщениями A и B, обычно в чате — 90 с"
    assert _switch_signal(stats, Baselines(0.9, 0.3, switch_seconds=40, rare_words=None)) == []
    assert _switch_signal(stats, Baselines(0.9, 0.3, switch_seconds=None, rare_words=None)) == []


def test_split_export():
    export = group_export()
    original = json.dumps(export)
    result = split_export(export, "user3001", twin_name="Аня 2", seed=3)
    assert json.dumps(export) == original

    anya = [m for m in result["messages"] if m["from_id"] in {"user3001", "user30010"}]
    assert {m["from_id"] for m in anya} == {"user3001", "user30010"}
    assert {m["from"] for m in anya if m["from_id"] == "user30010"} == {"Аня 2"}
    # сессия целиком у одного аккаунта
    by_session = {}
    for m in anya:
        session = int(m["date_unixtime"]) // 3600
        by_session.setdefault(session, set()).add(m["from_id"])
    assert all(len(ids) == 1 for ids in by_session.values())

    others = [m for m in result["messages"] if m["from_id"] not in {"user3001", "user30010"}]
    assert len(others) == len([m for m in export["messages"] if m["from_id"] != "user3001"])
