import pytest

from app import config, llm


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    """Тесты никогда не ходят в Claude API, даже если ключ есть в `.env`."""
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
    monkeypatch.setattr(llm, "_client", None)
