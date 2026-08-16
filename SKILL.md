---
name: github-repo-cleaner
description: 帮助用户批量列出、筛选并删除 GitHub 仓库。Use this skill when the user asks to delete, clean up, bulk-remove, or audit GitHub repositories — typically by keyword in the repo name, description, or primary language (e.g. "delete repos containing 'legacy'", "remove all PHP repos", "delete Rust projects"). Triggers on phrases like "delete my GitHub repos", "批量删除仓库", "清理仓库", "删掉不用的仓库". Always confirms the deletion list with the user before any destructive action.
metadata:
  version: "1.0.0"
  date: "2026-08-16"
---

# github-repo-cleaner

A pi skill that automates finding, reviewing, and deleting GitHub repositories that match a user's criteria — by keyword in the name/description, or by primary language.

This skill is **destructive**. It never deletes a repository without an explicit per-batch confirmation. Every deletion is verified afterwards.

The skill depends on the `ego-browser` runtime that ships with the [pi coding agent](https://github.com/baryonlabs/pi-agent). All browser automation runs through that runtime.

## When to use

Use this skill when the user asks any of:

- "Delete my GitHub repos that contain `legacy`"
- "Delete all PHP / Ruby / Python / Rails repos in my account"
- "批量删除我的 GitHub 仓库"
- "Clean up my old GitHub repos"
- "List my repos and tell me which ones are PHP, then delete them"
- "列出我的仓库，标记出 PHP 的，然后删掉它们"

If the user only wants to *list* or *audit* repositories without deleting, prefer `list` mode and stop before the confirmation step.

If the user wants to delete a single repository, you can still use this skill — the workflow is the same, just the matched set is size 1.

## What this skill does

1. Loads the user's own repositories from `https://github.com/<username>?tab=repositories` (all pages).
2. Extracts the primary language for each repository by visiting its `/settings` page or its main page.
3. Applies the user's filter rules (see [Filter rules](#filter-rules) below).
4. Shows the matched list back to the user with name, language, description, and creation date.
5. **Asks the user to confirm** the deletion list. Never proceed without explicit confirmation.
6. Deletes each confirmed repository via the GitHub web UI's `POST /<owner>/<repo>/settings/delete` form. The skill uses `browserFetch` from `ego-browser` so the user's existing GitHub session is reused — no API token is required.
7. After deletion, navigates back to each repo URL and verifies it returns `Page not found · GitHub`.

## What this skill does NOT do

- It never deletes repositories the user did not list in the confirmation step.
- It never deletes organizations (only user-owned repos).
- It does not untransfer or restore deleted repos.
- It does not handle forks differently — forking a repo is still deletion of the fork under your account.

## Filter rules

The skill accepts any combination of three filter kinds:

| Kind     | Example              | Matches when repo name OR description contains the keyword (case-insensitive) |
|----------|----------------------|--------------------------------------------------------------------------------|
| Keyword  | `legacy`, `archive`  | Name/description contains the substring (case-insensitive).                    |
| Language | `PHP`, `Ruby`, `Rust`| Primary language equals the value (case-sensitive, as GitHub reports it).      |

Multiple filters of the same kind are OR-ed. Different kinds are AND-ed.

Examples:

- `legacy` + `PHP` → matches repos containing `legacy` OR named with PHP as primary language.
- `archive` only → matches all repos whose name or description contains `archive`.
- `language:PHP` only → matches all repos whose primary language is PHP.

## Workflow

Each round is a `ego-browser nodejs` heredoc. Reuse the same task space across rounds — start with `useOrCreateTaskSpace('github-repo-cleaner')`.

### 1. Identify the user

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('github-repo-cleaner')
await openOrReuseTab('https://github.com', { wait: true })
const me = await js(String.raw`(()=>{const a=document.querySelector('meta[name=user-login]');return a?a.content:null})()`)
// or via the avatar menu:
const name = await js(String.raw`(()=>{const el=document.querySelector('header img[alt][src*="avatars"]');return el?.alt||null})()`)
cliLog(JSON.stringify({ taskId: task.id, login: me }))
EOF
```

Always confirm the username with the user before proceeding. A common mistake is reading the username from the global feed (which shows followed users), not from the logged-in account.

### 2. Load repositories

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('github-repo-cleaner')
const login = '<username>'
const repos = []
for (let p = 1; p <= 10; p++) {
  await gotoAndWait(`https://github.com/${login}?tab=repositories&page=${p}`, { timeout: 25, settle: 1 })
  const text = await js(String.raw`document.body.innerText`)
  const page = await js(String.raw`(()=>[...document.querySelectorAll('a[href]')].map(a=>({name:a.innerText.trim(),url:a.href})).filter(x=>/^https:\/\/github\.com\/${login}\/[^/]+$/.test(x.url)&&x.name.includes('/')).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i))()`)
  repos.push(...page)
  if (!/Next/.test(text)) break
}
cliLog(JSON.stringify(repos))
EOF
```

### 3. Apply filters and present the list

```bash
ego-browser nodejs <<'EOF'
const login = '<username>'
const keywords = ['legacy']           // substring matches against name/description
const languages = ['PHP', 'Ruby']    // exact primary language matches
const repos = <output from step 2>

const matched = repos.filter(r => {
  const text = `${r.name} ${r.description || ''}`.toLowerCase()
  const k = keywords.length === 0 || keywords.some(kw => text.includes(kw.toLowerCase()))
  const l = languages.length === 0 || languages.includes(r.language)
  return k && l
})

cliLog(JSON.stringify(matched, null, 2))
EOF
```

Then **stop and ask the user to confirm**. Present each repo's name, language, description, and creation date. Show the total count. Do not proceed without explicit approval.

### 4. Confirm with the user

Send a message like:

> 匹配到 N 个仓库：
> - `name` (Language) — description — created
> ...
>
> 请回复"确认删除"以继续，否则告诉我需要修改的内容。

Only continue when the user replies with a confirmation such as `确认删除`, `confirm delete`, `yes delete all`, `go ahead`, etc. Phrases like `看看`, `先别`, `等一下`, `don't delete` mean stop.

### 5. Delete

Use `browserFetch` to POST to each repository's settings/delete endpoint. This bypasses the multi-step confirmation dialog while still sending the same request the browser would.

```bash
ego-browser nodejs <<'EOF'
const login = '<username>'
const toDelete = ['repo-a', 'repo-b', ...]   // confirmed by user
const results = []

for (const repo of toDelete) {
  try {
    await gotoAndWait(`https://github.com/${login}/${repo}/settings`, { timeout: 30, settle: 1 })
    const d = await js(String.raw`(()=>{const f=[...document.forms].find(f=>f.action.endsWith('/settings/delete'));return f?{action:f.action,token:f.querySelector('[name=authenticity_token]').value}:null})()`)
    if (!d) { results.push({ repo, error: 'delete form unavailable' }); continue }
    const body = new URLSearchParams({
      _method: 'delete',
      authenticity_token: d.token,
      verify: `${login}/${repo}`,
    }).toString()
    await browserFetch(d.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    await gotoAndWait(`https://github.com/${login}/${repo}`, { timeout: 20, settle: 1 })
    const info = await pageInfo()
    results.push({ repo, deleted: info.title.startsWith('Page not found'), title: info.title })
  } catch (e) {
    results.push({ repo, error: String(e) })
  }
}

cliLog(JSON.stringify(results, null, 2))
EOF
```

### 6. Verify and report

The script above already verifies each deletion by re-checking the repo page. Summarise the result:

- ✅ deleted: confirmed as `Page not found`.
- ❌ error: present the error, do not retry silently.

### 7. Close the task space

```bash
ego-browser nodejs <<'EOF'
await useOrCreateTaskSpace('github-repo-cleaner')
await completeTaskSpace('github-repo-cleaner', { keep: false })
EOF
```

## Safety rules

1. **Always confirm before deletion.** Never delete anything the user did not explicitly approve in the latest message.
2. **Always verify after deletion.** A repo that still resolves to its settings page was NOT deleted.
3. **Always identify the user from the session**, not from content on the page. The global feed shows followed users, not the logged-in account — reading a username from there will misidentify the operator.
4. **Stop on errors.** If `browserFetch` throws, capture the error, surface it to the user, and ask whether to retry or skip. Never silently retry an infinite loop.
5. **Stop on takeover.** If you get `user is controlling`, hand off via `handOffTaskSpace`. Resume only after explicit user confirmation.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| `browserFetch` returns the login page | Session cookie was lost; ask the user to re-open ego-browser and log into GitHub. |
| `delete form unavailable` | The repo has no `Delete this repository` button. Likely a fork without admin rights, or a repo where the user is not an owner. Skip and report. |
| `verification_field` validation rejects input | The form expects exact `owner/name` string. Use `fillInput('input.js-repo-delete-proceed-confirmation', 'owner/name')`. |
| The user says "delete my `X` repos" — `X` is a language, not a name | Translate `X` to a language filter. |

## Example session

```
user: 帮我删除我 GitHub 仓库里面所有包含 "legacy" 的仓库
agent: 好的，我先确认你的账号，然后扫描所有仓库。
agent: 你的账号是 `octocat`，对吗？
user: 对
agent: 扫描到 2 个含 "legacy" 的仓库：
       - legacy-app (JavaScript) — Old prototype app (fork) — 2019
       - legacy-docs (HTML) — Archived company docs (fork) — 2018
       确认删除吗？
user: 确认
agent: ✅ legacy-app deleted
       ✅ legacy-docs deleted
```

## Related

- Skill dependencies: `ego-browser` (browser automation)
- Companion scripts: `scripts/delete-repos.js` — reusable helper that wraps the deletion loop.
- License: MIT
