# github-repo-cleaner

A skill that finds, reviews, and deletes GitHub repositories that match a set of user-defined rules — by keyword in the repo name or description, or by primary language.

Works with the **pi coding agent** and **Claude Code** out of the box. The underlying workflow runs in any agent that can execute shell commands and reach the `ego-browser` runtime.

> ⚠️ This is a destructive tool. It always shows the deletion list and asks for confirmation before deleting anything. Use with care.

## Features

- 🔍 Lists every repository on the user's GitHub account.
- 🎯 Filters by:
  - **Keyword** in repo name or description (case-insensitive substring match). Example: `legacy`, `archive`.
  - **Primary language** (case-sensitive, exactly as GitHub reports it). Example: `PHP`, `Ruby`, `Rust`.
- 📋 Shows the matched set with name, language, description, and creation date.
- ✋ **Requires explicit per-batch confirmation** before deleting anything.
- 🗑️ Deletes through the user's actual browser session via `ego-browser` — no GitHub API token needed.
- ✅ Verifies each deletion afterwards by re-checking the repo URL.
- 🛑 Stops on errors and asks for guidance rather than silently retrying.

## Installation

Pick the agent you use. The same `ego-browser` runtime is required for all of them.

### Prerequisite — install `ego-browser`

```bash
sh ~/.agents/skills/ego-browser/scripts/install.sh    # macOS only
# after the script opens ego-browser, complete the in-app onboarding once
command -v ego-browser                                # must print a path
```

On non-macOS, download from <https://lite.ego.app/> and complete onboarding so the `ego-browser` command is on `PATH`.

Log into GitHub inside `ego-browser` before running any skill.

### Option A — pi coding agent

```bash
mkdir -p ~/.pi/skills
git clone https://github.com/beepony/github-repo-cleaner.git \
            ~/.pi/skills/github-repo-cleaner
```

Open pi. pi auto-loads the skill from `~/.pi/skills/` and triggers it whenever your request matches the description in `SKILL.md`. Just ask:

```
帮我删除我 GitHub 仓库里面所有包含 "legacy" 的仓库
```

### Option B — Claude Code

Copy the bundled Claude Code skill into your user-level skills folder:

```bash
mkdir -p ~/.claude/skills
cp -R .claude/skills/github-repo-cleaner ~/.claude/skills/
```

Restart Claude Code. It picks up the skill automatically and triggers it when your request matches the description. Or invoke directly via the Skill tool:

```
/github-repo-cleaner delete all PHP repos
```

### Option C — Codex CLI / generic shell

Codex has no skill loader, but the workflow is just shell. Copy the heredocs from `.claude/skills/github-repo-cleaner/SKILL.md` into a shell session and run them manually. Or:

```bash
git clone https://github.com/beepony/github-repo-cleaner.git
cd github-repo-cleaner
# read .claude/skills/github-repo-cleaner/SKILL.md for the workflow,
# then paste each heredoc into your terminal
```

The same approach works for Cursor (Terminal tool), Cline, Continue, Aider — any agent that can run `ego-browser nodejs <<'EOF' ... EOF` blocks.

### What runs the same regardless of agent

The JavaScript heredocs in `.claude/skills/github-repo-cleaner/SKILL.md` and the original `SKILL.md` are identical. The only thing that differs between pi and Claude Code is the frontmatter and how the skill is loaded.

## Filter syntax

Filters are passed in plain English. The agent interprets them as combinations of:

| Filter kind | Example       | Effect                                                                |
|-------------|---------------|-----------------------------------------------------------------------|
| Keyword     | `legacy`      | Match repos whose name or description contains `legacy`.              |
| Keyword     | `archive`     | Match repos whose name or description contains `archive`.             |
| Language    | `PHP`         | Match repos whose primary language is `PHP`.                          |
| Language    | `Ruby`        | Match repos whose primary language is `Ruby`.                         |

Multiple keywords are OR-ed together; multiple languages are OR-ed together; different kinds are AND-ed.

Examples:

- `delete all repos containing legacy` → keyword `legacy`.
- `删除我所有 PHP 仓库` → language `PHP`.
- `delete repos containing legacy or sample` → keywords `legacy`, `sample`.
- `删除所有 PHP 和 Ruby 仓库` → languages `PHP`, `Ruby`.

You can also give an explicit keep-list (the agent will subtract it from the matched set):

```
保留一下仓库：repo-a、repo-b、repo-c，除了这些之外的，全部删除
```

## Repository layout

```
github-repo-cleaner/
├── README.md                                # this file
├── SKILL.md                                 # pi skill entrypoint
├── .claude/
│   └── skills/
│       └── github-repo-cleaner/
│           └── SKILL.md                     # Claude Code skill entrypoint
├── LICENSE                                  # MIT
├── scripts/
│   └── delete-repos.js                      # helper functions used inside the skill heredocs
└── docs/
    ├── architecture.md                      # how the skill works under the hood
    └── safety.md                            # safety guarantees and limitations
```

The two `SKILL.md` files are kept manually in sync. Each one is self-contained so the host agent does not need to follow cross-file references.

## How it works

For a deeper explanation of the workflow, see:

- [`SKILL.md`](./SKILL.md) — the skill entrypoint that pi loads.
- [`.claude/skills/github-repo-cleaner/SKILL.md`](./.claude/skills/github-repo-cleaner/SKILL.md) — the same workflow adapted for Claude Code.
- [`docs/architecture.md`](./docs/architecture.md) — what each round of the heredoc does.
- [`docs/safety.md`](./docs/safety.md) — what the skill guarantees and what it does not.

## Limitations

- Works only on repositories owned by the logged-in user (organization repos require org admin and are out of scope).
- The user must already be authenticated in `ego-browser`. There is no token support.
- A repository that the user does not own (e.g. someone else's repo visible to them) is silently skipped — the delete form does not appear.
- Forks are not treated specially. Deleting your fork deletes the fork.
- GitHub's web UI rejects deletes in some edge cases (e.g. protected branches on private repos). The skill reports these and moves on.

## Contributing

Issues and PRs welcome at <https://github.com/beepony/github-repo-cleaner>.

When contributing, please:

1. Keep both `SKILL.md` files in sync. If you change the workflow, update both.
2. Add a heredoc-friendly helper to `scripts/` rather than reimplementing deletion in inline scripts.
3. Update `docs/architecture.md` if you change the workflow.

## License

MIT — see [`LICENSE`](./LICENSE).
