"""Разбор `result.json` из Telegram Desktop (экспорт одного чата, машиночитаемый JSON)."""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

PERSONAL_TYPES = {"personal_chat", "bot_chat", "saved_messages"}
DELETED_AUTHOR_NAME = "Удалённый аккаунт"


class InvalidExport(ValueError):
    pass


@dataclass(frozen=True)
class Message:
    id: int
    author_id: str
    author_name: str
    text: str
    sent_at: datetime  # UTC


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
    """Текстовое сообщение или None, если его нужно пропустить."""
    if not isinstance(msg, dict) or msg.get("type") != "message":
        return None
    # Пересланное написал другой человек — для почерка отправителя это шум
    if msg.get("forwarded_from") is not None:
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
    return Message(
        id=int(msg.get("id", 0)),
        author_id=str(author_id),
        author_name=msg.get("from") or DELETED_AUTHOR_NAME,
        text=text,
        sent_at=sent_at,
    )


def _flatten_text(text: Any) -> str:
    """`text` бывает строкой или списком из строк и сущностей `{"type", "text"}`."""
    if isinstance(text, str):
        return text
    if isinstance(text, list):
        parts = []
        for part in text:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
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
