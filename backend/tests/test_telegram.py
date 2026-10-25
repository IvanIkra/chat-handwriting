import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.telegram import DELETED_AUTHOR_NAME, InvalidExport, parse_export

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def by_id(chat, msg_id):
    return next(m for m in chat.messages if m.id == msg_id)


def test_personal_chat_keeps_text_messages():
    chat = parse_export(load("personal_chat.json"))
    assert chat.title == "Саша"
    assert chat.kind == "personal"
    # без служебного и фото без подписи
    assert [m.id for m in chat.messages] == [1, 2, 4, 6, 7, 9, 10, 8]


def test_text_entities_are_flattened_and_links_cut_from_style():
    msg = by_id(parse_export(load("personal_chat.json")), 4)
    assert msg.text == "кста глянь https://example.com ща"
    assert msg.style_text == "кста глянь ща"
    assert msg.has_style


def test_forwarded_and_via_bot_are_kept_but_not_style():
    chat = parse_export(load("personal_chat.json"))
    forwarded = by_id(chat, 6)
    assert forwarded.forwarded and not forwarded.via_bot
    assert forwarded.text == "Важная новость дня"
    assert not forwarded.has_style

    via_bot = by_id(chat, 9)
    assert via_bot.via_bot and not via_bot.forwarded
    assert not via_bot.has_style

    own = by_id(chat, 2)
    assert not own.forwarded and not own.via_bot
    assert own.style_text == own.text == "йо) норм"


def test_link_only_message_has_no_style():
    msg = by_id(parse_export(load("personal_chat.json")), 10)
    assert msg.text == "https://t.me/example"
    assert not msg.has_style


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
