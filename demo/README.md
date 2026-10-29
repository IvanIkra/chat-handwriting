# Demo data

Synthetic chats for the «Это точно Клавдий?» demo (the script is in [`docs/IDEA.md`](../docs/IDEA.md)). All people and events are made up; there is no personal data. The message texts were written by LLM agents (Claude Haiku) following the characters' handwriting portraits; `build.py` assigns message times. The chats are in Russian, like the chats the product is built for.

A recording of the service working on these files: [`docs/media/demo.mp4`](../docs/media/demo.mp4).

Real exports still live only in `data/` and are never committed.

## Files

All `.json` files are Telegram Desktop (JSON) exports, uploaded via `POST /api/chats`.

| File | Contents | Demo step |
|---|---|---|
| `personal_main.json` | one-on-one chat Danila ↔ Sasha, March–October 2026, 652 messages | Sasha's handwriting passport, message checks |
| `checks.txt` | 8 real messages in Sasha's style and 8 fakes from the "hijacked" account | check: paste a line and check it against Sasha |
| `group_twins.json` | group chat «Студсовет: движ», 6 members, 786 messages; Dima and Misha are the same person | twins |
| `personal_alt.json` | one-on-one chat Danila ↔ Alex (Sasha's second account), 270 messages | comparing two chats together with `personal_main.json` |

## Characters

- **Sasha / Alex** — lowercase, no final period, brackets instead of emoji, slang «ща», «кста», «норм», «го», «прив»; never writes «Привет», «срочно», «пожалуйста».
- **Danila** — capitals, periods, full words.
- **Dima and Misha** — share «щас», «короч», «токо», «ваще», «чел», «!!», a space before «?»; never write in the same minute and take turns within ~30 s. The other members do not use these habits.

Facts for the challenge question: the «Синие огни» concert in May, the «Хмель и солод» bar after it, a lost earbud, a trip to Kazan, Bublik the cat.

## What the backend returns (without an LLM key)

- Sasha's passport: starts with a lowercase letter — 100%, no final period — 100%, brackets — 39%.
- Fakes from `checks.txt` — all `mismatch` (0.00–0.17).
- Real messages from `checks.txt`: 3 `match` (0.61–0.70) — «бублик опять на клаве уснул)», «ща гляну, кинь ошибку», «кста ты фикстуру для /compare уже поправил»; these are the ones to show in the demo. The other 5 are `uncertain` (0.43–0.47): Sasha almost never uses commas, and a single "commas" signal lowers the score. No real message gets `mismatch`.
- Twins: Dima–Misha `likely_same` 0.91 with all signals (handwriting, shared rare words, habits, 0 shared minutes, switching in 40 s vs 98 s for the others); the next pair scores 0.33. Self-check: the halves of one author found each other for 6 of 6 members.
- Comparing `personal_main` and `personal_alt`: Sasha–Alex `likely_same` 0.89.

## Rebuilding

`source/*.jsonl` are the agents' raw lines (`{"day", "from", "text"}`, no time). The script spreads the days over dates, places messages within each character's activity hours, and keeps the twins' timing. The result is deterministic:

```bash
python3 demo/build.py demo/source demo
```
