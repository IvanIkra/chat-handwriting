---
description: Взять issue в работу — назначить себя, создать ветку, составить план
argument-hint: <номер issue>
---

Задача: issue #$ARGUMENTS.

1. `gh issue view $ARGUMENTS` — прочитай описание и метки. Проверь, что метка зоны совпадает с моей зоной из `CLAUDE.local.md`; если нет или стоит `shared` — остановись и скажи мне.
2. Назначь меня: `gh issue edit $ARGUMENTS --add-assignee @me`.
3. `git fetch origin`, затем создай ветку от свежего main: `git switch -c $ARGUMENTS-<коротко-латиницей> origin/main`.
4. Прочитай `docs/CONTRACT.md`, если задача касается API или данных.
5. Выдай короткий план (файлы, шаги). Если задача больше пары файлов — жди моего подтверждения, прежде чем писать код.
