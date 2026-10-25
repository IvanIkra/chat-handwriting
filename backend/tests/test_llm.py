from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app import config, llm, store
from tests.test_check import SCAM, check, upload_chat
from tests.test_profile_api import client
from tests.test_twins import group_export, upload


class FakeMessages:
    """Подмена `client.beta.messages`: запоминает запросы, отвечает по очереди."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        return reply


def reply(text: str, stop_reason: str = "end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[
            SimpleNamespace(type="thinking", thinking=""),
            SimpleNamespace(type="text", text=text),
        ],
    )


@pytest.fixture
def fake(monkeypatch):
    def install(*replies) -> FakeMessages:
        messages = FakeMessages(*replies)
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "test-key")
        fake_client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
        monkeypatch.setattr(llm, "_get_client", lambda: fake_client)
        return messages

    return install


@pytest.fixture(autouse=True)
def clean_store():
    store.clear()
    yield
    store.clear()


def prompt_of(call: dict) -> str:
    return call["messages"][0]["content"]


def test_health_llm(fake):
    assert client.get("/api/health").json()["llm"] is False
    fake(reply("ок"))
    assert client.get("/api/health").json()["llm"] is True


def test_check_mismatch_texts(fake):
    messages = fake(reply("Саша так не пишет."))
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["verdict"] == "mismatch"
    assert result["explanation"] == "Саша так не пишет."
    assert result["challenge_question"] == "Саша так не пишет."

    assert len(messages.calls) == 2
    call = messages.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["output_config"] == {"effort": "low"}
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]

    prompts = [prompt_of(c) for c in messages.calls]
    explain = next(p for p in prompts if "<message>" in p)
    assert f"<message>{SCAM}</message>" in explain
    assert "Приветствие" in explain
    question = next(p for p in prompts if "<chat>" in p)
    fragments = question.split("<chat>\n")[1].split("\n</chat>")[0].splitlines()
    assert 0 < len(fragments) <= llm.MAX_FRAGMENTS
    assert all(len(f) <= len("[01.03.2025] Саша: ") + llm.MAX_FRAGMENT for f in fragments)


def test_check_match_has_no_question(fake):
    messages = fake(reply("Похоже на Сашу."))
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": "кста ща гляну)"}).json()
    assert result["verdict"] == "match"
    assert result["explanation"] == "Похоже на Сашу."
    assert result["challenge_question"] is None
    assert len(messages.calls) == 1


def test_question_cached(fake):
    messages = fake(reply("Спроси про концерт."))
    chat_id = upload_chat()
    check(chat_id, "user2002", {"text": SCAM})
    check(chat_id, "user2002", {"text": SCAM})
    # объяснение — на каждую проверку, вопрос — один раз
    assert len(messages.calls) == 3


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com")),
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com")),
    ],
)
def test_check_api_down(fake, error):
    fake(error)
    chat_id = upload_chat()
    resp = check(chat_id, "user2002", {"text": SCAM})
    assert resp.status_code == 200
    assert resp.json()["explanation"] is None
    assert resp.json()["challenge_question"] is None


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_check_incomplete_answer(fake, stop_reason):
    fake(reply("обрыв", stop_reason=stop_reason))
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["explanation"] is None


def test_no_key_no_calls(fake, monkeypatch):
    messages = fake(reply("не должно прийти"))
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["explanation"] is None
    assert messages.calls == []


def test_pair_explanation(fake):
    messages = fake(reply("Это один человек: те же словечки."))
    chat_id = upload(group_export())
    url = f"/api/chats/{chat_id}/twins/user2002/user2003"
    details = client.get(url).json()
    assert details["explanation"] == "Это один человек: те же словечки."
    prompt = prompt_of(messages.calls[0])
    assert "Общие редкие слова" in prompt
    assert "<example>" in prompt
    # повторный запрос пары, в любом порядке, — из кэша
    client.get(f"/api/chats/{chat_id}/twins/user2003/user2002")
    assert len(messages.calls) == 1


@pytest.mark.parametrize(
    "answer", ["НЕТ", "Нет.", "«НЕТ»", "НЕТ!", "**НЕТ**", "Нет, из этих фрагментов не составить"]
)
def test_no_good_question(fake, answer):
    fake(reply(answer))
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["challenge_question"] is None
    assert result["explanation"] == answer  # объяснение — отдельный запрос, его не трогаем


def test_question_starting_with_net_prefix_is_kept(fake):
    question = "Нетфликс: спроси, какой сериал вы досмотрели (Тьму) — обсуждали 02.03."
    fake(reply(question))
    chat_id = upload_chat()
    result = check(chat_id, "user2002", {"text": SCAM}).json()
    assert result["challenge_question"] == question
