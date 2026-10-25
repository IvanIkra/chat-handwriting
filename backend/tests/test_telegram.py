import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.telegram import DELETED_AUTHOR_NAME, InvalidExport, parse_export

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_personal_chat_keeps_only_own_text_messages():
    chat = parse_export(load("personal_chat.json"))
    assert chat.title == "Саша"
    assert chat.kind == "personal"
    # без служебного, фото без подписи и пересланного
    assert [m.id for m in chat.messages] == [1, 2, 4, 7, 8]


def test_text_entities_are_flattened():
    chat = parse_export(load("personal_chat.json"))
    msg = next(m for m in chat.messages if m.id == 4)
    assert msg.text == "кста глянь https://example.com ща"


def test_dates_are_utc_from_unixtime():
    chat = parse_export(load("personal_chat.json"))
    first = chat.messages[0]
    # в `date` локальное время (+3), а нужен UTC
    assert first.sent_at == datetime(2025, 3, 1, 9, 12, tzinfo=UTC)
    # без `date_unixtime` берём `date` как UTC
    assert chat.messages[-1].sent_at == datetime(2025, 3, 3, 22, 40, tzinfo=UTC)


def test_group_chat():
    chat = parse_export(load("group_chat.json"))
    assert chat.kind == "group"
    assert {m.author_id for m in chat.messages} == {"user3001", "user3003", "user3004", "user3006"}
    deleted = next(m for m in chat.messages if m.author_id == "user3006")
    assert deleted.author_name == DELETED_AUTHOR_NAME


@pytest.mark.parametrize(
    "raw",
    [
        b"not json",
        b"\xff\xfe",
        b"[1, 2, 3]",
        b'{"name": "x"}',
        json.dumps({"chats": {"list": []}}).encode(),
        json.dumps({"name": "x", "type": "personal_chat", "messages": []}).encode(),
    ],
)
def test_invalid_exports(raw):
    with pytest.raises(InvalidExport):
        parse_export(raw)
