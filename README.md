# my-agent-skills

My personal [agent skills](https://agentskills.io) and custom agents:

- a **Playwright** toolkit that records a journey in a headed browser with you, writes the
  spec from what was recorded, and replays it until it passes — built for real sites with
  logins, 2FA and shadow DOM;
- an **Azure DevOps** intake skill (work item details, relations, history, state);
- a **plan-and-delegate** agent + workflow: plan with the expensive model, implement with
  the cheap one, verify with the project's tests.

Everything is Markdown plus a few Node scripts. No MCP server, no binary, no runtime
dependency, and nothing is published to a marketplace — you install straight from this repo.

## Install

Two tools install these skills as-is; **neither requires listing the repo anywhere**.

### 1. GitHub CLI — `gh skill` (public preview, gh ≥ 2.90; verified on 2.103.3)

```bash
# What does this repo offer? (prints <name>\t<description>, nothing is installed)
gh skill install imyesobo/my-agent-skills | column -t -s $'\t'

# One skill, into the current project, for your agent
gh skill install imyesobo/my-agent-skills playwright-spec-replay --agent pi

# All skills of the repo, user scope (available in every project)
gh skill install imyesobo/my-agent-skills --all --agent github-copilot --scope user

gh skill preview imyesobo/my-agent-skills playwright-cli-recording   # read it before installing
gh skill list                                                        # what you have installed
gh skill update --all                                                # bump against the source repo
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
the installed copy so `gh skill update` can track the source.

### 2. `npx skills` (the [skills.sh](https://skills.sh) CLI, Node ≥ 22.20)

```bash
npx skills add imyesobo/my-agent-skills --list          # lists the 5 skills, installs nothing
npx skills add imyesobo/my-agent-skills --skill azure-devops -a pi
npx skills add imyesobo/my-agent-skills --all           # every skill × every detected agent
npx skills add imyesobo/my-agent-skills --skill playwright-spec-replay -g -a claude-code -y
npx skills ls
npx skills update
npx skills remove playwright-spec-replay
```

Project scope by default, `-g` for user level; it **symlinks** into the agent directories
(`--copy` for real copies) and writes a `skills-lock.json` you can restore later with
`npx skills experimental_install`. Same destinations as above, except that `pi` shares
`.agents/skills/` with Codex/Cursor rather than using `.pi/skills/`.

Also accepted as a source, if you prefer pointing at one skill or another host:

```bash
npx skills add https://github.com/imyesobo/my-agent-skills/tree/master/skills/playwright/playwright-cli-recording
npx skills add https://dev.azure.com/<org>/<project>/_git/<repo>?path=/skills/azure-devops
npx skills add ./local/path/to/skills
```

Private repos need no extra flags: the CLI reuses your git credential helper, `gh` auth, SSH
keys, or `GITHUB_TOKEN`. Only `npx skills find` and the skills.sh badges depend on the registry;
`add` clones the git source directly.

### 3. Agents and workflows are not installable by either tool

`gh skill` and `npx skills` install **skills** only — neither copies custom agent files or
workflow files. Two ways to use the agents:

```bash
# GitHub Copilot CLI / VS Code custom agent
mkdir -p .github/agents
curl -fsSL -o .github/agents/playwright-test-recorder.agent.md \
  https://raw.githubusercontent.com/imyesobo/my-agent-skills/master/com.github.copilot/agents/playwright-test-recorder.agent.md
curl -fsSL -o .github/agents/plan-and-delegate.agent.md \
  https://raw.githubusercontent.com/imyesobo/my-agent-skills/master/com.github.copilot/agents/plan-and-delegate.agent.md
```

…or skip the agent file entirely: the Playwright agent is a two-paragraph wrapper whose real
instructions live in the **`playwright-test-recorder` skill**, so any agent that supports
skills gets the same behaviour from step 1 or 2 alone.

`workflows/plan-then-implement.js` is a Copilot CLI dynamic workflow: ask Copilot to register
it with `dynamic_workflows_manage` (operation `author`, name `plan-then-implement`) and run it
with `{ task: "…", skipReview?: false, planner?: "<model id>", implementer?: "<model id>" }`.

## What's in here

```
com.github.copilot/agents/
  playwright-test-recorder.agent.md   wrapper: loads the playwright-test-recorder skill
  plan-and-delegate.agent.md          plan with Opus, delegate each step to a Sonnet subagent
skills/
  README.md                           index of the skills, with the shared rules
  playwright/                         (group folder — not a skill itself)
    playwright-test-recorder/         orchestrator: the three phases + the hard rules
    playwright-cli-recording/         record: headed playwright-cli, one instruction at a time
    playwright-spec-authoring/        author: running list → tests/<name>.spec.ts (+ templates)
    playwright-spec-replay/           replay: run headed, read the failure, fix, re-run
  intake/                             (group folder — not a skill itself)
    azure-devops/                     ADO work items: details, relations, history, state
workflows/
  plan-then-implement.js              Plan → Review → Implement → Verify with two models
plugin.json                           agent-plugins manifest (name, description, keywords)
```

The Playwright skills are read-only by design: the **user** performs every login, 2FA, captcha
and native-dialog step, no credential is ever typed, read or stored, and nothing that creates,
pays, transfers, deletes or changes settings runs unless you explicitly ask for it.

## Conventions in this repo

- Each skill is one directory with a `SKILL.md`; `name` in the frontmatter must equal the
  directory name (`agentskills.io` validation), `description` is required, `argument-hint` is
  optional and preserved by both installers.
- **Group directories hold `README.md`, never `SKILL.md`.** A `SKILL.md` in a group directory
  is itself read as a skill: it shadows its children for the skills.sh CLI (they only appear
  with `--full-depth`) and gets its subtree copied twice on install.
- `gh skill publish --dry-run` validates the tree; `gh skill publish` (which needs no
  marketplace) adds the `agent-skills` topic and cuts a GitHub release — that tag is what
  `gh skill install` resolves and what you pin to.
