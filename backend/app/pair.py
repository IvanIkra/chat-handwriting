"""Подробное сравнение пары двойников (PairDetails): примеры сообщений и время.

Пример — сообщение A и сообщение B, на которых видна улика пары: одно и то же редкое
слово, общая привычка, быстрое переключение, похожий почерк.
"""

import bisect
import itertools
from collections.abc import Callable

import numpy as np
from sklearn.preprocessing import normalize

from app import features, twins
from app.errors import ApiError
from app.models import PairDetails, PairExample, PairMessage, Timeline
from app.store import StoredChat
from app.telegram import Message

MAX_EXAMPLES = 5
MAX_PER_SIGNAL = 2
STYLE_SAMPLE = 300  # сообщений каждого — для поиска самой похожей пары
MIN_STYLE_LENGTH = 15  # короче — «ок» и «да», похожесть ни о чём не говорит


def pair_details(stored: StoredChat, a_id: str, b_id: str) -> PairDetails:
    analysis = twins.analyze(stored)
    pair = next((p for p in analysis.result.pairs if {p.a, p.b} == {a_id, b_id}), None)
    if a_id == b_id or pair is None:
        raise ApiError(404, "not_found", "Такой пары нет — у одного из авторов мало сообщений")
    stats = analysis.stats[(pair.a, pair.b)]
    if pair.a != a_id:
        pair = pair.model_copy(update={"a": a_id, "b": b_id})

    own_a = [m for m in stored.messages if m.author_id == a_id and m.has_style]
    own_b = [m for m in stored.messages if m.author_id == b_id and m.has_style]
    builders: dict[str, Callable[[], list[tuple[Message, Message]]]] = {
        "style": lambda: _style_examples(analysis, own_a, own_b),
        "rare_words": lambda: _word_examples(stats.rare_words or [], own_a, own_b),
        "punctuation": lambda: _habit_examples(analysis, a_id, b_id, own_a, own_b),
        "switch_time": lambda: _switch_examples(stored.messages, a_id, b_id),
    }
    # улики уже отсортированы по весу
    found = [(s.feature, builders[s.feature]()) for s in pair.signals if s.feature in builders]

    # сначала по одному примеру на каждую улику, потом вторые
    examples, seen = [], set()
    for k in range(MAX_PER_SIGNAL):
        for feature, pairs in found:
            if k < len(pairs) and (pairs[k][0].id, pairs[k][1].id) not in seen:
                seen.add((pairs[k][0].id, pairs[k][1].id))
                examples.append(_example(feature, *pairs[k]))
    examples = examples[:MAX_EXAMPLES]

    authors = {a.id: a for a in stored.chat.authors}
    switches = stats.switches
    return PairDetails(
        pair=pair,
        a=authors[a_id],
        b=authors[b_id],
        examples=examples,
        timeline=Timeline(
            overlap_minutes=stats.overlap_minutes,
            median_switch_seconds=round(float(np.median(switches))) if switches else None,
        ),
    )


def _example(feature: str, a: Message, b: Message) -> PairExample:
    return PairExample(
        feature=feature,
        a=PairMessage(text=a.text, sent_at=a.sent_at),
        b=PairMessage(text=b.text, sent_at=b.sent_at),
    )


def _closest(a: list[Message], b: list[Message]) -> tuple[Message, Message] | None:
    """Пара сообщений A и B, ближайших по времени (сообщения отсортированы по времени)."""
    if not a or not b:
        return None
    times = [m.sent_at for m in b]
    best = None
    for m in a:
        i = bisect.bisect_left(times, m.sent_at)
        for j in (i - 1, i):
            if 0 <= j < len(b):
                gap = abs((b[j].sent_at - m.sent_at).total_seconds())
                if best is None or gap < best[0]:
                    best = (gap, m, b[j])
    return best[1], best[2]


def _with_word(messages: list[Message], word: str) -> list[Message]:
    return [
        m
        for m in messages
        if word in {features._normalize_word(w) for w in features.words(m.style_text)}
    ]


def _word_examples(
    words: list[str], own_a: list[Message], own_b: list[Message]
) -> list[tuple[Message, Message]]:
    result = []
    for word in words[:MAX_PER_SIGNAL]:
        if example := _closest(_with_word(own_a, word), _with_word(own_b, word)):
            result.append(example)
    return result


def _habit_examples(
    analysis: twins.TwinsAnalysis,
    a_id: str,
    b_id: str,
    own_a: list[Message],
    own_b: list[Message],
) -> list[tuple[Message, Message]]:
    habits = twins.shared_habits(
        analysis.profiles[a_id], analysis.profiles[b_id], analysis.everyone_rates
    )
    result = []
    for spec, present in habits[:MAX_PER_SIGNAL]:
        with_a = [m for m in own_a if spec.check(m.style_text) is present]
        with_b = [m for m in own_b if spec.check(m.style_text) is present]
        if example := _closest(with_a, with_b):
            result.append(example)
    return result


def _switch_examples(
    messages: list[Message], a_id: str, b_id: str
) -> list[tuple[Message, Message]]:
    switches = [
        (prev, nxt)
        for prev, nxt in itertools.pairwise(messages)
        if {prev.author_id, nxt.author_id} == {a_id, b_id}
    ]
    if not switches:
        return []
    pauses = [(nxt.sent_at - prev.sent_at).total_seconds() for prev, nxt in switches]
    median = float(np.median(pauses))
    # самое типичное переключение — с паузой ближе всего к медиане
    i = min(range(len(switches)), key=lambda k: abs(pauses[k] - median))
    prev, nxt = switches[i]
    return [(prev, nxt) if prev.author_id == a_id else (nxt, prev)]


def _sample(messages: list[Message]) -> list[Message]:
    long = [m for m in messages if len(m.style_text) >= MIN_STYLE_LENGTH]
    step = max(1, len(long) // STYLE_SAMPLE)
    return long[::step][:STYLE_SAMPLE]


def _style_examples(
    analysis: twins.TwinsAnalysis, own_a: list[Message], own_b: list[Message]
) -> list[tuple[Message, Message]]:
    sample_a, sample_b = _sample(own_a), _sample(own_b)
    if not sample_a or not sample_b or analysis.vectorizer is None:
        return []
    va = normalize(analysis.vectorizer.transform([m.style_text for m in sample_a]))
    vb = normalize(analysis.vectorizer.transform([m.style_text for m in sample_b]))
    sims = (va @ vb.T).toarray()
    result, used_a, used_b = [], set(), set()
    for flat in np.argsort(sims, axis=None)[::-1]:
        i, j = divmod(int(flat), sims.shape[1])
        if i in used_a or j in used_b:
            continue
        result.append((sample_a[i], sample_b[j]))
        used_a.add(i)
        used_b.add(j)
        if len(result) >= MAX_PER_SIGNAL:
            break
    return result
