"""Собирает JSONL от агентов в экспорт Telegram Desktop (result.json) с реалистичным временем.

python3 demo/build.py demo/source demo
"""

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

MSK = timezone(timedelta(hours=3))  # `date` в экспорте — локальное время машины

PEOPLE = {
    "Данила": ("user1001", range(8, 24)),
    "Саша": ("user2002", [*range(10, 24), 0, 1]),
    "Alex": ("user7007", [*range(10, 24), 0, 1]),
    "Аня": ("user3001", range(9, 23)),
    "Катя": ("user3002", range(11, 24)),
    "Дима": ("user3003", [*range(11, 24), 0]),
    "Миша": ("user3004", [*range(11, 24), 0]),
    "Олег": ("user3005", range(10, 23)),
    "Лена": ("user3006", range(9, 22)),
}
TWINS = {"Дима", "Миша"}

CHATS = {
    "personal_main.json": {
        "name": "Саша",
        "type": "personal_chat",
        "id": 2002,
        "parts": [
            ("personal_1*.jsonl", "2026-03-02", "2026-04-28"),
            ("personal_2*.jsonl", "2026-05-03", "2026-07-20"),
            ("personal_3*.jsonl", "2026-08-03", "2026-10-24"),
        ],
    },
    "personal_alt.json": {
        "name": "Alex",
        "type": "personal_chat",
        "id": 7007,
        "parts": [("alt_*.jsonl", "2026-09-05", "2026-10-24")],
    },
    "group_twins.json": {
        "name": "Студсовет: движ",
        "type": "private_group",
        "id": 4004,
        "parts": [
            ("group_1*.jsonl", "2026-09-01", "2026-09-29"),
            ("group_2*.jsonl", "2026-10-01", "2026-10-12"),
            ("group_3*.jsonl", "2026-10-13", "2026-10-24"),
        ],
    },
}


def load_part(gen: Path, pattern: str) -> list[dict]:
    rows = []
    for f in sorted(gen.glob(pattern)):
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                if row.get("from") in PEOPLE and str(row.get("text", "")).strip():
                    rows.append(row)
    return rows


def reply_gap(rng: random.Random, same_author: bool) -> float:
    if same_author:
        return rng.uniform(3, 25)
    return min(max(rng.lognormvariate(4.5, 0.7), 8), 900)  # медиана ≈ 90 с


def schedule(rows: list[dict], start: str, end: str, rng: random.Random, cursor: datetime):
    """Возвращает [(datetime MSK, row)]; дни части линейно растягиваются на [start, end]."""
    d0 = datetime.fromisoformat(start).replace(tzinfo=MSK)
    d1 = datetime.fromisoformat(end).replace(tzinfo=MSK)
    days = sorted({int(r["day"]) for r in rows})
    lo, hi = days[0], days[-1]
    out = []
    twin_minutes: dict[str, set[int]] = {n: set() for n in TWINS}
    for day in days:
        frac = (day - lo) / (hi - lo) if hi > lo else 0
        date = d0 + (d1 - d0) * frac
        msgs = [r for r in rows if int(r["day"]) == day]
        # 1–3 сессии за день
        n_sess = min(len(msgs), rng.choice([1, 1, 2, 2, 3]))
        cuts = sorted(rng.sample(range(1, len(msgs)), n_sess - 1)) if n_sess > 1 else []
        sessions = [msgs[a:b] for a, b in zip([0, *cuts], [*cuts, len(msgs)])]
        hours = sorted(rng.sample(list(PEOPLE[sessions[0][0]["from"]][1]), len(sessions)))
        hours = [h + 24 if h < 6 else h for h in hours]  # 00–01 — это ночь после дня
        hours.sort()
        for sess, hour in zip(sessions, hours):
            t = date.replace(hour=0, minute=0, second=0) + timedelta(
                hours=hour, minutes=rng.randint(0, 50), seconds=rng.randint(0, 59)
            )
            t = max(t, cursor + timedelta(minutes=20))
            prev = None
            for r in sess:
                who = r["from"]
                if prev is not None:
                    if who in TWINS and prev in TWINS and who != prev:
                        # один человек переключает аккаунт: ~30 с, но уже в следующей минуте
                        t += timedelta(seconds=rng.uniform(12, 30))
                    else:
                        t += timedelta(seconds=reply_gap(rng, who == prev))
                if who in TWINS:
                    other = next(n for n in TWINS if n != who)
                    while int(t.timestamp()) // 60 in twin_minutes[other]:
                        t = datetime.fromtimestamp(
                            (int(t.timestamp()) // 60 + 1) * 60 + rng.randint(1, 5), MSK
                        )
                    twin_minutes[who].add(int(t.timestamp()) // 60)
                out.append((t, r))
                prev = who
                cursor = t
    return out, cursor


def to_message(i: int, t: datetime, row: dict) -> dict:
    text = str(row["text"]).strip()
    return {
        "id": i,
        "type": "message",
        "date": t.strftime("%Y-%m-%dT%H:%M:%S"),
        "date_unixtime": str(int(t.timestamp())),
        "from": row["from"],
        "from_id": PEOPLE[row["from"]][0],
        "text": text,
        "text_entities": [{"type": "plain", "text": text}],
    }


def build(gen: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for fname, spec in CHATS.items():
        rng = random.Random(fname)
        cursor = datetime(2000, 1, 1, tzinfo=MSK)
        timed = []
        for pattern, start, end in spec["parts"]:
            rows = load_part(gen, pattern)
            if not rows:
                print(f"! {fname}: нет данных {pattern}")
                continue
            part, cursor = schedule(rows, start, end, rng, cursor)
            timed += part
        messages = [to_message(i, t, r) for i, (t, r) in enumerate(timed, start=1)]
        if spec["type"] != "personal_chat" and messages:
            first = messages[0]
            messages.insert(0, {
                "id": 0, "type": "service", "date": first["date"],
                "date_unixtime": str(int(first["date_unixtime"]) - 3600),
                "actor": "Аня", "actor_id": "user3001", "action": "create_group",
                "title": spec["name"], "members": sorted({m["from"] for m in messages}),
                "text": "", "text_entities": [],
            })
        export = {k: spec[k] for k in ("name", "type", "id")} | {"messages": messages}
        (out / fname).write_text(json.dumps(export, ensure_ascii=False, indent=1), encoding="utf-8")
        by_author: dict[str, int] = {}
        for m in messages:
            if m["type"] == "message":
                by_author[m["from"]] = by_author.get(m["from"], 0) + 1
        print(f"{fname}: {sum(by_author.values())} сообщений {by_author}")


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
