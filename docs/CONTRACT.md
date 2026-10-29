# Contract between zones

The source of truth for the API and data formats. It changes only through `/contract` in a separate PR approved by both teammates.

Product: «Это точно Клавдий?» — see `docs/IDEA.md`.

Example values are in Russian because the product analyzes Russian-language chats; the frontend mocks use them as is.

## General
- Base URL (local): `http://localhost:8000`, all paths start with `/api`
- Format: JSON, UTF-8, dates in ISO 8601 (UTC)
- Errors: HTTP status + body `{"error": {"code": "string", "message": "string"}}`
  - `400 invalid_export` — the file does not look like a Telegram export
  - `404 not_found` — no such chat or author (including after a backend restart — the frontend offers to upload the file again)
  - `413 file_too_large` — the file is larger than 50 MB
  - `422 validation` — invalid request body (the backend converts FastAPI errors to this format)
  - `500 internal` — unexpected backend error; `message` is a generic text without details, the frontend suggests retrying later
  - `http_error` — other HTTP errors, status as is (e.g. `405` for a wrong method); the frontend does not need to handle them separately
- Authorization: none
- Storage: in backend memory, until restart
- Fields filled by the LLM (`explanation`, `challenge_question`) can be `null` if there is no key or the LLM did not respond. In that case the frontend simply does not show the block.
- `score` values are numbers from 0 to 1: how likely it is that the texts were written by the same person.
- Text fragments `span` are `[start, end)` in **Unicode code points** (like string indices in Python). On the frontend, slice via `Array.from(text)`, not `text.slice`, otherwise emoji break the indices.

## Entities

### Author
`message_count` — all text messages of the author, including forwarded ones and ones sent via inline bots.
`enough_data` — whether there are enough messages for a reliable analysis (the threshold is set by the backend, currently ≥ 30 **own** messages — excluding forwarded ones, ones via bots, and ones consisting only of a link). So an author with a large `message_count` can still lack `enough_data`. Authors without `enough_data` are shown but do not take part in the twins search.
```json
{
  "id": "user2002",
  "name": "Саша",
  "message_count": 912,
  "enough_data": true
}
```

### Chat
`kind`: `personal` (one-on-one chat) or `group`.
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

### Trait (handwriting trait)
```json
{
  "key": "lowercase_start",
  "label": "Пишет с маленькой буквы",
  "value": 0.94,
  "description": "94% сообщений начинаются со строчной буквы"
}
```

### StyleProfile (handwriting passport)
`active_hours` — 24 numbers, the share of the author's messages in each hour of the day (UTC, sum ≈ 1 — values are rounded, deviation up to 0.002); all messages count, including forwarded ones. `traits`, `top_words`, `emoji` and `avg_length` are computed only from the author's own text.
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

### Signal (evidence)
`span` is present only for signals tied to a place in the checked text, otherwise `null`. `weight` — the signal's contribution to the result (0–1), for sorting and highlight thickness. `message` — when checking a series, the index of the message (from 0) that `span` refers to; when checking a single text and for signals about the series as a whole — `null`. The field is optional: it may be absent in responses without a series.
```json
{
  "feature": "greeting",
  "label": "Приветствие",
  "expected": "«прив», «йо» или без приветствия",
  "observed": "«Привет!»",
  "span": [0, 7],
  "message": null,
  "weight": 0.3
}
```

### CheckResult
`verdict`: `match` | `uncertain` | `mismatch` | `not_enough_data`.
`reason` — why `not_enough_data`: `few_messages` (the author has few own messages) or `no_style_text` (the checked text has no handwriting — only links, @mentions, commands or code); for other verdicts — `null`. The field is optional: treat its absence as `few_messages`.
```json
{
  "author_id": "user2002",
  "score": 0.12,
  "verdict": "mismatch",
  "reason": null,
  "signals": [
    { "feature": "greeting", "label": "Приветствие", "expected": "«прив», «йо» или без приветствия", "observed": "«Привет!»", "span": [0, 7], "weight": 0.3 },
    { "feature": "capitalization", "label": "Заглавная буква в начале", "expected": "почти всегда строчная (94%)", "observed": "заглавная", "span": [0, 1], "weight": 0.2 },
    { "feature": "rare_words", "label": "Нетипичные слова", "expected": "не встречается в переписке", "observed": "«срочно»", "span": [8, 14], "weight": 0.25 },
    { "feature": "active_hours", "label": "Время отправки", "expected": "обычно 08:00–23:00 UTC", "observed": "03:12 UTC", "span": null, "weight": 0.1 }
  ],
  "explanation": "Саша почти никогда не здоровается полным «Привет», не начинает с заглавной и ни разу за полтора года не писал «срочно». Сообщение отправлено в час, когда он обычно не пишет.",
  "challenge_question": "Спроси, в какой бар вы ходили после концерта в мае (в «Ровесник») — это обсуждалось в переписке 14.05."
}
```
`challenge_question` — only the question itself: it starts with «Спроси» ("Ask"), the correct answer from the chat is in parentheses (only the user who verifies the other person sees it), and it ends with when this was discussed. `null` if the verdict is `match`, the LLM is unavailable, or no good question can be built from the chat.

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

### Comparison (two chats)
Authors from two different chats: which of them are most likely the same person. `pairs` — pairs in the `TwinPair` format, where `a` is an author from chat `a` and `b` is from chat `b`. `shared` — accounts present in both chats (usually whoever made both exports): they are the same account anyway and do not go into `pairs`.
```json
{
  "a": {
    "id": "c_7f3a9b", "title": "Саша", "kind": "personal", "message_count": 1840,
    "period": { "from": "2025-03-01T09:12:00Z", "to": "2026-10-24T22:40:00Z" },
    "authors": [
      { "id": "user1001", "name": "Иван", "message_count": 928, "enough_data": true },
      { "id": "user2002", "name": "Саша", "message_count": 912, "enough_data": true }
    ]
  },
  "b": {
    "id": "c_51d0e2", "title": "Alex", "kind": "personal", "message_count": 420,
    "period": { "from": "2026-09-01T10:00:00Z", "to": "2026-10-24T21:05:00Z" },
    "authors": [
      { "id": "user1001", "name": "Иван", "message_count": 230, "enough_data": true },
      { "id": "user7007", "name": "Alex", "message_count": 190, "enough_data": true }
    ]
  },
  "shared": ["user1001"],
  "pairs": [
    {
      "a": "user2002",
      "b": "user7007",
      "score": 0.81,
      "verdict": "likely_same",
      "signals": [
        { "feature": "style", "label": "Общий почерк", "expected": null, "observed": "похожи почти как две половины переписки одного человека", "span": null, "weight": 0.4 },
        { "feature": "punctuation", "label": "Одинаковая пунктуация", "expected": null, "observed": "без заглавных и точки в конце, «)» вместо эмодзи у обоих", "span": null, "weight": 0.25 },
        { "feature": "shared_words", "label": "Общие словечки", "expected": null, "observed": "«кста», «ща», «ваще» — характерны для обоих", "span": null, "weight": 0.2 },
        { "feature": "active_hours", "label": "Одинаковое время активности", "expected": null, "observed": "оба обычно пишут 09:00–01:00 UTC", "span": null, "weight": 0.15 }
      ]
    }
  ]
}
```

## Endpoints

### `GET /api/health`
Response `200`: `{ "status": "ok", "llm": true }` — `llm` shows whether an LLM key is set. Whether the LLM actually works is not checked: even with `true`, LLM fields in responses can be `null`.

### `POST /api/chats`
Upload an export. `multipart/form-data`, field `file` — `result.json` from Telegram Desktop ("Export chat history", format "Machine-readable JSON"). Only text messages count; service and empty messages are skipped. Forwarded messages (`forwarded_from`) and ones sent via inline bots (`via_bot`) count towards `message_count` and activity time, but not towards handwriting analysis: the author did not write that text. Links, @mentions, commands and code are excluded from handwriting analysis too.

Response `201`: a `Chat` object. Errors: `400 invalid_export`, `413 file_too_large`.

### `GET /api/chats/{chat_id}`
Response `200`: a `Chat` object. Error: `404 not_found`.

### `GET /api/chats/{chat_id}/authors/{author_id}/profile`
Response `200`: a `StyleProfile` object. Error: `404 not_found`.

### `POST /api/chats/{chat_id}/authors/{author_id}/check`
Check whether a message looks like the author's. `sent_at` is optional; without it, time signals are not computed. `text` — at most 4096 characters (code points).

Request:
```json
{ "text": "Привет! срочно займи 5000 на карту, потом объясню", "sent_at": "2026-10-26T03:12:00Z" }
```
Instead of `text`, you can pass a series — `messages`, from 2 to 20 consecutive messages from the "author". A series gives a more accurate score: short replies on their own say almost nothing. `span` in signals is within message number `message`. Each `messages[].text` is also at most 4096 characters.
```json
{
  "messages": [
    { "text": "Привет!", "sent_at": "2026-10-26T03:12:00Z" },
    { "text": "срочно займи 5000 на карту", "sent_at": "2026-10-26T03:12:20Z" },
    { "text": "потом объясню", "sent_at": "2026-10-26T03:12:31Z" }
  ]
}
```

Response `200`: a `CheckResult` object. If the author has few messages — `200` with `verdict: "not_enough_data"`, `reason: "few_messages"`, `score: null`, empty `signals`. If the text (all messages of the series) has no handwriting — only links, @mentions, commands or code — the same, but with `reason: "no_style_text"`; in both cases the LLM is not called. Errors: `404 not_found`, `422 validation` (empty text or longer than 4096 characters; neither `text` nor `messages`, or both; fewer than 2 or more than 20 messages in the series, or one of them is empty).

### `GET /api/chats/{chat_id}/twins`
Twins search among chat authors. Pairs are all combinations of authors with `enough_data`, sorted by `score` descending. If there are fewer than two such authors — empty `pairs`.

`validation` — self-check: each author's messages are split in half, `self_match_rate` is the share of authors whose halves turned out to be the most similar pair. `null` if there are fewer than three authors.

Response `200`:
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
(`signals` are shortened in the example; see `TwinPair` for the full form.)

Error: `404 not_found`.

### `GET /api/chats/{chat_id}/twins/{a_id}/{b_id}`
Detailed pair comparison. `examples` — pairs of similar messages from A and B (up to 5), each labeled with the signal it illustrates. `timeline`: `overlap_minutes` — how many minutes both were writing at the same time, `median_switch_seconds` — the median pause when one's message is immediately followed by the other's (`null` if there are no such cases).

Response `200`:
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
Error: `404 not_found`.

### `GET /api/compare?a={chat_id}&b={chat_id}`
Compare the authors of two uploaded chats: "Are Sasha from one chat and Alex from another the same person?". Pairs are all combinations of an author with `enough_data` from chat `a` and an author with `enough_data` from chat `b`, excluding accounts in `shared`, sorted by `score` descending. Two personal chats usually give exactly one pair. If there is no one to compare — empty `pairs`.

Response `200`: a `Comparison` object. Errors: `404 not_found` (one of the chats does not exist), `422 validation` (`a` or `b` is missing, or they are the same chat).

## Mocks
Until the backend is ready, the frontend uses the example responses from this file as mocks.

## Changelog
| Date | What changed | PR |
|---|---|---|
| 2026-10-25 | First version: chats, handwriting passport, message check, twins | — |
| 2026-10-25 | CheckResult example: span of «срочно» fixed from [9, 15] to [8, 14]; format unchanged | — |
| 2026-10-25 | Clarification: forwarded messages and ones via inline bots count towards `message_count` and `active_hours`, but not handwriting; `enough_data` is based on own messages; format unchanged | — |
| 2026-10-25 | New: comparing authors from two different chats — `Comparison`, `GET /api/compare` | — |
| 2026-10-25 | New: checking a series of messages — `messages` in the `/check` request, optional `message` in `Signal`; format for a single `text` unchanged | — |
| 2026-10-25 | Clarification: 4096-character limit in `/check`, error codes `500 internal` and `http_error`, `health.llm` only reflects whether a key is set, `active_hours` sum ≈ 1; success response format unchanged | — |
| 2026-10-25 | New: optional `reason` in `CheckResult` — `few_messages` or `no_style_text`; text without handwriting (only links, mentions, commands) gives `not_enough_data` | — |
| 2026-10-25 | Product renamed: «Это точно Клавдий?»; API and formats unchanged | — |
| 2026-10-29 | Document translated to English; API, formats and examples unchanged | — |
