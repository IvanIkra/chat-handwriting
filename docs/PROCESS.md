# How we work

Two people write code in parallel, each with Claude Code on their own machine. The goal of the process is to not get in each other's way and to always have a working `main`. The rules for Claude are in [`CLAUDE.md`](../CLAUDE.md).

## Zones

| Zone | Owner | Paths |
|---|---|---|
| A (backend) | [@IvanIkra](https://github.com/IvanIkra) | `backend/` |
| B (frontend) | [@s1ngul0r](https://github.com/s1ngul0r) | `frontend/` |
| Shared | both, only by agreement | `docs/CONTRACT.md`, dependency files, CI, root files |

- Do not edit the other zone's files. If a change is needed there, open an issue with that zone's label.
- Shared files change in a separate small PR that the other person must see and approve.
- The API between zones is described in [`docs/CONTRACT.md`](CONTRACT.md). The contract changes first (`/contract`), then the code on both sides.

## Getting started

```bash
git clone https://github.com/IvanIkra/chat-handwriting.git && cd chat-handwriting
```

```bash
cp CLAUDE.local.md.example CLAUDE.local.md
```

```bash
cp .env.example .env
```

In `CLAUDE.local.md`, write your name and zone; it is not committed. Share real keys for `.env` in person, never through git. Then install dependencies as in the [README](../README.md#quick-start).

## Daily loop

```
/status            — what's new, do I need to sync
/task 12           — take issue #12: assign, branch, plan
... write code with Claude ...
/sync              — rebase on main (every ~30–60 min)
/ship              — checks, push, PR with Closes #12
```

A change to the API between zones goes only through `/contract "<what is needed>"` and is merged after the other person approves.

## Git

- `main` always runs. No direct pushes to `main`, only PRs.
- One task = one issue = one branch `<issue-number>-<short-name>` = one PR.
- Branches are short-lived: 30 minutes to a couple of hours.
- After a rebase, push only with `git push --force-with-lease`, never `--force`.
- Squash merge. You may merge your own PR in your zone once checks are green. A PR touching shared files is merged after the other person's OK.
- Lockfile conflict: do not edit it by hand — take the version from `main` and reinstall dependencies.
- New dependencies go in a separate commit and are mentioned in the PR description.

## Issues

The board is GitHub Issues with labels `zone:A`, `zone:B`, `shared`. Assign yourself when you take a task (`/task`). It closes automatically via `Closes #N` in the PR.

## Two tasks at once on one machine

To run a second Claude Code on another task on the same machine, use a worktree instead of the same folder:

```bash
git worktree add ../chat-handwriting-14 -b 14-something origin/main
```

```bash
cd ../chat-handwriting-14 && cp ../chat-handwriting/CLAUDE.local.md ../chat-handwriting/.env . && claude
```

## Communication

- Voice or chat is open all the time. Message your teammate before merging a contract change or shared files.
- A short sync every 2–3 hours: what's merged, what's next, is it time to cut scope.
- Feature freeze 2 hours before the deadline: only bugs, demo and presentation.

## Process files

| File | Purpose |
|---|---|
| `CLAUDE.md` | shared rules for both Claudes: zones, git process, contract |
| `CLAUDE.local.md.example` | personal settings: who I am, my zone (the copy is not committed) |
| `.claude/settings.json` | permissions: git/gh without extra prompts; deny pushes to `main`, force-push, reading `.env` |
| `.claude/commands/` | `/task`, `/sync`, `/ship`, `/contract`, `/status` |
| `.github/pull_request_template.md` | PR template |
| `.github/workflows/ci.yml` | CI: backend and frontend tests, lint and build |
| `scripts/setup-github.sh` | one-time repository setup: labels, invite the teammate, squash-only, `main` protection |
