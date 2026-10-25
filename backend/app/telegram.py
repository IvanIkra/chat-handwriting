"""Разбор `result.json` из Telegram Desktop (экспорт одного чата, машиночитаемый JSON)."""

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

PERSONAL_TYPES = {"personal_chat", "bot_chat", "saved_messages"}
DELETED_AUTHOR_NAME = "Удалённый аккаунт"
# Сущности, которые не говорят о почерке: их текст вырезаем из style_text
NON_STYLE_ENTITIES = {
    "link",
    "mention",
    "email",
    "phone",
    "bot_command",
    "code",
    "pre",
    "ton_address",
    "cashtag",
    "bank_card",
}


class InvalidExport(ValueError):
    pass


@dataclass(frozen=True)
class Message:
    id: int
    author_id: str
    author_name: str
    text: str  # как в экспорте, со ссылками
    sent_at: datetime  # UTC
    forwarded: bool = False  # переслано от другого человека или канала
    via_bot: bool = False  # отправлено через inline-бота, текст написал бот
    # Текст для анализа почерка: свой текст без ссылок, упоминаний и кода.
    # Пустой у пересланных, через ботов и у сообщений, где была только ссылка.
    style_text: str = ""

    @property
    def has_style(self) -> bool:
        return bool(self.style_text)


@dataclass
class ParsedChat:
    title: str
    kind: Literal["personal", "group"]
    messages: list[Message]  # по возрастанию sent_at


def parse_export(raw: bytes) -> ParsedChat:
    try:
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise InvalidExport("Файл не является JSON") from exc

    if not isinstance(data, dict):
        raise InvalidExport("Файл не похож на экспорт Telegram")
    if "messages" not in data and "chats" in data:
        raise InvalidExport("Это экспорт всего аккаунта — экспортируй историю одного чата")
    if not isinstance(data.get("messages"), list):
        raise InvalidExport("В файле нет списка сообщений")

    messages = [m for raw_msg in data["messages"] if (m := _parse_message(raw_msg))]
    if not messages:
        raise InvalidExport("В чате нет текстовых сообщений")
    messages.sort(key=lambda m: m.sent_at)

    kind = "personal" if data.get("type") in PERSONAL_TYPES else "group"
    title = data.get("name") or "Без названия"
    return ParsedChat(title=title, kind=kind, messages=messages)


def _parse_message(msg: Any) -> Message | None:
    """Текстовое сообщение или None, если его нужно пропустить (служебное, пустое)."""
    if not isinstance(msg, dict) or msg.get("type") != "message":
        return None
    author_id = msg.get("from_id")
    if not author_id:
        return None
    text = _flatten_text(msg.get("text")).strip()
    if not text:
        return None
    sent_at = _parse_date(msg)
    if sent_at is None:
        return None

    # Пересланное и присланное через бота — активность автора, но не его почерк
    forwarded = msg.get("forwarded_from") is not None
    via_bot = bool(msg.get("via_bot"))
    style_text = ""
    if not forwarded and not via_bot:
        style_text = _flatten_text(msg.get("text"), skip=NON_STYLE_ENTITIES)
        style_text = re.sub(r" {2,}", " ", style_text).strip()

    return Message(
        id=int(msg.get("id", 0)),
        author_id=str(author_id),
        author_name=msg.get("from") or DELETED_AUTHOR_NAME,
        text=text,
        sent_at=sent_at,
        forwarded=forwarded,
        via_bot=via_bot,
        style_text=style_text,
    )


def _flatten_text(text: Any, skip: set[str] | frozenset[str] = frozenset()) -> str:
    """`text` бывает строкой или списком из строк и сущностей `{"type", "text"}`.

    Сущности с типом из `skip` выбрасываются.
    """
    if isinstance(text, str):
        return text
    if isinstance(text, list):
        parts = []
        for part in text:
            if isinstance(part, str):
                parts.append(part)
            elif (
                isinstance(part, dict)
                and isinstance(part.get("text"), str)
                and part.get("type") not in skip
            ):
                parts.append(part["text"])
        return "".join(parts)
    return ""


def _parse_date(msg: dict) -> datetime | None:
    # `date` — локальное время машины, где делали экспорт; `date_unixtime` — честный UTC
    unixtime = msg.get("date_unixtime")
    if unixtime is not None:
        try:
            return datetime.fromtimestamp(int(unixtime), UTC)
        except (TypeError, ValueError, OverflowError):
            pass
    date = msg.get("date")
    if isinstance(date, str):
        try:
            parsed = datetime.fromisoformat(date)
        except ValueError:
            return None
        return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
    return None
