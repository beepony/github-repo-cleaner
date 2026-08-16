# Architecture

This document explains how `github-repo-cleaner` works under the hood. For the
end-user workflow, see [`SKILL.md`](../SKILL.md). For safety guarantees and
limitations, see [`safety.md`](./safety.md).

## Overview

The skill is a sequence of `ego-browser nodejs` heredocs. Each heredoc:

1. Reuses a single `ego-browser` task space named `github-repo-cleaner`.
2. Runs JavaScript inside the user's authenticated browser session.
3. Talks to GitHub through the same DOM the user would — except it bypasses the
   multi-step confirmation dialog by submitting the delete form directly via
   `browserFetch`.

There is no separate backend service. The skill has no API tokens, no servers,
no dependencies beyond `ego-browser` itself.

## Why `browserFetch` instead of the click-driven dialog?

The GitHub web UI shows three confirmation dialogs before letting you delete a
repository. Driving them with `click()` calls is fragile:

- Buttons have unstable `ref=` selectors across pages.
- The dialog opens a modal whose scroll position interferes with the next click.
- The verification field listens for paste events, not value-assignment
  events — so `fillInput()` has to be used carefully.

Submitting the underlying `POST /settings/delete` form with the right
`authenticity_token` and `verify=owner/name` body is equivalent to clicking
through all three dialogs and produces the same result. The skill reads both
the action URL and the CSRF token from the page's `<form>` element, then sends
the request with `browserFetch` — which carries the user's session cookies.

This is the same code path a user would trigger manually; it is not an API
endpoint, and it does not bypass any GitHub-side check.

## The shape of each round

```text
┌─────────────────────────────────────────────────────────┐
│ ego-browser task space: "github-repo-cleaner"           │
│                                                         │
│ Round 1: identify user                                  │
│   - read meta[name=user-login]                          │
│   - confirm with human before proceeding                │
│                                                         │
│ Round 2: list repos                                     │
│   - iterate /<login>?tab=repositories pages             │
│   - extract a[href] links matching /<login>/<name>      │
│   - for each repo, visit and read <relative-time>       │
│                                                         │
│ Round 3: filter                                         │
│   - apply keyword + language rules in Node              │
│   - emit matched list                                   │
│                                                         │
│ Round 4 (HUMAN GATE): confirm                           │
│   - present matched list, ask user to confirm           │
│   - DO NOT proceed without explicit approval            │
│                                                         │
│ Round 5: delete                                         │
│   - for each confirmed repo:                            │
│     - GET /<login>/<repo>/settings                      │
│     - extract form.action and form[name=authenticity_…] │
│     - POST to form.action with the right verify value   │
│     - GET /<login>/<repo> and check title               │
│                                                         │
│ Round 6: report                                         │
│   - summarize per-repo results                          │
│   - surface any errors to the user                      │
│                                                         │
│ Round 7: cleanup                                        │
│   - completeTaskSpace(..., { keep: false })             │
└─────────────────────────────────────────────────────────┘
```

## Why a single task space?

The `ego-browser` runtime exits between heredocs and retains no state. Each
round starts with `useOrCreateTaskSpace('github-repo-cleaner')` so all tabs
are inherited. This lets the agent keep the "list repos" tab open while it
opens per-repo settings tabs in parallel, instead of re-navigating from
scratch each round.

## Why no API token?

A personal access token would let the skill skip the browser entirely, but:

- The user has to create the token, set the right scopes, and store it
  somewhere.
- The skill would then run with the user's full GitHub privileges in a
  background process, which is risky.
- The browser-based approach reuses whatever session the user already has
  open, which is harder to misuse accidentally.

Trade-off: the skill is slower than a token-based batch delete, but it is also
safer to hand to someone who hasn't read the source.

## File map

| File                           | Purpose                                                                 |
|--------------------------------|-------------------------------------------------------------------------|
| `SKILL.md`                     | The pi skill entrypoint. Loaded when the skill is triggered.            |
| `scripts/delete-repos.js`      | Helper functions used by the skill's heredocs.                          |
| `README.md`                    | Project readme for humans browsing the repo on GitHub.                  |
| `docs/architecture.md`         | This file.                                                              |
| `docs/safety.md`               | What the skill guarantees and what it does not.                         |
| `LICENSE`                      | MIT license.                                                            |

## Extending

To add a new filter kind (for example, "match by visibility"):

1. Add the parameter to `applyFilter` in `scripts/delete-repos.js`.
2. Update the heredoc in `SKILL.md` that calls `applyFilter` to pass the new
   parameter.
3. Update the filter table in `SKILL.md` and `README.md`.
4. Document the new filter in `docs/architecture.md`.

To add a new deletion path (for example, "archive instead of delete"):

1. Add a new helper in `scripts/delete-repos.js` (e.g. `archiveRepos`).
2. Update the heredoc in `SKILL.md` to use the new helper.
3. Document the new mode in `README.md`.

Keep heredocs short and use the helper file when logic gets longer than ~30
lines. Inline scripts are easier to reason about for one-off operations.
