"""Двойники: какие авторы, скорее всего, один человек (TwinsResult).

Почерк сравниваем по половинам: сообщения автора случайно делятся пополам, для каждой
половины — центроид символьных n-грамм. Похожесть пары делим на самоподобие обоих
(насколько половины одного автора похожи друг на друга): 1 — «как человек сам на себя».
Дальше нормируем внутри чата: медиана по всем парам — уровень «разные люди этого чата».

К почерку добавляются улики: общие редкие слова, одинаковые привычки, не пишут в одну
минуту, быстро сменяют друг друга. Ядро (`Side`, `build_profiles`, `compare_pair`) не
привязано к одному чату — на нём же сравнение авторов из разных чатов.
"""

import itertools
import math
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from app import features
from app.models import Signal, TwinPair, TwinsResult, Validation
from app.store import StoredChat
from app.telegram import Message

LIKELY_SAME = 0.7
POSSIBLE = 0.4
MAX_PER_HALF = 3000  # больше на центроид почти не влияет, а считать дольше
# Отношение похожести к самоподобию у разных людей, если в чате не с кем сравнить
# (живой чат: 0.90–0.91, у половин одного автора — 0.999)
DEFAULT_STYLE_BASELINE = 0.9
RELIABLE_SELF_SIM = 0.8  # самоподобие половин, с которого оценке почерка верим полностью
MIN_BASELINE_PAIRS = 3

# Вклад улик в итоговую оценку
STYLE_WEIGHT = 0.65
RARE_WORDS_WEIGHT = 0.15
HABIT_WEIGHT, MAX_HABITS_WEIGHT = 0.05, 0.1
NO_OVERLAP_WEIGHT = 0.1
SWITCH_WEIGHT = 0.1

MIN_RARE_WORD_COUNT = 2  # слово должно быть у каждого хотя бы столько раз
MIN_RARE_WORDS = 2
# Улика, если общих «только наших» слов вдвое больше, чем у обычной пары в чате: при
# большом словаре такие слова случайно находятся у любых двоих
RARE_WORDS_SHARE = 2.0
HABIT_MAX_GAP = 0.15  # доли привычки у двоих различаются не больше чем на столько
HABIT_MIN_DEVIATION = 1.0  # и оба отклоняются от остальных хотя бы на столько «сигм»
MIN_COMMON_DAYS = 3
MIN_COMMON_MINUTES = 20
# Доля минут, когда оба писали одновременно, у живой пары собеседников (0.32–0.34)
DEFAULT_OVERLAP_RATE = 0.3
OVERLAP_SHARE = 0.25  # улика, если пересекаются в 4 раза реже обычного
MIN_SWITCHES = 5
SWITCH_SHARE = 0.5  # улика, если сменяют друг друга вдвое быстрее обычного


@dataclass
class Side:
    """Автор как участник сравнения: его тексты и время всех сообщений."""

    id: str
    texts: list[str]  # свой текст для почерка
    times: list[int]  # unixtime всех сообщений, включая пересланные


@dataclass
class Profile:
    halves: tuple[np.ndarray, np.ndarray]
    self_sim: float
    rates: dict[str, tuple[float, int]]
    words: Counter
    minutes: set[int] = field(default_factory=set)


@dataclass
class PairStats:
    """Что про пару известно до оценки — нужно и для нормировки по всему чату."""

    ratio: float  # похожесть почерка / самоподобие
    common_days: int
    overlap_minutes: int
    overlap_rate: float | None  # None — мало общих минут, чтобы судить
    switches: list[float]  # паузы, когда за одним сразу пишет второй, секунды
    rare_words: list[str] | None  # слова только этих двоих; None — в чате больше никого


@dataclass
class Baselines:
    style: float
    overlap_rate: float
    switch_seconds: float | None  # None — не с чем сравнить
    rare_words: float | None


def find_twins(stored: StoredChat) -> TwinsResult:
    if "twins" not in stored.cache:
        stored.cache["twins"] = _find_twins(stored)
    return stored.cache["twins"]


def _find_twins(stored: StoredChat) -> TwinsResult:
    chat = stored.chat
    ready = [a for a in chat.authors if a.enough_data]
    sides = sides_from_messages(stored.messages, {a.id for a in ready})
    all_texts = [m.style_text for m in stored.messages if m.has_style]
    vectorizer = features.char_ngram_vectorizer().fit(all_texts) if len(ready) >= 2 else None
    profiles = build_profiles(sides, vectorizer) if vectorizer else {}

    # тексты и привычки всех, включая авторов без enough_data: «больше ни у кого в чате»
    everyone_words = features._vocab(all_texts)
    everyone_rates = features.trait_rates(all_texts)
    has_others = len(chat.authors) > 2
    switches = _switches(stored.messages)

    stats = {
        (a, b): pair_stats(
            profiles[a],
            profiles[b],
            switches.get(frozenset((a, b)), []),
            everyone_words if has_others else None,
        )
        for a, b in itertools.combinations([a.id for a in ready], 2)
    }
    baselines = baselines_for(stats.values())
    pairs = [
        compare_pair(a, b, profiles[a], profiles[b], s, baselines, everyone_rates)
        for (a, b), s in stats.items()
    ]
    pairs.sort(key=lambda p: p.score, reverse=True)

    validation = None
    if len(ready) >= MIN_BASELINE_PAIRS:
        same = {frozenset((p.a, p.b)) for p in pairs if p.verdict == "likely_same"}
        validation = Validation(
            self_match_rate=round(self_match_rate(profiles, same), 2), authors_tested=len(ready)
        )
    return TwinsResult(chat_id=chat.id, authors=chat.authors, pairs=pairs, validation=validation)


def sides_from_messages(messages: list[Message], author_ids: set[str]) -> list[Side]:
    texts: dict[str, list[str]] = defaultdict(list)
    times: dict[str, list[int]] = defaultdict(list)
    for m in messages:
        if m.author_id in author_ids:
            times[m.author_id].append(int(m.sent_at.timestamp()))
            if m.has_style:
                texts[m.author_id].append(m.style_text)
    return [Side(a, texts[a], times[a]) for a in sorted(author_ids)]


def build_profiles(sides: list[Side], vectorizer: TfidfVectorizer) -> dict[str, Profile]:
    profiles = {}
    for side in sides:
        # половины — случайные, а не чётные/нечётные: чётность может совпасть с ритмом
        # переписки (например, «привет» и следом вопрос)
        order = np.random.default_rng(0).permutation(len(side.texts))[: 2 * MAX_PER_HALF]
        rows = normalize(vectorizer.transform([side.texts[i] for i in order]))
        halves = tuple(_centroid(rows[k::2]) for k in (0, 1))
        profiles[side.id] = Profile(
            halves=halves,
            self_sim=float(halves[0] @ halves[1]),
            rates=features.trait_rates(side.texts),
            words=features._vocab(side.texts),
            minutes={t // 60 for t in side.times},
        )
    return profiles


def _centroid(rows) -> np.ndarray:
    return normalize(np.asarray(rows.mean(axis=0)))[0]


def style_ratio(a: Profile, b: Profile) -> float:
    sim = np.mean([a.halves[i] @ b.halves[j] for i in (0, 1) for j in (0, 1)])
    return float(sim / math.sqrt(max(a.self_sim * b.self_sim, 1e-6)))


def pair_stats(
    a: Profile, b: Profile, switches: list[float], everyone_words: Counter | None
) -> PairStats:
    """`everyone_words` — словарь всего чата; None, если в чате нет никого, кроме этих двоих."""
    a_days = {m // 1440 for m in a.minutes}
    common = a_days & {m // 1440 for m in b.minutes}
    a_min = {m for m in a.minutes if m // 1440 in common}
    b_min = {m for m in b.minutes if m // 1440 in common}
    overlap = len(a_min & b_min)
    enough = len(common) >= MIN_COMMON_DAYS and min(len(a_min), len(b_min)) >= MIN_COMMON_MINUTES
    return PairStats(
        ratio=style_ratio(a, b),
        common_days=len(common),
        overlap_minutes=overlap,
        overlap_rate=overlap / min(len(a_min), len(b_min)) if enough else None,
        switches=switches,
        rare_words=_rare_words(a, b, everyone_words) if everyone_words is not None else None,
    )


def _rare_words(a: Profile, b: Profile, everyone: Counter) -> list[str]:
    shared = [
        w
        for w, n in a.words.items()
        if n >= MIN_RARE_WORD_COUNT
        and b.words[w] >= MIN_RARE_WORD_COUNT
        and everyone[w] == n + b.words[w]
    ]
    return sorted(shared, key=lambda w: (-min(a.words[w], b.words[w]), w))


def _switches(messages: list[Message]) -> dict[frozenset[str], list[float]]:
    """Для каждой пары — паузы, когда за сообщением одного сразу идёт сообщение второго."""
    result: dict[frozenset[str], list[float]] = defaultdict(list)
    for prev, nxt in itertools.pairwise(messages):
        if prev.author_id != nxt.author_id:
            pause = (nxt.sent_at - prev.sent_at).total_seconds()
            result[frozenset((prev.author_id, nxt.author_id))].append(pause)
    return result


def baselines_for(stats: Iterable[PairStats]) -> Baselines:
    stats = list(stats)
    ratios = [s.ratio for s in stats]
    overlaps = [s.overlap_rate for s in stats if s.overlap_rate is not None]
    switches = [float(np.median(s.switches)) for s in stats if len(s.switches) >= MIN_SWITCHES]
    return Baselines(
        style=_median(ratios, DEFAULT_STYLE_BASELINE),
        overlap_rate=_median(overlaps, DEFAULT_OVERLAP_RATE),
        switch_seconds=_median(switches, None),
        rare_words=_median([len(s.rare_words) for s in stats if s.rare_words is not None], None),
    )


def _median(values: list[float], default: float | None) -> float | None:
    """Медиана по парам чата, если пар хватает, чтобы ей верить."""
    return float(np.median(values)) if len(values) >= MIN_BASELINE_PAIRS else default


def compare_pair(
    a_id: str,
    b_id: str,
    a: Profile,
    b: Profile,
    stats: PairStats,
    baselines: Baselines,
    everyone_rates: dict[str, tuple[float, int]],
) -> TwinPair:
    signals = [
        *_style_signal(a, b, stats, baselines),
        *_rare_words_signal(stats, baselines),
        *_habits_signal(a, b, everyone_rates),
        *_no_overlap_signal(stats, baselines),
        *_switch_signal(stats, baselines),
    ]
    signals.sort(key=lambda s: s.weight, reverse=True)
    score = min(1.0, sum(s.weight for s in signals))
    return TwinPair(a=a_id, b=b_id, score=round(score, 2), verdict=_verdict(score), signals=signals)


def _verdict(score: float) -> str:
    if score >= LIKELY_SAME:
        return "likely_same"
    if score >= POSSIBLE:
        return "possible"
    return "different"


def _signal(feature: str, label: str, observed: str, weight: float) -> Signal:
    return Signal(
        feature=feature,
        label=label,
        expected=None,
        observed=observed,
        span=None,
        weight=round(weight, 2),
    )


def style_score(a: Profile, b: Profile, stats: PairStats, baselines: Baselines) -> float:
    """0 — как разные люди этого чата, 1 — как половины одного автора."""
    base = baselines.style
    raw = (stats.ratio - base) / (1 - base) if base < 1 else 0.0
    # на малых объёмах половины и самих себя узнают плохо — оценке верим меньше
    reliability = min(1.0, math.sqrt(max(a.self_sim * b.self_sim, 0.0)) / RELIABLE_SELF_SIM)
    return reliability * min(1.0, max(0.0, raw))


def _style_signal(a: Profile, b: Profile, stats: PairStats, baselines: Baselines) -> list[Signal]:
    style = style_score(a, b, stats, baselines)
    if style < 0.15:
        return []
    if style >= 0.8:
        observed = "похожи почти как две половины переписки одного человека"
    elif style >= 0.5:
        observed = "заметно ближе друг к другу, чем остальные"
    else:
        observed = "немного ближе друг к другу, чем остальные"
    return [_signal("style", "Общий почерк", observed, STYLE_WEIGHT * style)]


def _rare_words_signal(stats: PairStats, baselines: Baselines) -> list[Signal]:
    shared = stats.rare_words
    if shared is None or len(shared) < MIN_RARE_WORDS:
        return []
    if baselines.rare_words is not None and len(shared) < RARE_WORDS_SHARE * baselines.rare_words:
        return []
    words = ", ".join(f"«{w}»" for w in shared[:3])
    observed = f"{words} — больше ни у кого в чате"
    return [_signal("rare_words", "Общие редкие слова", observed, RARE_WORDS_WEIGHT)]


def _habits_signal(a: Profile, b: Profile, everyone: dict[str, tuple[float, int]]) -> list[Signal]:
    labels = []
    for spec in features.TRAIT_SPECS:
        (ra, na), (rb, nb) = a.rates[spec.key], b.rates[spec.key]
        if min(na, nb) < features.MIN_ELIGIBLE or abs(ra - rb) > HABIT_MAX_GAP:
            continue
        # с кем сравнивать: остальные в чате, а если их нет — обычная переписка
        re_, ne = everyone[spec.key]
        rest_n = ne - na - nb
        rest = (re_ * ne - ra * na - rb * nb) / rest_n if rest_n >= features.MIN_ELIGIBLE else None
        ref = spec.prior if rest is None else rest
        sigma = math.sqrt(spec.prior * (1 - spec.prior))
        da, db = (ra - ref) / sigma, (rb - ref) / sigma
        if min(da, db) >= HABIT_MIN_DEVIATION:
            labels.append(spec.label)
        elif max(da, db) <= -HABIT_MIN_DEVIATION and spec.inverse_label:
            labels.append(spec.inverse_label)
    if not labels:
        return []
    observed = ", ".join(_lower_first(label) for label in labels[:3]) + " — у обоих"
    weight = min(MAX_HABITS_WEIGHT, HABIT_WEIGHT * len(labels))
    return [_signal("punctuation", "Одинаковые привычки", _upper_first(observed), weight)]


def _no_overlap_signal(stats: PairStats, baselines: Baselines) -> list[Signal]:
    if stats.overlap_rate is None or stats.overlap_rate > OVERLAP_SHARE * baselines.overlap_rate:
        return []
    n, days = stats.overlap_minutes, stats.common_days
    observed = (
        f"{n} {_plural(n, 'случай', 'случая', 'случаев')}, когда оба писали в одну минуту, "
        f"за {days} {_plural(days, 'общий день', 'общих дня', 'общих дней')}"
    )
    return [_signal("no_overlap", "Не пишут одновременно", observed, NO_OVERLAP_WEIGHT)]


def _switch_signal(stats: PairStats, baselines: Baselines) -> list[Signal]:
    if baselines.switch_seconds is None or len(stats.switches) < MIN_SWITCHES:
        return []
    median = float(np.median(stats.switches))
    if median > SWITCH_SHARE * baselines.switch_seconds:
        return []
    usual = round(baselines.switch_seconds)
    observed = f"медиана {round(median)} с между сообщениями A и B, обычно в чате — {usual} с"
    return [_signal("switch_time", "Быстрое переключение", observed, SWITCH_WEIGHT)]


def self_match_rate(profiles: dict[str, Profile], same: set[frozenset[str]]) -> float:
    """Доля авторов, чьи половины — самые похожие друг на друга среди всех половин чата.

    Если ближайшей оказалась половина найденного двойника (`same`), это тоже попадание:
    половина нашла того же человека.
    """
    keys = [(a, k) for a in profiles for k in (0, 1)]
    matrix = np.array([profiles[a].halves[k] for a, k in keys])
    sims = matrix @ matrix.T
    np.fill_diagonal(sims, -np.inf)
    nearest = sims.argmax(axis=1)

    def found(i: int) -> bool:
        a, b = keys[i][0], keys[nearest[i]][0]
        return a == b or frozenset((a, b)) in same

    hits = sum(1 for i in range(0, len(keys), 2) if found(i) and found(i + 1))
    return hits / len(profiles) if profiles else 0.0


def _plural(n: int, one: str, few: str, many: str) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def _upper_first(text: str) -> str:
    return text[:1].upper() + text[1:]
