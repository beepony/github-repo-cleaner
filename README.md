# github-repo-cleaner

A skill that finds, reviews, and deletes your GitHub repositories — by keyword in name/description, or by primary language.

Works with **pi** and **Claude Code**. The underlying workflow runs in any agent that can execute shell.

**[English](README.md)** · [中文](README.zh-CN.md)

> ⚠️ Destructive. The skill always lists matched repos and waits for your explicit confirmation before deleting anything.

## What it does

- Lists every repo on your account.
- Filters by **keyword** (substring match against name/description) or **language** (exact match against GitHub's primary language).
- Shows matched repos with name, language, description, and creation date.
- Waits for your `确认删除` / `confirm delete` reply before doing anything.
- Deletes through your existing browser session — no GitHub token required.
- Verifies each deletion by re-checking the repo URL.

## Quick start

### 1. Install `ego-browser`

```bash
sh ~/.agents/skills/ego-browser/scripts/install.sh   # macOS only
command -v ego-browser                               # must print a path
```

Open `ego-browser` once and log into GitHub.

### 2. Install the skill

**pi**

```bash
git clone https://github.com/beepony/github-repo-cleaner.git \
            ~/.pi/skills/github-repo-cleaner
```

**Claude Code**

```bash
git clone https://github.com/beepony/github-repo-cleaner.git /tmp/grc
mkdir -p ~/.claude/skills
cp -R /tmp/grc/.claude/skills/github-repo-cleaner ~/.claude/skills/
rm -rf /tmp/grc
```

### 3. Ask

```
delete all repos containing legacy
```

```
保留一下仓库：repo-a、repo-b、repo-c，除了这些之外的，全部删除
```

The skill will show the matched set and ask for confirmation.

## Filters

| Kind     | Example value | Matches                                                          |
|----------|---------------|------------------------------------------------------------------|
| Keyword  | `legacy`      | Repos whose name or description contains `legacy`.               |
| Keyword  | `archive`     | Repos whose name or description contains `archive`.              |
| Language | `PHP`         | Repos whose primary language is `PHP`.                           |
| Language | `Ruby`        | Repos whose primary language is `Ruby`.                          |

- Multiple keywords OR together.
- Multiple languages OR together.
- Different kinds AND together.

### Examples

| Request                                       | Effective filter                        |
|-----------------------------------------------|------------------------------------------|
| `delete all repos containing legacy`          | keyword: `legacy`                        |
| `delete all repos containing legacy archive`  | keywords: `legacy`, `archive`            |
| `delete all PHP repos`                        | language: `PHP`                          |
| `delete all PHP and Ruby repos`               | languages: `PHP`, `Ruby`                 |
| `delete PHP repos containing legacy`          | keyword `legacy` AND language `PHP`      |

### Keep-list

```
Keep repo-a, repo-b, repo-c. Delete everything else.
```

The keep-list is subtracted from the matched set before confirmation.

## Repository layout

```
github-repo-cleaner/
├── README.md                                  # this file (English)
├── README.zh-CN.md                            # Chinese version
├── SKILL.md                                   # pi skill entrypoint
├── .claude/skills/github-repo-cleaner/SKILL.md  # Claude Code skill entrypoint
├── scripts/delete-repos.js                    # optional helper functions
├── docs/architecture.md
├── docs/safety.md
└── LICENSE
```

## Documentation

- [SKILL.md](./SKILL.md) — full pi skill definition with heredoc templates.
- [.claude/skills/github-repo-cleaner/SKILL.md](./.claude/skills/github-repo-cleaner/SKILL.md) — full Claude Code skill definition.
- [docs/architecture.md](./docs/architecture.md) — how each round of the heredoc works.
- [docs/safety.md](./docs/safety.md) — what the skill guarantees and what it does not.

## Limitations

- Only operates on user-owned repos. Org repos require admin and are out of scope.
- Requires an authenticated `ego-browser` session.
- Forks are treated as regular repos — deleting your fork deletes the fork.
- GitHub-side restrictions (branch protection, app permissions) can block individual deletes; the skill reports and continues.

## License

MIT
