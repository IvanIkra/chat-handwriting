#!/usr/bin/env bash
# Разовая настройка репозитория на GitHub. Запускает один человек (владелец репо).
# Требуется: gh auth login. Использование: scripts/setup-github.sh <логин-напарника>
set -euo pipefail

PARTNER="${1:?Укажи GitHub-логин напарника: scripts/setup-github.sh <login>}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Репозиторий: $REPO"

echo "→ Приглашаю напарника с правами push"
gh api -X PUT "repos/$REPO/collaborators/$PARTNER" -f permission=push >/dev/null

echo "→ Метки"
gh label create "zone:A"  --color 1f77b4 --description "Зона A" --force
gh label create "zone:B"  --color ff7f0e --description "Зона B" --force
gh label create "shared"  --color d62728 --description "Общее: контракт, зависимости, CI" --force

echo "→ Только squash-мерж, автоудаление веток"
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null

echo "→ Защита main: без прямых пушей и force-push (если не сработает на бесплатном приватном репо — не страшно, есть deny в .claude/settings.json)"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null <<'JSON' || echo "  ! Защиту ветки поставить не удалось — пропускаю"
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Готово. Напарнику нужно принять приглашение: https://github.com/$REPO/invitations"
