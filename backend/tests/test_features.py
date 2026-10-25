import pytest

from app import features

SASHA = [
    "кста ща гляну)",
    "норм, го вечером))",
    "ваще не помню где это)",
    "ща скину 🔥",
    "кста а ты где",
    "го завтра)",
    "ну норм вроде",
    "ща буду)",
] * 4

IVAN = [
    "Привет. Как дела?",
    "Хорошо, вечером созвонимся.",
    "Да, я посмотрю завтра утром, если успею.",
    "Отлично.",
    "Нет, давай в субботу.",
] * 4


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("норм)", [")"]),
        ("норм)))", [")"]),
        ("ну ок((", ["("]),
        ("см. (выше)", []),
        ("(см. выше) ну и ладно)", [")"]),
        (") привет )", [")", ")"]),
    ],
)
def test_bracket_smiles(text, expected):
    assert features.bracket_smiles(text) == expected


def test_emojis():
    assert features.emojis("ща 🔥🔥 ок ❤️") == ["🔥", "🔥", "❤"]


def test_traits_of_lowercase_author():
    traits = {t.key: t for t in features.author_traits(SASHA)}
    assert traits["lowercase_start"].value == 1.0
    assert traits["no_final_dot"].value == 1.0
    assert traits["no_final_dot"].description == "Точка в конце — в 0% сообщений"
    assert traits["brackets_smile"].value == pytest.approx(5 / 8)
    assert "capital_start" not in traits


def test_traits_of_formal_author():
    traits = {t.key: t for t in features.author_traits(IVAN)}
    assert traits["capital_start"].value == 1.0
    assert traits["capital_start"].description == "100% сообщений начинаются с заглавной буквы"
    assert traits["final_dot"].value == pytest.approx(4 / 5)


def test_small_shares_are_not_rounded_to_zero():
    texts = ["ок"] * 199 + ["ок 🔥"]
    trait = next(t for t in features.author_traits(texts) if t.key == "no_emoji")
    assert trait.description == "Эмодзи только в 0,5% сообщений"
    assert features.percent(0.996) == "99"


def test_clean_text():
    text = "глянь https://youtube.com/shorts/abc и t.me/chan @savxbot /start ок"
    assert features.clean_text(text) == "глянь и ок"


def test_laughter_is_one_word():
    texts = ["хахаха", "ахахах ну", "хахахаха", "хаха"]
    assert features.characteristic_words(texts, []) == ["хаха"]


def test_traits_rank_differences_from_others_first():
    # оба пишут с маленькой без точки, но только «Саша» ставит скобки
    other = [t.replace(")", "") for t in SASHA]
    keys = [t.key for t in features.author_traits(SASHA, other)]
    assert keys[0] == "brackets_smile"


def test_traits_sorted_by_distinctiveness():
    traits = features.author_traits(SASHA)
    scores = [t.distinctiveness for t in traits]
    assert scores == sorted(scores, reverse=True)


def test_traits_need_enough_messages():
    assert features.author_traits(["привет)"] * 3) == []


def test_characteristic_words():
    top = features.characteristic_words(SASHA, IVAN)
    assert set(top[:3]) == {"ща", "кста", "го"}
    assert "вечером" not in top


def test_characteristic_words_without_others():
    assert features.characteristic_words(SASHA, [])[0] == "ща"


def test_style_vector_separates_authors():
    sasha_a, sasha_b = features.style_vector(SASHA[:16]), features.style_vector(SASHA[16:])
    ivan = features.style_vector(IVAN)
    assert len(sasha_a) == len(features.TRAIT_SPECS) + 1
    assert ((sasha_a - sasha_b) ** 2).sum() < ((sasha_a - ivan) ** 2).sum()


def test_char_ngram_vectorizer_keeps_case():
    vec = features.char_ngram_vectorizer().fit(["Привет", "привет"])
    assert "Пр" in vec.vocabulary_ and "пр" in vec.vocabulary_
