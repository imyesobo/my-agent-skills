# my-agent-skills

My personal agent skills and custom agents, packaged as an
**[Agent Plugins](https://agent-plugins.org) 1.0.0 plugin** — one layout that any conformant
client can install (GitHub Copilot CLI, VS Code, Cursor, Codex, Kiro, OpenHands, …), and that
`gh skill` and the skills.sh CLI install as plain skills.

- a **Playwright** toolkit that records a journey in a headed browser with you, writes the
  spec from what was recorded, and replays it until it passes — built for real sites with
  logins, 2FA and shadow DOM;
- an **Azure DevOps** intake skill (work item details, relations, history, state);
- a **Figma** intake skill (REST API + Code Connect, no MCP: layout, tokens, components, images);
- a **session-improve** review skill: what to change in this collection so the next session
  spends fewer credits;
- a **plan-and-delegate** agent: plan with the expensive model, implement with the cheap one,
  verify with the project's tests (plus two Copilot CLI workflows that do the same thing).

Everything is Markdown plus a few Node scripts. No MCP server, no binary, no runtime
dependency, and nothing is published to a third-party registry — you install from this repo.

## Install

### 1. As a plugin (recommended) — Copilot CLI, VS Code, Cursor, Codex, …

```bash
copilot plugin marketplace add imyesobo/my-agent-skills   # reads .github/plugin/marketplace.json
copilot plugin install my-agent-skills@imyesobo-agent-skills
copilot plugin list
```

Verified on Copilot CLI 1.0.106: installs **7 skills** and registers both custom agents as
`my-agent-skills:plan-and-delegate` and `my-agent-skills:playwright-test-recorder`.

To hack on the plugin itself, point the marketplace at your working copy — path-sourced
plugins are loaded **live**, no reinstall:

```bash
copilot plugin marketplace add /path/to/my-agent-skills
copilot plugin install my-agent-skills@imyesobo-agent-skills   # edits land on the next session
```

Other clients install the same repo through their own plugin UI/CLI; the portable parts are
`plugin.json`, `skills/` and (here, absent) `mcp.json`.

### 2. GitHub CLI — `gh skill` (public preview, gh ≥ 2.90; verified on 2.103.3)

```bash
gh skill install imyesobo/my-agent-skills | column -t -s $'\t'      # what does it offer?
gh skill install imyesobo/my-agent-skills playwright-spec-replay --agent pi
gh skill install imyesobo/my-agent-skills --all --agent github-copilot --scope user
gh skill preview imyesobo/my-agent-skills playwright-cli-recording  # read before installing
gh skill list ; gh skill update --all
```

Where the files land (verified with gh 2.103.3):

| `--agent`                                  | project scope             | `--scope user`         |
| ------------------------------------------ | ------------------------- | ---------------------- |
| `github-copilot` (default), `codex`, `cursor`, `gemini-cli`, `opencode`, `amp`, `cline`, `warp` | `.agents/skills/<name>/`  | `~/.agents/skills/<name>/` |
| `claude-code`                              | `.claude/skills/<name>/`  | `~/.claude/skills/<name>/` |
| `pi`                                       | `.pi/skills/<name>/`      | `~/.pi/agent/skills/<name>/` |
| any host, custom location                  | `--dir ./my-skills`       | `--dir ./my-skills`    |

`gh skill` resolves the source as the **latest GitHub release tag, else default-branch HEAD**,
and pins with `@v1.0.0` or `--pin <tag|sha>`. It injects `metadata.github-*` frontmatter into
the installed copy so `gh skill update` can track the source. Agents and workflows are not
installed by `gh skill` — use the plugin install above, or the `curl` fallback further down.

### 3. `npx skills` (the [skills.sh](https://skills.sh) CLI, Node ≥ 22.20)

```bash
npx skills add imyesobo/my-agent-skills --list          # lists the 7 skills, installs nothing
npx skills add imyesobo/my-agent-skills --skill intake-azure-devops -a pi
npx skills add imyesobo/my-agent-skills --all           # every skill × every detected agent
npx skills add imyesobo/my-agent-skills --skill playwright-spec-replay -g -a claude-code -y
npx skills ls ; npx skills update ; npx skills remove playwright-spec-replay
```

Project scope by default, `-g` for user level; it **symlinks** into the agent directories
(`--copy` for real copies) and writes a `skills-lock.json` you can restore later with
`npx skills experimental_install`. Same destinations as above, except that `pi` shares
`.agents/skills/` with Codex/Cursor rather than using `.pi/skills/`.

Also accepted as a source, if you prefer pointing at one skill or another host:

```bash
npx skills add https://github.com/imyesobo/my-agent-skills/tree/master/skills/playwright-cli-recording
npx skills add https://dev.azure.com/<org>/<project>/_git/<repo>?path=/skills/intake-azure-devops
npx skills add ./local/path/to/skills
```

Private repos need no extra flags: the CLI reuses your git credential helper, `gh` auth, SSH
keys, or `GITHUB_TOKEN`. Only `npx skills find` and the skills.sh badges depend on the registry;
`add` clones the git source directly.

### Agents without a plugin install

```bash
mkdir -p .github/agents
curl -fsSL -o .github/agents/playwright-test-recorder.agent.md \
  https://raw.githubusercontent.com/imyesobo/my-agent-skills/master/com.github.copilot/agents/playwright-test-recorder.agent.md
curl -fsSL -o .github/agents/plan-and-delegate.agent.md \
  https://raw.githubusercontent.com/imyesobo/my-agent-skills/master/com.github.copilot/agents/plan-and-delegate.agent.md
```

…or skip the agent file entirely: the Playwright agent is a two-paragraph wrapper whose real
instructions live in the **`playwright-test-recorder` skill**, so any client that supports
skills gets the same behaviour from install 2 or 3 alone.

## What's in here

```
LICENSE                                     MIT — skills, agents and workflows are yours to copy
plugin.json                                 Agent Plugins manifest ($schema 1.0.0, closed schema)
.github/plugin/marketplace.json             Copilot CLI marketplace catalog for this repo
skills/                                     every skill is ONE immediate child dir — see below
  playwright-test-recorder/                 orchestrator: the three phases + the hard rules
  playwright-cli-recording/                 record: headed playwright-cli, one instruction at a time
  playwright-spec-authoring/                author: running list → tests/<name>.spec.ts (+ templates)
  playwright-spec-replay/                   replay: run headed, read the failure, fix, re-run
  intake-azure-devops/                      ADO work items: details, relations, history, state
  intake-figma/                             Figma designs via REST API + Code Connect (no MCP)
  session-improve/                          review the session for credit-saving changes
    references/session-improve.md           the review prompt itself
com.github.copilot/                         Copilot-owned extension namespace (ignored by others)
  agents/plan-and-delegate.agent.md         plan with Opus, delegate each step to a Sonnet subagent
  agents/playwright-test-recorder.agent.md  wrapper: loads the playwright-test-recorder skill
  workflows/plan-then-implement.js          Plan → Review → Implement → Verify with two models
  workflows/plan-implement-evidence.js      same, plus visual evidence (Playwright / Storybook)
```

The Playwright skills are read-only by design: the **user** performs every login, 2FA, captcha
and native-dialog step, no credential is ever typed, read or stored, and nothing that creates,
pays, transfers, deletes or changes settings runs unless you explicitly ask for it.

`com.github.copilot/workflows/*.js` are Copilot CLI dynamic workflows: ask Copilot to register
one with `dynamic_workflows_manage` (operation `author`, name `plan-then-implement`) and run it
with `{ task: "…", skipReview?: false, planner?: "<model id>", implementer?: "<model id>" }`.

## Favourite skills from elsewhere

Third-party skills I install alongside this plugin. `gh skill` takes the skill as a **positional**
argument and the exact path skips the repo tree walk; skills.sh uses **`--skill`**. Refs and sizes
below were checked 2026-11-06 — upstreams move, so re-check a line before trusting it.

| Skill | Source · license | What it is for | Resolves to |
|---|---|---|---|
| `azure-devops-cli` | [github/awesome-copilot](https://github.com/github/awesome-copilot) · MIT | Azure DevOps CLI: projects, repos, pipelines, builds, PRs, work items — the CLI half of [intake-azure-devops](skills/intake-azure-devops/SKILL.md) | `main@797337f3` · 80 KB |
| `msgraph` | [merill/msgraph](https://github.com/merill/msgraph) · MIT | Microsoft Graph API knowledge resolved locally: 27,700+ endpoints, schemas, samples, no network calls | `v1.0.19` · **109 MB** |
| `confluence` | [odyssey4me/agent-skills](https://github.com/odyssey4me/agent-skills) · Apache-2.0 | Confluence pages and spaces: CQL search, read/create/update with Markdown | `0.7.0` · 100 KB |
| `gh-cli` | [github/awesome-copilot](https://github.com/github/awesome-copilot) · **deleted upstream 2026-05-14, pinned only** | Full `gh` reference: repos, issues, PRs, Actions, releases, gists, codespaces | `e9a7805e` · 40 KB |

```bash
# gh skill — user scope, so they are available in every project
gh skill install github/awesome-copilot  skills/azure-devops-cli --agent github-copilot --scope user
gh skill install merill/msgraph          skills/msgraph          --agent github-copilot --scope user
gh skill install odyssey4me/agent-skills skills/confluence       --agent github-copilot --scope user
gh skill install github/awesome-copilot 'skills/gh-cli@e9a7805e2b1dbda5ad4d0cc9be1fc3ef6273e115' --agent github-copilot --scope user

# skills.sh — same three by name; gh-cli needs a tree URL because its ref is pinned
npx skills add github/awesome-copilot  --skill azure-devops-cli
npx skills add merill/msgraph          --skill msgraph
npx skills add odyssey4me/agent-skills --skill confluence
npx skills add https://github.com/github/awesome-copilot/tree/e9a7805e2b1dbda5ad4d0cc9be1fc3ef6273e115/skills/gh-cli
```

- **`msgraph` costs 109 MB** — it carries the whole Graph corpus locally. `gh skill` copies and
  `npx skills` symlinks, so install that one with skills.sh unless you want a copy per machine.
  The others are pin-able too: `skills/msgraph@v1.0.19`, `--pin 0.7.0`.
- **`gh-cli` is a dead pin.** skills.sh still [pages it](https://www.skills.sh/github/awesome-copilot/gh-cli)
  (21.2K installs) because its index keeps history, but the installer reads the repo: unpinned it
  fails with `No matching skills found for: gh-cli`. Upstream removed it in `352def3c` (PR #1692)
  because Copilot CLI ≥ 1.0.46 handles read-only `gh` commands natively — you are on 1.0.106, so it
  is probably redundant; the pin above is the last commit that had it (2026-02-09) and its reference
  text is frozen at `gh` 2.85.0.
- To audit any line here:

  ```bash
  gh skill install <owner>/<repo> | column -t -s $'\t'                 # what that repo offers right now
  gh api "repos/<owner>/<repo>/commits?path=skills/<name>&per_page=3"   # when it moved, and why
  ```

## Conventions in this repo

- **One skill = one immediate child of `skills/`.** Agent Plugins §7.1: a client treats each
  immediate child dir holding a `SKILL.md` as a skill and **MUST NOT recurse deeper**. Group
  folders (`playwright/`, `intake/`) used to hold these skills; a conformant client found zero
  skills that way, so the phase grouping now lives in the skill name and in
  `metadata.phase` in the frontmatter instead of in the directory tree.
- `name` in the frontmatter must equal the directory name (agentskills.io validation),
  `description` is required (≤ 1024 chars), `argument-hint` is optional and preserved by both
  skill installers.
- Anything a single client owns goes in a top-level reverse-domain directory
  (`com.github.copilot/…`) — Agent Plugins §8.2. Nothing else at the root: the manifest schema
  is closed and the only portable component locations are `skills/` and `mcp.json`.
- Every skill declares `license: MIT` in its own frontmatter, because `gh skill install <repo> <skill>`
  and `npx skills add --skill <name>` copy **only that skill directory** — the root `LICENSE` does not
  travel with it, the frontmatter field does.
- `gh skill publish --dry-run` validates the tree; `gh skill publish` (which needs no
  marketplace) adds the `agent-skills` topic and cuts a GitHub release — that tag is what
  `gh skill install` resolves and what you pin to.

## License

[MIT](LICENSE) — `Copyright (c) 2026 Jesus Espejo Arnas`. Declared as `license: MIT` (SPDX) in
`plugin.json`, in the `.github/plugin/marketplace.json` catalog entry, and in each skill's
`SKILL.md` frontmatter, so clients show it and single-skill installs carry it.
