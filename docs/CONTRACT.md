# Контракт между зонами

Источник истины для API и форматов данных. Меняется только через `/contract` отдельным PR, который подтверждают оба.

Продукт: «Это точно Саша?» — см. `docs/IDEA.md`.

## Общее
- Базовый URL (локально): `http://localhost:8000`, все пути начинаются с `/api`
- Формат: JSON, UTF-8, даты в ISO 8601 (UTC)
- Ошибки: HTTP-статус + тело `{"error": {"code": "string", "message": "string"}}`
  - `400 invalid_export` — файл не похож на экспорт Telegram
  - `404 not_found` — нет такого чата или автора (в т.ч. после перезапуска бэкенда — фронт предлагает загрузить файл заново)
  - `413 file_too_large` — файл больше 50 МБ
  - `422 validation` — неверное тело запроса (бэкенд приводит ошибки FastAPI к этому формату)
- Авторизация: нет
- Хранение: в памяти бэкенда, до перезапуска
- Поля, которые заполняет LLM (`explanation`, `challenge_question`), могут быть `null`, если ключа нет или LLM не ответила. Фронт в этом случае просто не показывает блок.
- Оценки `score` — число от 0 до 1: насколько вероятно, что тексты написал один и тот же человек.
- Фрагменты текста `span` — `[start, end)` в **кодовых точках Unicode** (как индексы строки в Python). На фронте резать через `Array.from(text)`, а не `text.slice`, иначе эмодзи собьют индексы.

## Сущности

### Author
`enough_data` — хватает ли сообщений для надёжного анализа (порог задаёт бэкенд, сейчас ≥ 30 сообщений). Авторы без `enough_data` показываются, но не участвуют в поиске двойников.
```json
{
  "id": "user2002",
  "name": "Саша",
  "message_count": 912,
  "enough_data": true
}
```

### Chat
`kind`: `personal` (личная переписка) или `group`.
```json
{
  "id": "c_7f3a9b",
  "title": "Саша",
  "kind": "personal",
  "message_count": 1840,
  "period": { "from": "2025-03-01T09:12:00Z", "to": "2026-10-24T22:40:00Z" },
  "authors": [
    { "id": "user1001", "name": "Иван", "message_count": 928, "enough_data": true },
    { "id": "user2002", "name": "Саша", "message_count": 912, "enough_data": true }
  ]
}
```

### Trait (черта почерка)
```json
{
  "key": "lowercase_start",
  "label": "Пишет с маленькой буквы",
  "value": 0.94,
  "description": "94% сообщений начинаются со строчной буквы"
}
```

### StyleProfile (паспорт почерка)
`active_hours` — 24 числа, доля сообщений автора в каждый час суток (по UTC, сумма = 1).
```json
{
  "author_id": "user2002",
  "name": "Саша",
  "message_count": 912,
  "enough_data": true,
  "avg_length": 38.2,
  "traits": [
    { "key": "lowercase_start", "label": "Пишет с маленькой буквы", "value": 0.94, "description": "94% сообщений начинаются со строчной буквы" },
    { "key": "brackets_smile", "label": "Скобки вместо эмодзи", "value": 0.41, "description": "«)» или «))» в 41% сообщений" },
    { "key": "no_final_dot", "label": "Не ставит точку в конце", "value": 0.99, "description": "Точка в конце — в 1% сообщений" }
  ],
  "top_words": ["кста", "ща", "норм", "ваще", "го"],
  "emoji": [ { "char": ")", "count": 374 }, { "char": "🔥", "count": 52 } ],
  "active_hours": [0.04, 0.03, 0.01, 0, 0, 0, 0, 0.01, 0.02, 0.04, 0.06, 0.07, 0.07, 0.06, 0.06, 0.06, 0.07, 0.07, 0.08, 0.08, 0.07, 0.04, 0.03, 0.03]
}
```

### Signal (улика)
`span` есть только у улик, привязанных к месту в проверяемом тексте, иначе `null`. `weight` — вклад улики в итог (0–1), для сортировки и толщины подсветки.
```json
{
  "feature": "greeting",
  "label": "Приветствие",
  "expected": "«прив», «йо» или без приветствия",
  "observed": "«Привет!»",
  "span": [0, 7],
  "weight": 0.3
}
```

### CheckResult
`verdict`: `match` | `uncertain` | `mismatch` | `not_enough_data`.
```json
{
  "author_id": "user2002",
  "score": 0.12,
  "verdict": "mismatch",
  "signals": [
    { "feature": "greeting", "label": "Приветствие", "expected": "«прив», «йо» или без приветствия", "observed": "«Привет!»", "span": [0, 7], "weight": 0.3 },
    { "feature": "capitalization", "label": "Заглавная буква в начале", "expected": "почти всегда строчная (94%)", "observed": "заглавная", "span": [0, 1], "weight": 0.2 },
    { "feature": "rare_words", "label": "Нетипичные слова", "expected": "не встречается в переписке", "observed": "«срочно»", "span": [8, 14], "weight": 0.25 },
    { "feature": "active_hours", "label": "Время отправки", "expected": "обычно 08:00–23:00 UTC", "observed": "03:12 UTC", "span": null, "weight": 0.1 }
  ],
  "explanation": "Саша почти никогда не здоровается полным «Привет», не начинает с заглавной и ни разу за полтора года не писал «срочно». Сообщение отправлено в час, когда он обычно не пишет.",
  "challenge_question": "Спроси, в какой бар вы ходили после концерта в мае — это обсуждалось в переписке 14.05."
}
```

### TwinPair
`verdict`: `likely_same` | `possible` | `different`.
```json
{
  "a": "user3003",
  "b": "user3004",
  "score": 0.84,
  "verdict": "likely_same",
  "signals": [
    { "feature": "rare_words", "label": "Общие редкие слова", "expected": null, "observed": "«щас», «ваще» — больше ни у кого в чате", "span": null, "weight": 0.35 },
    { "feature": "punctuation", "label": "Одинаковая пунктуация", "expected": null, "observed": "«!!» и пробел перед «?» у обоих", "span": null, "weight": 0.25 },
    { "feature": "no_overlap", "label": "Не пишут одновременно", "expected": null, "observed": "0 случаев, когда оба писали в одну минуту", "span": null, "weight": 0.2 },
    { "feature": "switch_time", "label": "Быстрое переключение", "expected": null, "observed": "медиана 31 с между сообщениями A и B", "span": null, "weight": 0.2 }
  ]
}
```

## Эндпоинты

### `GET /api/health`
Ответ `200`: `{ "status": "ok", "llm": true }` — `llm` показывает, доступна ли LLM.

### `POST /api/chats`
Загрузка экспорта. `multipart/form-data`, поле `file` — `result.json` из Telegram Desktop («Экспорт истории чата», формат «Машиночитаемый JSON»). Учитываются только текстовые сообщения, служебные и пустые пропускаются.

Ответ `201`: объект `Chat`. Ошибки: `400 invalid_export`, `413 file_too_large`.

### `GET /api/chats/{chat_id}`
Ответ `200`: объект `Chat`. Ошибка: `404 not_found`.

### `GET /api/chats/{chat_id}/authors/{author_id}/profile`
Ответ `200`: объект `StyleProfile`. Ошибка: `404 not_found`.

### `POST /api/chats/{chat_id}/authors/{author_id}/check`
Проверить, похоже ли сообщение на автора. `sent_at` необязательно, без него улики про время не считаются.

Запрос:
```json
{ "text": "Привет! срочно займи 5000 на карту, потом объясню", "sent_at": "2026-10-26T03:12:00Z" }
```
Ответ `200`: объект `CheckResult`. Если у автора мало сообщений — `200` с `verdict: "not_enough_data"`, `score: null`, пустыми `signals`. Ошибки: `404 not_found`, `422 validation` (пустой текст).

### `GET /api/chats/{chat_id}/twins`
Поиск двойников среди авторов чата. Пары — все сочетания авторов с `enough_data`, по убыванию `score`. Если таких авторов меньше двух — пустой `pairs`.

`validation` — самопроверка: сообщения каждого автора делятся пополам, `self_match_rate` — доля авторов, у которых половины оказались самой похожей парой. `null`, если авторов меньше трёх.

Ответ `200`:
```json
{
  "chat_id": "c_19ab42",
  "authors": [
    { "id": "user3001", "name": "Аня", "message_count": 210, "enough_data": true },
    { "id": "user3003", "name": "Катя", "message_count": 143, "enough_data": true },
    { "id": "user3004", "name": "Дима_88", "message_count": 97, "enough_data": true },
    { "id": "user3005", "name": "Лёша", "message_count": 12, "enough_data": false }
  ],
  "pairs": [
    { "a": "user3003", "b": "user3004", "score": 0.84, "verdict": "likely_same", "signals": [] },
    { "a": "user3001", "b": "user3003", "score": 0.21, "verdict": "different", "signals": [] },
    { "a": "user3001", "b": "user3004", "score": 0.18, "verdict": "different", "signals": [] }
  ],
  "validation": { "self_match_rate": 0.9, "authors_tested": 10 }
}
```
(В примере `signals` сокращены, полный вид — в `TwinPair`.)

Ошибка: `404 not_found`.

### `GET /api/chats/{chat_id}/twins/{a_id}/{b_id}`
Подробное сравнение пары. `examples` — пары похожих сообщений A и B (до 5) с указанием, какую улику они иллюстрируют. `timeline`: `overlap_minutes` — сколько минут оба писали одновременно, `median_switch_seconds` — медианная пауза, когда за сообщением одного сразу идёт сообщение другого (`null`, если таких случаев нет).

Ответ `200`:
```json
{
  "pair": { "a": "user3003", "b": "user3004", "score": 0.84, "verdict": "likely_same", "signals": [] },
  "a": { "id": "user3003", "name": "Катя", "message_count": 143, "enough_data": true },
  "b": { "id": "user3004", "name": "Дима_88", "message_count": 97, "enough_data": true },
  "examples": [
    {
      "feature": "rare_words",
      "a": { "text": "щас гляну, ваще не помню где это", "sent_at": "2026-10-20T18:02:11Z" },
      "b": { "text": "ваще согласен!! щас скину", "sent_at": "2026-10-20T18:02:44Z" }
    }
  ],
  "timeline": { "overlap_minutes": 0, "median_switch_seconds": 31 },
  "explanation": "Оба аккаунта используют «щас» и «ваще», которых нет больше ни у кого в чате, одинаково ставят «!!». За три недели они ни разу не писали в одну и ту же минуту, а когда один замолкает, второй появляется через полминуты."
}
```
Ошибка: `404 not_found`.

## Моки
Пока бэкенд не готов, фронтенд использует примеры ответов из этого файла как моки.

## История изменений
| Дата | Что изменилось | PR |
|---|---|---|
| 2026-10-25 | Первая версия: чаты, паспорт почерка, проверка сообщения, двойники | — |
| 2026-10-25 | Пример CheckResult: span у «срочно» исправлен с [9, 15] на [8, 14]; формат не менялся | — |
