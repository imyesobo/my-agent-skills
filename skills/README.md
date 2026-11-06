# Skills

Skills are grouped by phase. **A group directory is not a skill** (there is deliberately no
`SKILL.md` in a group directory: a `SKILL.md` there shadows everything nested below it for
some installers and makes them copy the subtree twice). Each leaf directory that contains a
`SKILL.md` is one installable skill.

## playwright — record, author, replay an end-to-end spec

| Skill | Phase | Description |
|-------|-------|-------------|
| [playwright-test-recorder](playwright/playwright-test-recorder/SKILL.md) | Orchestrate | Runs the three phases in order and holds the hard rules (the user always does login/2FA, no credentials in specs, read-only by default) |
| [playwright-cli-recording](playwright/playwright-cli-recording/SKILL.md) | Record | Drive a headed browser with `playwright-cli` one user instruction at a time, keep the running list of `await page…` lines, wait for the user to log in or pass 2FA, save `.auth/state.json`, maintain a per-site locator cookbook |
| [playwright-spec-authoring](playwright/playwright-spec-authoring/SKILL.md) | Author | Turn the running list into `tests/<name>.spec.ts` with no login steps or credentials, plus config/helpers/spec templates |
| [playwright-spec-replay](playwright/playwright-spec-replay/SKILL.md) | Replay | Run headed, tell the user exactly when to act, read the failure from log / `error-context.md` / trace, apply the matching fix, re-run |

Shared rules:

- The user performs every login, 2FA, captcha and native-dialog step; the agent never types, reads or stores a credential.
- Journeys are read-only by default: nothing that creates, pays, transfers, deletes or changes settings without an explicit instruction.
- Assertions are structural (headings, tabs, columns, known names, filename patterns), never on live prices, balances or dates.
- Locators learned while recording or fixing go into the tested project's cookbook at `tests/site-cookbooks/<host>.md`; the template is in [playwright-cli-recording/references/sites/README.md](playwright/playwright-cli-recording/references/sites/README.md).

## intake — gather context before implementing

| Skill | Description |
|-------|-------------|
| [azure-devops](intake/azure-devops/SKILL.md) | Retrieve Azure DevOps work item details, relations, history, tags and state |

See [intake/README.md](intake/README.md).
