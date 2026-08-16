/**
 * delete-repos.js
 *
 * Reusable helper for github-repo-cleaner skill.
 *
 * Usage from an ego-browser nodejs heredoc:
 *
 *   ego-browser nodejs <<'EOF'
 *   const { listRepos, applyFilter, deleteRepos } = await import('./scripts/delete-repos.js')
 *   // ...
 *   EOF
 *
 * The functions are written so they can also be pasted directly into a heredoc
 * if the user prefers inline scripts.
 */

/**
 * Load every user-owned repository for `login`.
 * Returns an array of { name, url, language, description, createdAt }.
 */
async function listRepos(login) {
  const repos = []
  for (let p = 1; p <= 10; p++) {
    await gotoAndWait(`https://github.com/${login}?tab=repositories&page=${p}`, { timeout: 25, settle: 1 })
    const text = await js(String.raw`document.body.innerText`)
    const page = await js(String.raw`(()=>[...document.querySelectorAll('a[href]')].map(a=>({name:a.innerText.trim(),url:a.href})).filter(x=>/^https:\/\/github\.com\/${login}\/[^/]+$/.test(x.url)&&x.name.includes('/')).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i))()`)
    repos.push(...page)
    if (!/Next/.test(text)) break
  }
  // Hydrate language/description/createdAt by visiting each repo once.
  for (const r of repos) {
    await gotoAndWait(r.url, { timeout: 20, settle: 0.5 })
    const meta = await js(String.raw`(()=>{const t=document.querySelector('title')?.textContent;const el=[...document.querySelectorAll('relative-time')][0];const lang=[...document.querySelectorAll('a[href*="/search?l="]')].map(x=>x.textContent.trim())[0];return {title:t,created:el?.getAttribute('datetime'),text:el?.textContent.trim(),language:lang||null}})()`)
    r.createdAt = meta.created
    r.language = meta.language
    if (meta.title && meta.title.includes(':')) {
      r.description = meta.title.split(':').slice(1).join(':').trim()
    }
  }
  return repos
}

/**
 * Apply filter rules.
 *   keywords:  array of substrings matched against name/description (case-insensitive)
 *   languages: array of exact primary-language values
 * Returns the matched subset.
 */
function applyFilter(repos, { keywords = [], languages = [] } = {}) {
  return repos.filter(r => {
    const text = `${r.name} ${r.description || ''}`.toLowerCase()
    const k = keywords.length === 0 || keywords.some(kw => text.includes(kw.toLowerCase()))
    const l = languages.length === 0 || languages.includes(r.language)
    return k && l
  })
}

/**
 * Delete a list of repository names for `login`. Returns per-repo results.
 * NEVER call without explicit user confirmation.
 */
async function deleteRepos(login, names) {
  const results = []
  for (const repo of names) {
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
      await gotoAndWait(`https://github.com/${login}/${repo}`, { timeout: 20, settle: 0.5 })
      const info = await pageInfo()
      results.push({
        repo,
        deleted: info.title.startsWith('Page not found'),
        title: info.title,
      })
    } catch (e) {
      results.push({ repo, error: String(e) })
    }
  }
  return results
}

export { listRepos, applyFilter, deleteRepos }
