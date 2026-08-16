# github-repo-cleaner

用来列出、筛选并删除 GitHub 仓库的 skill —— 按仓库名/描述中的关键词，或按主要编程语言筛选。

支持 **pi** 和 **Claude Code**。底层工作流只依赖 shell，任何能执行 shell 的 agent 都可以用。

[English](README.md) · **[中文](README.zh-CN.md)**

> ⚠️ 这是一个会删除数据的工具。每次执行前都会列出匹配项并等待你明确确认。

## 作用

- 列出账号下所有仓库。
- 按 **关键词**（匹配仓库名或描述的子串）或 **语言**（精确匹配 GitHub 报告的主要语言）筛选。
- 展示匹配项，包括名称、语言、描述、创建时间。
- 在执行删除前等待你的 `确认删除` / `confirm delete` 回复。
- 通过浏览器当前会话删除，无需 GitHub token。
- 删除后访问仓库 URL 验证是否真的删除。

## 快速开始

### 1. 安装 `ego-browser`

```bash
sh ~/.agents/skills/ego-browser/scripts/install.sh   # 仅 macOS
command -v ego-browser                               # 必须输出一个路径
```

打开 `ego-browser` 并登录 GitHub。

### 2. 安装 skill

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

**Codex CLI / 通用 shell**

Codex 没有 skill 加载机制，但工作流本质就是 shell 命令。两种用法：

1. **嵌入 `AGENTS.md`** —— 把 [`.claude/skills/github-repo-cleaner/SKILL.md`](./.claude/skills/github-repo-cleaner/SKILL.md) 里的 heredoc 模板复制到项目的 `AGENTS.md`。当你让 Codex 清理仓库时它会自动执行。

2. **手动执行 heredoc** —— 把每个代码块粘贴到终端，或交给 `codex exec` / `codex --full-auto`：

   ```bash
   # 识别当前登录账号
   ego-browser nodejs <<'EOF'
   const task = await useOrCreateTaskSpace('github-repo-cleaner')
   await openOrReuseTab('https://github.com', { wait: true })
   const me = await js(String.raw`(()=>{const a=document.querySelector('meta[name=user-login]');return a?a.content:null})()`)
   cliLog(JSON.stringify({ login: me }))
   EOF
   ```

同样的方式适用于 Cursor、Cline、Continue、Aider —— 任何能执行 `ego-browser nodejs <<'EOF' ... EOF` 的 agent。

### 3. 发起请求

```
删除我所有包含 legacy 的仓库
```

```
保留一下仓库：repo-a、repo-b、repo-c，除了这些之外的，全部删除
```

skill 会先展示匹配项并请求确认。

## 筛选规则

| 类型     | 示例值    | 匹配条件                                                      |
|----------|-----------|--------------------------------------------------------------|
| 关键词   | `legacy`  | 仓库名或描述包含 `legacy`                                    |
| 关键词   | `archive` | 仓库名或描述包含 `archive`                                   |
| 语言     | `PHP`     | 主要编程语言为 `PHP`                                         |
| 语言     | `Ruby`    | 主要编程语言为 `Ruby`                                        |

- 多个关键词之间是「或」的关系。
- 多个语言之间是「或」的关系。
- 不同类型之间是「且」的关系。

### 示例

| 请求                                            | 实际筛选条件                        |
|-------------------------------------------------|--------------------------------------|
| `delete all repos containing legacy`            | keyword: `legacy`                    |
| `delete all repos containing legacy archive`    | keywords: `legacy`, `archive`        |
| `delete all PHP repos`                          | language: `PHP`                      |
| `delete all PHP and Ruby repos`                 | languages: `PHP`, `Ruby`             |
| `delete PHP repos containing legacy`            | keyword `legacy` AND language `PHP`  |

### 保留清单

```
保留一下仓库：repo-a、repo-b、repo-c，除了这些之外的，全部删除
```

保留清单会从匹配结果中减去，剩余的才进入删除流程。

## 目录结构

```
github-repo-cleaner/
├── README.md                                  # 英文版
├── README.zh-CN.md                            # 本文件（中文版）
├── SKILL.md                                   # pi skill 入口
├── .claude/skills/github-repo-cleaner/SKILL.md  # Claude Code skill 入口
├── scripts/delete-repos.js                    # 可选的辅助函数
├── docs/architecture.md
├── docs/safety.md
└── LICENSE
```

## 文档

- [SKILL.md](./SKILL.md) — pi skill 完整定义，含 heredoc 模板。
- [.claude/skills/github-repo-cleaner/SKILL.md](./.claude/skills/github-repo-cleaner/SKILL.md) — Claude Code skill 完整定义。
- [docs/architecture.md](./docs/architecture.md) — 每轮 heredoc 的工作原理。
- [docs/safety.md](./docs/safety.md) — skill 的保证与局限。

## 局限

- 仅作用于用户个人仓库。组织仓库需要组织管理员权限，不在范围内。
- 需要 `ego-browser` 已登录 GitHub。
- fork 仓库按普通仓库处理，删除 fork 会删除 fork。
- GitHub 端限制（分支保护、App 权限）可能阻止个别删除，skill 会报告失败并继续。

## 许可证

MIT
