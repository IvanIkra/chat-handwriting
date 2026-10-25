"""Сравнение двух чатов: кто из авторов чата A и чата B, скорее всего, один человек.

Ядро то же, что у двойников (`app/twins.py`). Отличие — в нормировке почерка: в разных
чатах человек пишет на другие темы и другим людям, так что «как сам на себя внутри одного
чата» — слишком высокая планка. Если в обоих чатах есть общий аккаунт (обычно тот, кто
делал экспорт), он её и задаёт: насколько похож на себя один человек в двух чатах. А его
пары с чужими авторами другого чата — уровень «разные люди в разных чатах».
"""

from collections import defaultdict
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from app import features, twins
from app.check import _active_window
from app.models import Comparison, Signal, TwinPair
from app.store import StoredChat
from app.twins import Profile

# Отношение похожести к самоподобию у разных людей в разных чатах, если не с кем сравнить
DEFAULT_CROSS_BASELINE = 0.85
MIN_REFERENCE_GAP = 0.02  # общий аккаунт должен быть заметно ближе к себе, чем к чужим
# Один человек и разные люди различаются меньше — почерк в этих чатах ничего не говорит
# (на демо разрыв 0.3–0.5)
MIN_STYLE_GAP = 0.1
# Временных улик между чатами нет (не пишут одновременно и т.п.), поэтому почерк весит
# больше, чем у двойников
STYLE_WEIGHT = 0.75

SHARED_WORDS_WEIGHT, MAX_SHARED_WORDS_WEIGHT = 0.05, 0.15
MIN_SHARED_WORDS = 2
TOP_WORDS = 15
HOURS_WEIGHT = 0.1
HOURS_MARGIN = 0.1  # часы совпадают на столько сильнее, чем у разных людей
MIN_HOURS_SIMILARITY = 0.6
DEFAULT_HOURS_SIMILARITY = 0.7  # у разных людей, если не с кем сравнить


@dataclass
class _Member:
    chat: str  # "a" или "b"
    author_id: str
    profile: Profile
    hours: np.ndarray  # 24 счётчика по часам UTC
    top_words: list[str]


@dataclass
class _References:
    same: float  # почерк одного человека в двух чатах
    different: float  # почерк разных людей в разных чатах
    hours: float  # совпадение часов у разных людей


def compare_chats(a: StoredChat, b: StoredChat) -> Comparison:
    key = f"compare:{b.chat.id}"
    if key not in a.cache:
        a.cache[key] = _compare(a, b)
    return a.cache[key]


def _compare(a: StoredChat, b: StoredChat) -> Comparison:
    shared = sorted({x.id for x in a.chat.authors} & {x.id for x in b.chat.authors})
    result = Comparison(a=a.chat, b=b.chat, shared=shared, pairs=[])

    # без своего текста сравнивать нечего — и векторизатору не на чем учиться
    if not any(x.enough_data for x in a.chat.authors) or not any(
        x.enough_data for x in b.chat.authors
    ):
        return result
    texts = [m.style_text for s in (a, b) for m in s.messages if m.has_style]
    # один векторизатор на оба чата — иначе центроиды из разных пространств
    vectorizer = features.char_ngram_vectorizer().fit(texts)
    members_a = _members(a, "a", vectorizer)
    members_b = _members(b, "b", vectorizer)
    if not members_a or not members_b:
        return result

    cross = [(x, y) for x in members_a for y in members_b]
    refs = _references(cross, shared)
    everyone_rates = features.trait_rates(texts)
    result.pairs = sorted(
        (
            _compare_pair(x, y, refs, everyone_rates)
            for x, y in cross
            if x.author_id not in shared and y.author_id not in shared
        ),
        key=lambda p: p.score,
        reverse=True,
    )
    return result


def _members(stored: StoredChat, chat: str, vectorizer: TfidfVectorizer) -> list[_Member]:
    # общие аккаунты тоже нужны — по ним калибруемся
    ready = {x.id for x in stored.chat.authors if x.enough_data}
    if not ready:
        return []
    sides = twins.sides_from_messages(stored.messages, ready)
    profiles = twins.build_profiles(sides, vectorizer)

    by_author: dict[str, list[str]] = defaultdict(list)
    for m in stored.messages:
        if m.has_style:
            by_author[m.author_id].append(m.style_text)
    members = []
    for side in sides:
        hours = np.zeros(24)
        for t in side.times:
            hours[(t // 3600) % 24] += 1
        others = [t for author, ts in by_author.items() if author != side.id for t in ts]
        top = features.characteristic_words(side.texts, others, limit=TOP_WORDS)
        members.append(_Member(chat, side.id, profiles[side.id], hours, top))
    return members


def _style_ratio(x: _Member, y: _Member) -> float:
    # на малых объёмах похожесть на чужого бывает выше самоподобия — больше 1 не считаем
    return min(1.0, twins.style_ratio(x.profile, y.profile))


def _references(cross: list[tuple[_Member, _Member]], shared: list[str]) -> _References:
    same = [_style_ratio(x, y) for x, y in cross if x.author_id == y.author_id]
    # пары общего аккаунта с чужим автором другого чата — точно разные люди
    known_different = [
        (x, y)
        for x, y in cross
        if x.author_id != y.author_id and {x.author_id, y.author_id} & set(shared)
    ]
    different_pairs = known_different or [(x, y) for x, y in cross if x.author_id != y.author_id]
    ratios = [_style_ratio(x, y) for x, y in different_pairs]
    if known_different:
        different = float(np.median(ratios))
    else:
        # без общего аккаунта: медиана пар — в основном разные люди, если пар хватает
        different = twins._median(ratios, DEFAULT_CROSS_BASELINE)
    same_level = float(np.median(same)) if same else 1.0
    if same_level < different + MIN_REFERENCE_GAP:
        same_level = max(1.0, different + MIN_REFERENCE_GAP)

    hours = [_hours_similarity(x.hours, y.hours) for x, y in different_pairs]
    if known_different:
        hours_level = float(np.median(hours))
    else:
        hours_level = twins._median(hours, DEFAULT_HOURS_SIMILARITY)
    return _References(same=same_level, different=different, hours=hours_level)


def _compare_pair(
    x: _Member, y: _Member, refs: _References, everyone_rates: dict[str, tuple[float, int]]
) -> TwinPair:
    signals = [
        *_style_signal(x, y, refs),
        *twins._habits_signal(x.profile, y.profile, everyone_rates),
        *_shared_words_signal(x, y),
        *_hours_signal(x, y, refs),
    ]
    signals.sort(key=lambda s: s.weight, reverse=True)
    score = min(1.0, sum(s.weight for s in signals))
    return TwinPair(
        a=x.author_id,
        b=y.author_id,
        score=round(score, 2),
        verdict=twins._verdict(score),
        signals=signals,
    )


def style_score(x: _Member, y: _Member, refs: _References) -> float:
    """0 — как разные люди в разных чатах, 1 — как один человек в двух чатах."""
    gap = refs.same - refs.different
    if gap < MIN_STYLE_GAP:
        return 0.0
    raw = (_style_ratio(x, y) - refs.different) / gap
    reliability = min(
        1.0,
        np.sqrt(max(x.profile.self_sim * y.profile.self_sim, 0.0)) / twins.RELIABLE_SELF_SIM,
    )
    return float(reliability * min(1.0, max(0.0, raw)))


def _style_signal(x: _Member, y: _Member, refs: _References) -> list[Signal]:
    style = style_score(x, y, refs)
    if style < 0.15:
        return []
    if style >= 0.8:
        observed = "похожи почти как один человек в двух разных чатах"
    elif style >= 0.5:
        observed = "заметно похожи — ближе, чем разные люди"
    else:
        observed = "немного похожи"
    return [twins._signal("style", "Общий почерк", observed, STYLE_WEIGHT * style)]


def _shared_words_signal(x: _Member, y: _Member) -> list[Signal]:
    common = [w for w in x.top_words if w in set(y.top_words)]
    if len(common) < MIN_SHARED_WORDS:
        return []
    words = ", ".join(f"«{w}»" for w in common[:3])
    weight = min(MAX_SHARED_WORDS_WEIGHT, SHARED_WORDS_WEIGHT * len(common))
    return [
        twins._signal("shared_words", "Общие словечки", f"{words} — характерны для обоих", weight)
    ]


def _hours_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Пересечение распределений по часам: 1 — пишут в одни и те же часы."""
    if not a.sum() or not b.sum():
        return 0.0
    return float(np.minimum(a / a.sum(), b / b.sum()).sum())


def _hours_signal(x: _Member, y: _Member, refs: _References) -> list[Signal]:
    similarity = _hours_similarity(x.hours, y.hours)
    if similarity < max(MIN_HOURS_SIMILARITY, refs.hours + HOURS_MARGIN):
        return []
    total = x.hours / x.hours.sum() + y.hours / y.hours.sum()
    observed = f"оба обычно пишут {_active_window(total)} UTC"
    return [twins._signal("active_hours", "Одинаковое время активности", observed, HOURS_WEIGHT)]
