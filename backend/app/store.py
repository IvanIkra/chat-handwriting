"""Загруженные чаты в памяти процесса — живут до перезапуска бэкенда."""

from dataclasses import dataclass, field
from typing import Any

from app.models import Chat
from app.telegram import Message


@dataclass
class StoredChat:
    chat: Chat
    messages: list[Message]
    # Посчитанное для анализа (модели, словари) — строится при первом запросе
    cache: dict[str, Any] = field(default_factory=dict)


_chats: dict[str, StoredChat] = {}


def save(stored: StoredChat) -> None:
    _chats[stored.chat.id] = stored


def get(chat_id: str) -> StoredChat | None:
    return _chats.get(chat_id)


def clear() -> None:
    _chats.clear()
