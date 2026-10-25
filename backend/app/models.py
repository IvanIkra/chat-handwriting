"""Схемы ответов API — см. `docs/CONTRACT.md`."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    weight: float


class CheckRequest(BaseModel):
    text: str = Field(max_length=4096)
    sent_at: datetime | None = None

    @field_validator("text")
    @classmethod
    def _not_blank(cls, text: str) -> str:
        if not text.strip():
            raise ValueError("Текст пустой")
        return text


class CheckResult(BaseModel):
    author_id: str
    score: float | None
    verdict: Literal["match", "uncertain", "mismatch", "not_enough_data"]
    signals: list[Signal]
    explanation: str | None = None
    challenge_question: str | None = None
