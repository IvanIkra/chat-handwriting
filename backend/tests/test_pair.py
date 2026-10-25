import pytest

from app import features, store
from tests.test_features import IVAN, SASHA
from tests.test_profile_api import client
from tests.test_twins import ANYA, group_export, upload


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def get_pair(chat_id: str, a: str, b: str):
    return client.get(f"/api/chats/{chat_id}/twins/{a}/{b}")


def test_pair_twins():
    chat_id = upload(group_export())
    # порядок обратный тому, что в /twins, — a и b берутся из запроса
    resp = get_pair(chat_id, "user2003", "user2002")
    assert resp.status_code == 200
    details = resp.json()

    pair = details["pair"]
    assert (pair["a"], pair["b"]) == ("user2003", "user2002")
    assert pair["verdict"] == "likely_same"
    assert details["a"]["id"] == "user2003"
    assert details["a"]["name"] == "Дима_88"
    assert details["b"]["id"] == "user2002"
    assert details["explanation"] is None

    examples = details["examples"]
    assert 1 <= len(examples) <= 5
    signal_features = {s["feature"] for s in pair["signals"]}
    assert {e["feature"] for e in examples} <= signal_features
    assert {"style", "rare_words", "punctuation"} <= {e["feature"] for e in examples}
    for e in examples:
        assert e["a"]["text"] in SASHA and e["b"]["text"] in SASHA
        assert e["a"]["sent_at"].endswith("Z")

    rare = next(e for e in examples if e["feature"] == "rare_words")
    shared = set(features.words(rare["a"]["text"])) & set(features.words(rare["b"]["text"]))
    assert shared & {"кста", "ща", "го", "норм", "ваще"}

    # аккаунты Саши ни разу не писали в одну минуту и не сменяли друг друга
    assert details["timeline"] == {"overlap_minutes": 0, "median_switch_seconds": None}


def test_pair_different_people():
    chat_id = upload(group_export())
    details = get_pair(chat_id, "user1001", "user3001").json()
    assert details["pair"]["verdict"] == "different"
    # Иван и Аня пишут в одних и тех же сессиях, через 20 секунд друг за другом
    assert details["timeline"]["overlap_minutes"] > 0
    assert details["timeline"]["median_switch_seconds"] == 20
    for e in details["examples"]:
        assert e["a"]["text"] in IVAN and e["b"]["text"] in ANYA


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("user2002", "user9999"),  # нет такого автора
        ("user2002", "user3005"),  # у Лёши мало сообщений
        ("user2002", "user2002"),
    ],
)
def test_pair_not_found(a, b):
    chat_id = upload(group_export())
    resp = get_pair(chat_id, a, b)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_pair_unknown_chat():
    resp = get_pair("c_000000", "user2002", "user2003")
    assert resp.status_code == 404
