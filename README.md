# github-repo-cleaner

A pi skill that finds, reviews, and deletes GitHub repositories that match a set of user-defined rules — by keyword in the repo name or description, or by primary language.

> ⚠️ This is a destructive tool. It always shows the deletion list and asks for confirmation before deleting anything. Use with care.

## Features

- 🔍 Lists every repository on the user's GitHub account.
- 🎯 Filters by:
  - **Keyword** in repo name or description (case-insensitive substring match). Example: `upyun`, `rails`.
  - **Primary language** (case-sensitive, exactly as GitHub reports it). Example: `PHP`, `Ruby`, `Rust`.
- 📋 Shows the matched set with name, language, description, and creation date.
- ✋ **Requires explicit per-batch confirmation** before deleting anything.
- 🗑️ Deletes through the user's actual browser session via `ego-browser` — no GitHub API token needed.
- ✅ Verifies each deletion afterwards by re-checking the repo URL.
- 🛑 Stops on errors and asks for guidance rather than silently retrying.

## Quick start

1. Install the `pi` coding agent from <https://github.com/baryonlabs/pi-agent>.
2. Install the [`ego-browser`](https://github.com/beepony/ego-browser) skill (or use the bundled `ego-browser` from your local skill directory).
3. Clone this repo into your skills folder:

```bash
mkdir -p ~/.pi/skills
git clone https://github.com/beepony/github-repo-cleaner.git ~/.pi/skills/github-repo-cleaner
```

4. Open `ego-browser` and log into GitHub.

5. Invoke the skill from pi:

```
帮我删除我 GitHub 仓库里面所有包含 "upyun" 的仓库
```

The agent will:

1. Confirm your GitHub username from the active session.
2. Load every repo on your account.
3. Filter by your criteria.
4. Show you the matched set.
5. Wait for your "确认删除" (or equivalent) confirmation.
6. Delete each repo and verify the result.

## Filter syntax

Filters are passed in plain English. The agent interprets them as combinations of:

| Filter kind | Example       | Effect                                                                |
|-------------|---------------|-----------------------------------------------------------------------|
| Keyword     | `upyun`       | Match repos whose name or description contains `upyun`.               |
| Keyword     | `rails`       | Match repos whose name or description contains `rails`.               |
| Language    | `PHP`         | Match repos whose primary language is `PHP`.                          |
| Language    | `Ruby`        | Match repos whose primary language is `Ruby`.                         |

Multiple keywords are OR-ed together; multiple languages are OR-ed together; different kinds are AND-ed.

Examples:

- `delete all repos containing upyun` → keyword `upyun`.
- `删除我所有 PHP 仓库` → language `PHP`.
- `delete repos containing upyun or ruby` → keywords `upyun`, `ruby`.
- `删除所有 PHP 和 Ruby 仓库` → languages `PHP`, `Ruby`.

You can also give an explicit keep-list (the agent will subtract it from the matched set):

```
保留一下仓库：repo-a、repo-b、repo-c，除了这些之外的，全部删除
```

## Repository layout

```
github-repo-cleaner/
├── README.md              # this file
├── SKILL.md               # the pi skill entrypoint (frontmatter + workflow)
├── LICENSE                # MIT
├── scripts/
│   └── delete-repos.js    # helper functions used inside the skill heredocs
└── docs/
    ├── architecture.md    # how the skill works under the hood
    └── safety.md          # safety guarantees and limitations
```

## How it works

For a deeper explanation of the workflow, see:

- [`SKILL.md`](./SKILL.md) — the skill entrypoint that pi loads.
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

1. Keep the `SKILL.md` frontmatter in sync.
2. Add a heredoc-friendly helper to `scripts/` rather than reimplementing deletion in inline scripts.
3. Update `docs/architecture.md` if you change the workflow.

## License

MIT — see [`LICENSE`](./LICENSE).
