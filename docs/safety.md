# Safety

`github-repo-cleaner` deletes GitHub repositories. Deletions are **permanent**
— GitHub does not offer a UI to restore a deleted repository. This document
describes what the skill guarantees and where the limits are.

## What the skill guarantees

### 1. No deletion without explicit confirmation

The skill always shows the matched set to the user and asks for an explicit
"confirm" reply before deleting anything. It will not proceed on:

- An ambiguous reply (`maybe`, `看看`, `等一下`).
- A "list only" instruction (`show me my repos`).
- Silence — the skill waits for the user to reply.

### 2. Only user-owned repositories

The skill only operates on repositories under the logged-in user's namespace.
Organization repositories are out of scope — they require org admin and a
different authentication path.

### 3. Verification after deletion

For every repository the skill attempts to delete, it:

- Re-navigates to `https://github.com/<login>/<repo>`.
- Reads the page title.
- Considers the deletion successful only when the title is `Page not found · GitHub`.

If the title is anything else, the skill reports a failure and does not mark
the repo as deleted.

### 4. Errors are surfaced, not swallowed

If `browserFetch` throws (e.g. session expired), the skill captures the error,
reports it, and stops the batch. It does not silently retry or skip.

### 5. Single-task isolation

The skill runs in a single `ego-browser` task space. If the user takes over
the browser manually, the skill stops and asks for explicit confirmation to
resume.

## What the skill does NOT do

### It does not protect against user mistakes

If the user types `确认删除` after seeing a list that includes a repo they
meant to keep, the skill will delete it. There is no per-repo un-delete.

Before confirming, the user should:

- Re-read the matched list carefully.
- Move any repo they want to keep into a separate "keep" list and pass it back
  to the skill: `保留这些仓库：...，其他的全部删除`.
- Archive (rather than delete) important repos before the session ends.

### It does not bypass GitHub's web-side checks

GitHub rejects a `POST /settings/delete` if:

- The user is not an admin or owner of the repo.
- The repo is part of a GitHub App installation with admin protection.
- Branch protection rules or required signatures block the deletion.
- Two-factor authentication or other session policies require re-prompting.

When this happens, GitHub returns an HTML error page. The skill detects the
non-`Page not found` title and reports the repo as failed. The user must
resolve the underlying issue (e.g. transfer ownership, disable branch
protection) and re-run the skill.

### It does not delete forks differently from regular repos

A fork under your account is deletable just like any other repo. The skill does
not check whether the repo is a fork. If you want to keep your fork of an
upstream repo, list it in the keep-set.

### It does not handle bulk transfers

If you want to keep a repo but transfer it to an organization first, you must
do that before invoking the skill. The skill does not auto-transfer.

### It does not untransfer or restore

Once deleted, a repo is gone. The skill cannot recover it. If you need a
recovery path, archive the repo first (Settings → Archive this repository) —
GitHub keeps archived repos indefinitely.

## Threat model

The skill assumes:

- The user is the rightful owner of the GitHub account they are logged into.
- The `ego-browser` runtime has not been tampered with.
- The user reads the matched list before confirming.

It does **not** protect against:

- A compromised GitHub session (the skill would happily delete everything).
- A user confirming a list that contains a typo or a repo they didn't realise
  was theirs.

## Recommended workflow

For maximum safety:

1. **Make a backup** of any repo you might regret deleting. `git clone --mirror` is the simplest way.
2. **Archive instead of delete** when you can. The "Archive this repository" button is reversible.
3. **Start small.** Run the skill on a single repo first to verify the workflow.
4. **Read the matched list carefully** before confirming. Look at every row.
5. **Move repos you want to keep into an organization** before bulk deletion, so they are out of the user's namespace entirely.

## Reporting a safety issue

If you discover a way the skill deletes something it should not, open an issue
at <https://github.com/beepony/github-repo-cleaner/issues>. Please do not
include real repo names in the report.
