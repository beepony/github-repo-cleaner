---
name: github-repo-cleaner
description: Find, review, and delete the user's GitHub repositories by keyword in name/description or by primary language. Use this skill when the user asks to delete, clean up, or bulk-remove their own GitHub repositories. Triggers on phrases like "delete my GitHub repos", "批量删除仓库", "清理仓库", "remove all PHP repos". Always confirms the deletion list with the user before any destructive action.
---

# GitHub Repo Cleaner

This skill helps a Claude Code agent find, review, and delete GitHub repositories owned by the user, filtered by keyword (substring match against repo name or description) or by primary language.

> ⚠️ This is destructive. The user must explicitly confirm every batch before any deletion runs. After deletion, every repo is verified by re-checking its URL.

## Dependencies

The skill uses the `ego-browser` runtime to drive the user's authenticated browser session.

- Install: follow the setup steps at `references/install.md` of the `ego-browser` skill (path `~/.agents/skills/ego-browser/` or `~/.claude/skills/ego-browser/`).
- Verify with: `command -v ego-browser` — it must resolve. If it does not, add `~/.local/bin` to PATH or run the install script again.
- The user must already be logged into GitHub in `ego-browser`.

## When to use

Use this skill when the user asks any of:

- "Delete my GitHub repos that contain `legacy`"
- "Delete all PHP / Ruby / Python repos in my account"
- "批量删除我的 GitHub 仓库"
- "Clean up my old GitHub repos"
- "List my repos and tell me which ones are PHP, then delete them"

If the user only wants to list or audit repositories without deleting, stop after step 3 and present the list.

## Filter syntax

| Kind     | Example       | Effect                                                                |
|----------|---------------|-----------------------------------------------------------------------|
| Keyword  | `legacy`      | Match repos whose name or description contains `legacy`.              |
| Language | `PHP`         | Match repos whose primary language is `PHP`.                          |

Multiple keywords OR together; multiple languages OR together; different kinds AND together.

If the user names a "keep" set, subtract it from the matched list before confirming.

## Workflow

Each step is a `Bash` tool call running `ego-browser nodejs <<'EOF'`. Reuse the same task space across rounds — start each heredoc with `useOrCreateTaskSpace('github-repo-cleaner')`.

### Step 1 — Identify the user

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('github-repo-cleaner')
await openOrReuseTab('https://github.com', { wait: true })
const me = await js(String.raw`(()=>{const a=document.querySelector('meta[name=user-login]');return a?a.content:null})()`)
cliLog(JSON.stringify({ taskId: task.id, login: me }))
EOF
```

**Always confirm the username with the user before continuing.** A common mistake is reading the username from the global feed (which shows followed users), not from the logged-in account.

### Step 2 — Load repositories

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

### Step 3 — Filter and present

```bash
ego-browser nodejs <<'EOF'
const login = '<username>'
const keywords = ['<keyword-1>', '<keyword-2>']        // substring matches
const languages = ['<LANG1>', '<LANG2>']               // exact language matches
const repos = <paste output from step 2>

const matched = repos.filter(r => {
  const text = `${r.name} ${r.description || ''}`.toLowerCase()
  const k = keywords.length === 0 || keywords.some(kw => text.includes(kw.toLowerCase()))
  const l = languages.length === 0 || languages.includes(r.language)
  return k && l
})
cliLog(JSON.stringify(matched, null, 2))
EOF
```

Show the user the matched set with name, language, description, and creation date, then ask:

> 匹配到 N 个仓库：… 请回复"确认删除"以继续。

### Step 4 — Human gate

**Do not proceed without explicit confirmation.** Acceptable replies: `确认删除`, `confirm delete`, `yes delete all`, `go ahead`. Reject: `maybe`, `看看`, `先别`, `don't delete`.

### Step 5 — Delete (only after confirmation)

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

### Step 6 — Report

Summarise per-repo results. Surface any error rows without retrying silently.

### Step 7 — Cleanup

```bash
ego-browser nodejs <<'EOF'
await useOrCreateTaskSpace('github-repo-cleaner')
await completeTaskSpace('github-repo-cleaner', { keep: false })
EOF
```

## Safety rules

1. **Always confirm before deletion.** Never delete anything the user did not explicitly approve in the latest message.
2. **Always verify after deletion.** A repo that still resolves to its settings page was NOT deleted.
3. **Always identify the user from the session**, not from page content. The global feed shows followed users, not the logged-in account.
4. **Stop on errors.** If `browserFetch` throws, capture the error, surface it to the user, and ask whether to retry or skip.
5. **Stop on takeover.** If you get `user is controlling`, hand off via `handOffTaskSpace`. Resume only after explicit user confirmation.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| `browserFetch` returns the login page | Session cookie lost; ask the user to re-open `ego-browser` and log into GitHub. |
| `delete form unavailable` | The repo has no `Delete this repository` button. Likely a fork without admin rights, or a repo where the user is not an owner. Skip and report. |
| `verification_field` validation rejects input | The form expects exact `owner/name` string. Use `fillInput('input.js-repo-delete-proceed-confirmation', 'owner/name')`. |

## Companion files

For the full design notes, see the upstream repo:

- `README.md` — feature list, install, filter reference.
- `docs/architecture.md` — why `browserFetch` instead of click-driven dialogs.
- `docs/safety.md` — threat model and limitations.
