"""Паспорт почерка автора (StyleProfile)."""

from collections import Counter

from app import features
from app.models import Author, EmojiCount, StyleProfile, Trait
from app.store import StoredChat

MIN_TRAITS = 5
MAX_TRAITS = 8
MIN_DISTINCTIVENESS = 0.5  # после MIN_TRAITS добавляем только заметно необычные черты
TOP_EMOJI = 10


def build_profile(stored: StoredChat, author: Author) -> StyleProfile:
    own = [m for m in stored.messages if m.author_id == author.id]
    # Почерк — только по своим текстам; часы активности — по всем сообщениям,
    # включая пересланные: переслать — тоже значит быть онлайн
    own_texts = [m.style_text for m in own if m.has_style]
    other_texts = [
        m.style_text for m in stored.messages if m.author_id != author.id and m.has_style
    ]

    traits = [
        Trait(key=t.key, label=t.label, value=round(t.value, 2), description=t.description)
        for i, t in enumerate(features.author_traits(own_texts, other_texts))
        if i < MIN_TRAITS or t.distinctiveness >= MIN_DISTINCTIVENESS
    ][:MAX_TRAITS]

    emoji = Counter()
    for text in own_texts:
        emoji.update(features.bracket_smiles(text))
        emoji.update(features.emojis(text))

    hours = Counter(m.sent_at.hour for m in own)
    total = len(own) or 1

    return StyleProfile(
        author_id=author.id,
        name=author.name,
        message_count=author.message_count,
        enough_data=author.enough_data,
        avg_length=round(sum(len(t) for t in own_texts) / (len(own_texts) or 1), 1),
        traits=traits,
        top_words=features.characteristic_words(own_texts, other_texts),
        emoji=[EmojiCount(char=c, count=n) for c, n in emoji.most_common(TOP_EMOJI)],
        active_hours=[round(hours[h] / total, 4) for h in range(24)],
    )
