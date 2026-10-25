import json
from types import SimpleNamespace

import numpy as np
import pytest

from app import compare as comparer
from app import store, twins
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


def fake_member(author_id: str) -> SimpleNamespace:
    return SimpleNamespace(
        author_id=author_id, profile=SimpleNamespace(self_sim=1.0), hours=np.ones(24)
    )


@pytest.mark.parametrize("ratio", [0.98, 1.0, 1.05])
def test_references_when_everyone_looks_alike(monkeypatch, ratio):
    # без общего аккаунта и с похожестью ≥ самоподобия: раньше — деление на ноль
    # или перевёрнутые скоры
    monkeypatch.setattr(twins, "style_ratio", lambda a, b: ratio)
    xs = [fake_member(f"a{i}") for i in range(3)]
    ys = [fake_member(f"b{i}") for i in range(3)]
    refs = comparer._references([(x, y) for x in xs for y in ys], shared=[])
    assert refs.same > refs.different
    # пара чуть похожее остальных — раньше этот шум раздувался до likely_same
    monkeypatch.setattr(twins, "style_ratio", lambda a, b: ratio + 0.01)
    assert comparer.style_score(xs[0], ys[0], refs) == 0.0


def test_style_score_ratio_above_one(monkeypatch):
    monkeypatch.setattr(twins, "style_ratio", lambda a, b: 1.02)
    refs = comparer._References(same=1.0, different=1.05, hours=0.7)
    assert comparer.style_score(fake_member("a"), fake_member("b"), refs) == 0.0


def forwards_chat(title: str) -> str:
    """Чат, где всё переслано, — своего текста нет ни у кого."""
    messages = [
        {**_msg(i, "user5005", "Боря", f"репост {i}", START + i * 60), "forwarded_from": title}
        for i in range(40)
    ]
    export = {"name": title, "type": "personal_chat", "messages": messages}
    resp = client.post(
        "/api/chats",
        files={"file": ("result.json", json.dumps(export).encode(), "application/json")},
    )
    return resp.json()["id"]


def test_compare_chats_without_own_text():
    result = compare(forwards_chat("Канал 1"), forwards_chat("Канал 2"))
    assert result.status_code == 200
    assert result.json()["pairs"] == []
