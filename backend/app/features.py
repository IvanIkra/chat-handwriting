"""Признаки почерка: что и как часто делает автор в своих сообщениях.

Черты считаются как доля сообщений, к которым признак применим (например, «с маленькой
буквы» — только среди сообщений, начинающихся с буквы). У каждой черты есть `prior` —
примерная доля в обычной русской переписке; в паспорт попадают черты, сильнее всего
отличающиеся от неё.
"""

import math
import re
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

WORD_RE = re.compile(r"[a-zа-яё]+(?:-[a-zа-яё]+)*", re.IGNORECASE)
LATIN_WORD_RE = re.compile(r"\b[a-z]{2,}\b", re.IGNORECASE)
CAPS_WORD_RE = re.compile(r"\b[A-ZА-ЯЁ]{3,}\b")
EMOJI_RE = re.compile(
    "[\U0001f1e6-\U0001f1ff\U0001f300-\U0001f5ff\U0001f600-\U0001f64f\U0001f680-\U0001f6ff"
    "\U0001f900-\U0001faff☀-➿⭐⭕]"
)
SPACE_BEFORE_PUNCT_RE = re.compile(r"\w [?!,]")
SHORT_MESSAGE_CHARS = 20
LONG_MESSAGE_WORDS = 5

STOPWORDS = set(
    "и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только "
    "ее её мне было вот от меня еще ещё нет о из ему теперь когда даже ну вдруг ли если уже или "
    "ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут "
    "где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет "
    "ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы "
    "нее неё сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над "
    "больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою "
    "этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это".split()
)


def words(text: str) -> list[str]:
    return [w.lower() for w in WORD_RE.findall(text)]


def bracket_smiles(text: str) -> list[str]:
    """Скобки-смайлы: непарные «)» и «(»; серия «)))» считается за один смайл «)»."""
    unmatched: list[int] = []
    open_stack: list[int] = []
    for i, ch in enumerate(text):
        if ch == "(":
            open_stack.append(i)
        elif ch == ")":
            if open_stack:
                open_stack.pop()
            else:
                unmatched.append(i)
    unmatched.extend(open_stack)
    unmatched.sort()

    smiles = []
    prev = -2
    for i in unmatched:
        if not (i == prev + 1 and text[i] == text[prev]):
            smiles.append(text[i])
        prev = i
    return smiles


def emojis(text: str) -> list[str]:
    return EMOJI_RE.findall(text)


def _lowercase_start(text: str) -> bool | None:
    first = text.lstrip()[:1]
    return first.islower() if first.isalpha() else None


def _final_dot(text: str) -> bool:
    stripped = text.rstrip()
    return stripped.endswith(".") and not stripped.endswith("..")


def _commas(text: str) -> bool | None:
    return "," in text if len(words(text)) >= LONG_MESSAGE_WORDS else None


@dataclass(frozen=True)
class TraitSpec:
    key: str
    label: str
    description: str  # {p} — процент для показанного значения, {q} — для противоположного
    prior: float
    check: Callable[[str], bool | None]  # None — признак к сообщению не применим
    inverse_key: str | None = None
    inverse_label: str | None = None
    inverse_description: str | None = None


TRAIT_SPECS: list[TraitSpec] = [
    TraitSpec(
        "lowercase_start",
        "Пишет с маленькой буквы",
        "{p}% сообщений начинаются со строчной буквы",
        0.4,
        _lowercase_start,
        "capital_start",
        "Начинает с заглавной",
        "{p}% сообщений начинаются с заглавной буквы",
    ),
    TraitSpec(
        "final_dot",
        "Ставит точку в конце",
        "{p}% сообщений заканчиваются точкой",
        0.25,
        _final_dot,
        "no_final_dot",
        "Не ставит точку в конце",
        "Точка в конце — в {q}% сообщений",
    ),
    TraitSpec(
        "brackets_smile",
        "Скобки вместо эмодзи",
        "«)» или «))» в {p}% сообщений",
        0.1,
        lambda t: ")" in bracket_smiles(t),
    ),
    TraitSpec("emoji", "Любит эмодзи", "Эмодзи в {p}% сообщений", 0.1, lambda t: bool(emojis(t))),
    TraitSpec(
        "multi_exclaim",
        "Восклицает «!!»",
        "«!!» и больше в {p}% сообщений",
        0.03,
        lambda t: "!!" in t,
    ),
    TraitSpec(
        "multi_question",
        "Спрашивает «??»",
        "«??» и больше в {p}% сообщений",
        0.02,
        lambda t: "??" in t,
    ),
    TraitSpec(
        "ellipsis",
        "Многоточия",
        "«...» в {p}% сообщений",
        0.05,
        lambda t: "..." in t or "…" in t,
    ),
    TraitSpec(
        "commas",
        "Ставит запятые",
        "Запятые в {p}% сообщений от пяти слов",
        0.6,
        _commas,
        "no_commas",
        "Почти не ставит запятые",
        "Запятые только в {q}% сообщений от пяти слов",
    ),
    TraitSpec(
        "caps_words",
        "Пишет КАПСОМ",
        "Слова капсом в {p}% сообщений",
        0.03,
        lambda t: bool(CAPS_WORD_RE.search(t)),
    ),
    TraitSpec(
        "latin_words",
        "Вставляет латиницу",
        "Слова латиницей в {p}% сообщений",
        0.05,
        lambda t: bool(LATIN_WORD_RE.search(t)),
    ),
    TraitSpec(
        "space_before_punct",
        "Пробел перед знаками",
        "Пробел перед «?», «!» или «,» в {p}% сообщений",
        0.02,
        lambda t: bool(SPACE_BEFORE_PUNCT_RE.search(t)),
    ),
    TraitSpec(
        "short_messages",
        "Короткие сообщения",
        f"{{p}}% сообщений короче {SHORT_MESSAGE_CHARS} символов",
        0.45,
        lambda t: len(t) < SHORT_MESSAGE_CHARS,
        "long_messages",
        "Пишет развёрнуто",
        f"{{p}}% сообщений от {SHORT_MESSAGE_CHARS} символов",
    ),
]

MIN_ELIGIBLE = 5  # меньше применимых сообщений — черту не оцениваем


@dataclass(frozen=True)
class TraitValue:
    key: str
    label: str
    value: float
    description: str
    distinctiveness: float


def trait_rates(texts: Iterable[str]) -> dict[str, tuple[float, int]]:
    """Для каждой черты: (доля сообщений с признаком, сколько сообщений применимо)."""
    texts = list(texts)
    rates = {}
    for spec in TRAIT_SPECS:
        checks = [c for c in (spec.check(t) for t in texts) if c is not None]
        rate = sum(checks) / len(checks) if checks else 0.0
        rates[spec.key] = (rate, len(checks))
    return rates


def author_traits(texts: Iterable[str]) -> list[TraitValue]:
    """Все оценённые черты автора, от самой характерной к наименее."""
    rates = trait_rates(texts)
    result = []
    for spec in TRAIT_SPECS:
        rate, eligible = rates[spec.key]
        if eligible < MIN_ELIGIBLE:
            continue
        # отклонение от обычного в «сигмах», чтобы редкие признаки не терялись
        distinct = abs(rate - spec.prior) / math.sqrt(spec.prior * (1 - spec.prior))
        p, q = round(rate * 100), round((1 - rate) * 100)
        if rate >= spec.prior:
            result.append(
                TraitValue(spec.key, spec.label, rate, spec.description.format(p=p, q=q), distinct)
            )
        elif spec.inverse_key:
            result.append(
                TraitValue(
                    spec.inverse_key,
                    spec.inverse_label,
                    1 - rate,
                    spec.inverse_description.format(p=q, q=p),
                    distinct,
                )
            )
    result.sort(key=lambda t: t.distinctiveness, reverse=True)
    return result


def characteristic_words(
    own: Iterable[str], others: Iterable[str], limit: int = 8, min_count: int = 3
) -> list[str]:
    """Слова, которые автор пишет заметно чаще остальных (z-оценка log-odds со сглаживанием).

    Если сравнивать не с кем — просто самые частые слова автора.
    """
    own_counts = Counter(w for t in own for w in words(t) if len(w) > 1 and w not in STOPWORDS)
    other_counts = Counter(w for t in others for w in words(t) if len(w) > 1 and w not in STOPWORDS)
    candidates = [w for w, c in own_counts.items() if c >= min_count]
    if not other_counts:
        candidates.sort(key=lambda w: (-own_counts[w], w))
        return candidates[:limit]

    alpha = 0.5
    vocab = len(own_counts.keys() | other_counts.keys())
    own_total = sum(own_counts.values()) + alpha * vocab
    other_total = sum(other_counts.values()) + alpha * vocab

    def score(w: str) -> float:
        a, b = own_counts[w] + alpha, other_counts[w] + alpha
        delta = math.log(a / own_total) - math.log(b / other_total)
        return delta / math.sqrt(1 / a + 1 / b)

    scored = sorted(((score(w), w) for w in candidates), key=lambda x: (-x[0], x[1]))
    return [w for s, w in scored if s > 0][:limit]


def style_vector(texts: Iterable[str]) -> np.ndarray:
    """Числовой вектор почерка: доли всех черт и логарифм средней длины."""
    texts = list(texts)
    rates = trait_rates(texts)
    values = [rates[s.key][0] if rates[s.key][1] else s.prior for s in TRAIT_SPECS]
    avg_len = sum(len(t) for t in texts) / len(texts) if texts else 0.0
    values.append(math.log1p(avg_len))
    return np.array(values, dtype=float)


def char_ngram_vectorizer() -> TfidfVectorizer:
    """TF-IDF по символьным 2–4-граммам; регистр сохраняем — это тоже почерк."""
    return TfidfVectorizer(
        analyzer="char_wb", ngram_range=(2, 4), lowercase=False, sublinear_tf=True
    )
