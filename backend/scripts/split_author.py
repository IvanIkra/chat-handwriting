"""Сделать из одного автора экспорта Telegram два «аккаунта» — двойника для демо.

Сообщения автора режутся на сессии (пауза больше SESSION_GAP), каждая сессия случайно
достаётся первому или второму аккаунту. С `--switch` аккаунт иногда меняется и внутри
сессии (после паузы от минуты) — как будто человек пересел на второй аккаунт посреди
разговора.

    .venv/bin/python scripts/split_author.py ../data/chat/result.json user2002 \\
        --name "Дима_88" --out ../data/twin/result.json
"""

import argparse
import json
import random
from pathlib import Path

SESSION_GAP = 30 * 60  # секунд
SWITCH_GAP = 60  # быстрее на второй аккаунт не пересесть


def split_export(
    data: dict,
    author_id: str,
    twin_id: str | None = None,
    twin_name: str | None = None,
    switch: float = 0.0,
    seed: int = 0,
) -> dict:
    """Копия экспорта, где часть сообщений `author_id` написал аккаунт `twin_id`."""
    twin_id = twin_id or f"{author_id}0"
    rng = random.Random(seed)
    result = json.loads(json.dumps(data))
    own = [m for m in result["messages"] if m.get("from_id") == author_id]
    own.sort(key=lambda m: int(m.get("date_unixtime", 0)))

    to_twin = False
    prev_time = None
    for msg in own:
        time = int(msg.get("date_unixtime", 0))
        if prev_time is None or time - prev_time > SESSION_GAP:
            to_twin = rng.random() < 0.5
        elif time - prev_time >= SWITCH_GAP and rng.random() < switch:
            to_twin = not to_twin
        prev_time = time
        if to_twin:
            msg["from_id"] = twin_id
            msg["from"] = twin_name or f"{msg.get('from') or 'Автор'} (2)"
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("export", type=Path, help="result.json из Telegram Desktop")
    parser.add_argument("author_id", help="from_id автора, например user2002")
    parser.add_argument("--out", type=Path, required=True, help="куда записать новый экспорт")
    parser.add_argument("--twin-id", help="from_id второго аккаунта (по умолчанию <id>0)")
    parser.add_argument("--name", help="имя второго аккаунта")
    parser.add_argument("--switch", type=float, default=0.0, help="шанс сменить аккаунт в сессии")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    data = json.loads(args.export.read_text(encoding="utf-8"))
    result = split_export(data, args.author_id, args.twin_id, args.name, args.switch, args.seed)
    if "name" in result:
        result["name"] = f"{result['name']} (с двойником)"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    twin_id = args.twin_id or f"{args.author_id}0"  # как в split_export
    moved = sum(1 for m in result["messages"] if m.get("from_id") == twin_id)
    print(f"{args.out}: {moved} сообщений перешли второму аккаунту")


if __name__ == "__main__":
    main()
