"""Схемы ответов API — см. `docs/CONTRACT.md`."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Author(BaseModel):
    id: str
    name: str
    message_count: int
    enough_data: bool


class Period(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: datetime = Field(alias="from")
    to: datetime


class Chat(BaseModel):
    id: str
    title: str
    kind: Literal["personal", "group"]
    message_count: int
    period: Period
    authors: list[Author]


class Trait(BaseModel):
    key: str
    label: str
    value: float
    description: str


class EmojiCount(BaseModel):
    char: str
    count: int


class StyleProfile(BaseModel):
    author_id: str
    name: str
    message_count: int
    enough_data: bool
    avg_length: float
    traits: list[Trait]
    top_words: list[str]
    emoji: list[EmojiCount]
    active_hours: list[float]  # 24 доли по часам UTC


class Signal(BaseModel):
    feature: str
    label: str
    expected: str | None
    observed: str
    span: list[int] | None  # [начало, конец) в кодовых точках проверяемого текста
    message: int | None = None  # номер сообщения серии, к которому относится span
    weight: float


def _not_blank(text: str | None) -> str | None:
    if text is not None and not text.strip():
        raise ValueError("Текст пустой")
    return text


class SeriesMessage(BaseModel):
    text: str = Field(max_length=4096)
    sent_at: datetime | None = None

    _check_text = field_validator("text")(_not_blank)


class CheckRequest(BaseModel):
    """Один текст (`text`, `sent_at`) или серия сообщений подряд (`messages`)."""

    text: str | None = Field(None, max_length=4096)
    sent_at: datetime | None = None
    messages: list[SeriesMessage] | None = Field(None, min_length=2, max_length=20)

    _check_text = field_validator("text")(_not_blank)

    @model_validator(mode="after")
    def _text_or_messages(self) -> "CheckRequest":
        if (self.text is None) == (self.messages is None):
            raise ValueError("Нужен либо text, либо messages")
        return self

    def items(self) -> list[tuple[str, datetime | None]]:
        if self.messages is not None:
            return [(m.text, m.sent_at) for m in self.messages]
        return [(self.text, self.sent_at)]


class CheckResult(BaseModel):
    author_id: str
    score: float | None
    verdict: Literal["match", "uncertain", "mismatch", "not_enough_data"]
    signals: list[Signal]
    explanation: str | None = None
    challenge_question: str | None = None


class TwinPair(BaseModel):
    a: str
    b: str
    score: float
    verdict: Literal["likely_same", "possible", "different"]
    signals: list[Signal]


class Validation(BaseModel):
    self_match_rate: float
    authors_tested: int


class TwinsResult(BaseModel):
    chat_id: str
    authors: list[Author]
    pairs: list[TwinPair]
    validation: Validation | None


class Comparison(BaseModel):
    a: Chat
    b: Chat
    shared: list[str]  # аккаунты, которые есть в обоих чатах — в пары не идут
    pairs: list[TwinPair]  # a — автор из чата a, b — из чата b


class PairMessage(BaseModel):
    text: str
    sent_at: datetime


class PairExample(BaseModel):
    feature: str  # какую улику иллюстрирует
    a: PairMessage
    b: PairMessage


class Timeline(BaseModel):
    overlap_minutes: int
    median_switch_seconds: int | None


class PairDetails(BaseModel):
    pair: TwinPair
    a: Author
    b: Author
    examples: list[PairExample]
    timeline: Timeline
    explanation: str | None = None
