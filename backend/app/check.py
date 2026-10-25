"""Проверка сообщения: похоже ли оно на почерк автора (CheckResult).

Основа оценки — классификатор по символьным n-граммам «автор против остальных в чате».
Дальше её снижают улики — места, где текст идёт против привычек автора. Сила улики —
логарифм отношения правдоподобий (LLR): во сколько раз такое вероятнее у обычного
человека, чем у этого автора.
"""

import math
import random
import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from app import features
from app.models import Author, CheckResult, Signal
from app.store import StoredChat

MATCH_SCORE = 0.6  # от этого — match
MISMATCH_SCORE = 0.35  # до этого — mismatch, между — uncertain
MIN_LLR = 1.0  # слабее — не улика
MAX_LLR = 3.0  # одна улика не решает всё
STRENGTH_SCALE = 0.4  # сколько логитов оценки снимает единица LLR
# По одному короткому сообщению классификатор угадывает слабо (AUC ≈ 0.72 на живом чате),
# поэтому его логит ослабляем, а вниз — не дальше uncertain: mismatch дают только улики
BASE_LOGIT_SCALE = 0.6
MAX_BASE_LOGIT = 4.0
MIN_BASE_LOGIT = -0.5
MAX_RARE_WORDS = 3
MAX_TRAIN_PER_CLASS = 10_000
STEM_LEN = 5  # слова сравниваем по началу: «займи» и «займу» — одно слово
GREETING_RATE = 0.03  # доля сообщений с конкретным приветствием в обычной переписке
RARE_WORD_RATE = 1 / 50_000  # частота слова, которого в чате не писал никто
LENGTH_TAIL = 0.05  # улика, если длиннее почти всех сообщений автора (≈ 2% ложных)
HOURS_RATE = 1 / 24  # улика, если в эти часы у автора меньше ≈ 1,5% сообщений
ACTIVE_HOURS_SHARE = 0.9

GREETING_RE = re.compile(
    r"(?:привет\w*|прив|здравствуй\w*|здрасьте|здаров\w*|добр\w+ (?:утр|д[ен]|вечер|ноч)\w*"
    r"|салют|хай|хеллоу|йо|ку|hi|hello|hey)\b",
    re.IGNORECASE,
)
FINAL_DOT_RE = re.compile(r"(?<!\.)\.(?=\s*$)")
SPAN_RES = {
    "emoji": features.EMOJI_RE,
    "multi_exclaim": re.compile(r"!{2,}"),
    "multi_question": re.compile(r"\?{2,}"),
    "ellipsis": re.compile(r"\.{3,}|…"),
    "commas": re.compile(","),
    "caps_words": features.CAPS_WORD_RE,
    "latin_words": features.LATIN_WORD_RE,
    "space_before_punct": re.compile(r"(?<=\w) [?!,]"),
}

# Черта → (название улики, как выглядит признак, как выглядит его отсутствие)
TRAIT_SIGNALS = {
    "lowercase_start": ("Буква в начале", "строчная", "заглавная"),
    "final_dot": ("Точка в конце", "с точкой", "без точки"),
    "brackets_smile": ("Скобки-смайлы", "со скобкой «)»", "без скобок"),
    "emoji": ("Эмодзи", "с эмодзи", "без эмодзи"),
    "multi_exclaim": ("Восклицательные знаки", "«!!»", "без «!!»"),
    "multi_question": ("Вопросительные знаки", "«??»", "без «??»"),
    "ellipsis": ("Многоточие", "с многоточием", "без многоточий"),
    "commas": ("Запятые", "с запятыми", "без запятых"),
    "caps_words": ("Капс", "слова капсом", "без капса"),
    "latin_words": ("Латиница", "слова латиницей", "без латиницы"),
    "space_before_punct": ("Пробел перед знаком", "с пробелом", "без пробела"),
}


@dataclass
class ChatModel:
    vectorizer: TfidfVectorizer
    stems: Counter  # основы слов всех авторов
    n_words: int


@dataclass
class AuthorModel:
    rates: dict[str, tuple[float, int]]
    greetings: Counter  # приветствие в начале сообщения → сколько раз
    n_texts: int
    stems: Counter
    n_words: int
    lengths: np.ndarray  # длины своих сообщений, по возрастанию
    hours: np.ndarray  # 24 счётчика по часам UTC, по всем сообщениям
    classifier: LogisticRegression | None  # None — сравнивать не с кем


@dataclass
class _Evidence:
    llr: float
    feature: str
    label: str
    expected: str | None
    observed: str
    span: tuple[int, int] | None


def check_message(
    stored: StoredChat, author: Author, text: str, sent_at: datetime | None = None
) -> CheckResult:
    if not author.enough_data:
        return CheckResult(author_id=author.id, score=None, verdict="not_enough_data", signals=[])
    chat = chat_model(stored)
    model = author_model(stored, author.id)
    clean = features.clean_text(text)

    base = 0.5
    if clean and model.classifier is not None:
        base = float(model.classifier.predict_proba(chat.vectorizer.transform([clean]))[0, 1])

    evidence: list[_Evidence] = []
    if clean:
        noise = [m.span() for m in features.NOISE_RE.finditer(text)]
        evidence += _trait_evidence(model, text, clean, noise)
        evidence += _greeting_evidence(model, text, noise)
        evidence += _rare_word_evidence(chat, model, text, noise)
        evidence += _length_evidence(model, clean)
    if sent_at is not None:
        evidence += _hours_evidence(model, sent_at)
    evidence = [e for e in evidence if e.llr >= MIN_LLR]

    logit = BASE_LOGIT_SCALE * math.log(base / (1 - base))
    logit = max(MIN_BASE_LOGIT, min(MAX_BASE_LOGIT, logit))
    strengths = [STRENGTH_SCALE * min(e.llr, MAX_LLR) for e in evidence]
    score = 1 / (1 + math.exp(-(logit - sum(strengths))))

    signals = [
        Signal(
            feature=e.feature,
            label=e.label,
            expected=e.expected,
            observed=e.observed,
            span=list(e.span) if e.span else None,
            weight=round(1 - math.exp(-s), 2),
        )
        for e, s in zip(evidence, strengths, strict=True)
    ]
    signals.sort(key=lambda s: s.weight, reverse=True)
    return CheckResult(
        author_id=author.id, score=round(score, 2), verdict=_verdict(score), signals=signals
    )


def _verdict(score: float) -> str:
    if score >= MATCH_SCORE:
        return "match"
    if score <= MISMATCH_SCORE:
        return "mismatch"
    return "uncertain"


def chat_model(stored: StoredChat) -> ChatModel:
    if "check" not in stored.cache:
        texts = [m.style_text for m in stored.messages if m.has_style]
        vectorizer = features.char_ngram_vectorizer()
        vectorizer.fit(texts)
        stems = _stems(texts)
        stored.cache["check"] = ChatModel(vectorizer, stems, sum(stems.values()))
    return stored.cache["check"]


def author_model(stored: StoredChat, author_id: str) -> AuthorModel:
    key = f"check:{author_id}"
    if key not in stored.cache:
        stored.cache[key] = _build_author_model(stored, author_id)
    return stored.cache[key]


def _build_author_model(stored: StoredChat, author_id: str) -> AuthorModel:
    own = [m.style_text for m in stored.messages if m.author_id == author_id and m.has_style]
    others = [m.style_text for m in stored.messages if m.author_id != author_id and m.has_style]

    classifier = None
    if others:
        rng = random.Random(0)
        pos = rng.sample(own, min(len(own), MAX_TRAIN_PER_CLASS))
        neg = rng.sample(others, min(len(others), MAX_TRAIN_PER_CLASS))
        x = chat_model(stored).vectorizer.transform(pos + neg)
        y = [1] * len(pos) + [0] * len(neg)
        # balanced — чтобы оценка не зависела от того, кто в чате больше пишет
        classifier = LogisticRegression(class_weight="balanced", max_iter=1000)
        classifier.fit(x, y)

    hours = np.zeros(24)
    for m in stored.messages:
        if m.author_id == author_id:
            hours[m.sent_at.hour] += 1

    stems = _stems(own)
    return AuthorModel(
        rates=features.trait_rates(own),
        greetings=Counter(g.group().lower() for t in own if (g := GREETING_RE.match(t))),
        n_texts=len(own),
        stems=stems,
        n_words=sum(stems.values()),
        lengths=np.sort([len(t) for t in own]),
        hours=hours,
        classifier=classifier,
    )


def _stems(texts: Iterable[str]) -> Counter:
    return Counter(w[:STEM_LEN] for w in features._vocab(texts).elements())


def _outside(span: tuple[int, int], noise: list[tuple[int, int]]) -> bool:
    return all(span[1] <= s or span[0] >= e for s, e in noise)


def _find(pattern: re.Pattern, text: str, noise: list[tuple[int, int]]) -> tuple[int, int] | None:
    return next((m.span() for m in pattern.finditer(text) if _outside(m.span(), noise)), None)


def _start(text: str, noise: list[tuple[int, int]]) -> int | None:
    """Где начинается сам текст — первый непробельный символ вне ссылок и упоминаний."""
    span = _find(re.compile(r"\S"), text, noise)
    return span[0] if span else None


def _trait_span(key: str, text: str, noise: list[tuple[int, int]]) -> tuple[int, int] | None:
    if key == "lowercase_start":
        start = _start(text, noise)
        return (start, start + 1) if start is not None else None
    if key == "final_dot":
        return _find(FINAL_DOT_RE, text, noise)
    if key == "brackets_smile":
        return next((s for s in features.bracket_smile_spans(text) if text[s[0]] == ")"), None)
    return _find(SPAN_RES[key], text, noise)


def _trait_evidence(
    model: AuthorModel, text: str, clean: str, noise: list[tuple[int, int]]
) -> list[_Evidence]:
    result = []
    for spec in features.TRAIT_SPECS:
        if spec.key not in TRAIT_SIGNALS:
            continue
        observed = spec.check(clean)
        rate, eligible = model.rates[spec.key]
        if observed is None or eligible < features.MIN_ELIGIBLE:
            continue
        p_author = (rate * eligible + 1) / (eligible + 2)
        llr = (
            math.log(spec.prior / p_author)
            if observed
            else math.log((1 - spec.prior) / (1 - p_author))
        )
        label, present, absent = TRAIT_SIGNALS[spec.key]
        habit_share = max(rate, 1 - rate)
        habit = present if rate >= 0.5 else absent
        often = "почти всегда" if habit_share >= 0.9 else "обычно"
        # у отсутствующего признака места в тексте нет, кроме буквы в начале
        has_span = observed or spec.key == "lowercase_start"
        span = _trait_span(spec.key, text, noise) if has_span else None
        result.append(
            _Evidence(
                llr,
                spec.key if spec.key != "lowercase_start" else "capitalization",
                label,
                f"{often} {habit} ({features.percent(habit_share)}%)",
                present if observed else absent,
                span,
            )
        )
    return result


def _greeting_evidence(
    model: AuthorModel, text: str, noise: list[tuple[int, int]]
) -> list[_Evidence]:
    start = _start(text, noise)
    match = GREETING_RE.match(text, start) if start is not None else None
    if not match:
        return []
    greeting = match.group().lower()
    share = (model.greetings[greeting] + 0.5) / (model.n_texts + 1)
    usual = [f"«{g}»" for g, n in model.greetings.most_common(2) if n >= 2]
    expected = f"{', '.join(usual)} или без приветствия" if usual else "без приветствия"
    return [
        _Evidence(
            math.log(GREETING_RATE / share),
            "greeting",
            "Приветствие",
            expected,
            f"«{match.group()}»",
            match.span(),
        )
    ]


def _rare_word_evidence(
    chat: ChatModel, model: AuthorModel, text: str, noise: list[tuple[int, int]]
) -> list[_Evidence]:
    other_words = chat.n_words - model.n_words
    found: dict[str, _Evidence] = {}
    for m in features.WORD_RE.finditer(text):
        word = features._normalize_word(m.group().lower())
        stem = word[:STEM_LEN]
        if len(word) < 3 or word in features.STOPWORDS or stem in found:
            continue
        if model.stems[stem] or not _outside(m.span(), noise):
            continue
        rate = max((chat.stems[stem] / other_words) if other_words else 0.0, RARE_WORD_RATE)
        # вероятность ни разу не написать слово за n_words слов — exp(−n·rate);
        # минус один — новые слова бывают и у самого автора
        found[stem] = _Evidence(
            model.n_words * rate - 1,
            "rare_words",
            "Нетипичные слова",
            "не встречается в переписке",
            f"«{m.group()}»",
            m.span(),
        )
    return sorted(found.values(), key=lambda e: e.llr, reverse=True)[:MAX_RARE_WORDS]


def _length_evidence(model: AuthorModel, clean: str) -> list[_Evidence]:
    length = len(clean)
    longer = len(model.lengths) - np.searchsorted(model.lengths, length)
    tail = (longer + 0.5) / (len(model.lengths) + 1)
    llr = math.log(LENGTH_TAIL / tail)
    usual = int(np.percentile(model.lengths, 90))
    return [
        _Evidence(
            llr,
            "length",
            "Длина сообщения",
            f"обычно до {usual} {_chars(usual)}",
            f"{length} {_chars(length)}",
            None,
        )
    ]


def _hours_evidence(model: AuthorModel, sent_at: datetime) -> list[_Evidence]:
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=UTC)
    sent_at = sent_at.astimezone(UTC)
    h = sent_at.hour
    # соседние часы тоже считаем: в 23:50 и 00:10 человек одинаково «не спит»
    window = model.hours[(h - 1) % 24] + model.hours[h] + model.hours[(h + 1) % 24]
    p_author = (window + 1) / (model.hours.sum() + 8)
    return [
        _Evidence(
            math.log(HOURS_RATE / p_author),
            "active_hours",
            "Время отправки",
            f"обычно {_active_window(model.hours)} UTC",
            sent_at.strftime("%H:%M UTC"),
            None,
        )
    ]


def _active_window(hours: np.ndarray) -> str:
    """Самый короткий отрезок суток, в который автор пишет ACTIVE_HOURS_SHARE сообщений."""
    total = hours.sum()
    for width in range(1, 25):
        for start in range(24):
            if sum(hours[(start + i) % 24] for i in range(width)) >= ACTIVE_HOURS_SHARE * total:
                return f"{start:02d}:00–{(start + width) % 24:02d}:00"
    return "00:00–00:00"


def _chars(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return "символ"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return "символа"
    return "символов"
