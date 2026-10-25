"""Загруженные чаты в памяти процесса — живут до перезапуска бэкенда.

Хранятся последние MAX_CHATS: каждый чат до 50 МБ, а с моделями и кэшем — больше.
Вытесненный чат отвечает 404, и фронт предлагает загрузить файл заново.
"""

from collections import OrderedDict
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


MAX_CHATS = 10

_chats: OrderedDict[str, StoredChat] = OrderedDict()


def save(stored: StoredChat) -> None:
    _chats[stored.chat.id] = stored
    _chats.move_to_end(stored.chat.id)
    while len(_chats) > MAX_CHATS:
        _chats.popitem(last=False)


def get(chat_id: str) -> StoredChat | None:
    stored = _chats.get(chat_id)
    if stored is not None:
        _chats.move_to_end(chat_id)
    return stored


def clear() -> None:
    _chats.clear()
