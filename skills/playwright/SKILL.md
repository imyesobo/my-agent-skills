---
name: playwright
description: Skill collection for recording, authoring and replaying Playwright end-to-end specs against real websites (including shadow-DOM / web-component apps) with a headed playwright-cli session. Use when asked to record a test, drive a browser, write a spec from recorded steps, or replay a spec until it passes. Driven by the playwright-test-recorder agent.
---

# Playwright Skills

Skills in this collection cover the full loop of building an end-to-end spec by hand with a human in the loop: record the journey in a headed browser, write the spec from the recorded steps, then replay and fix it until it is green. The [playwright-test-recorder](../../com.github.copilot/agents/playwright-test-recorder.agent.md) agent runs the three phases in order and loads the matching skill at the start of each.

## Available Skills

| Skill | Phase | Description |
|-------|-------|-------------|
| [playwright-cli-recording](playwright-cli-recording/SKILL.md) | Record | Drive a headed browser with `playwright-cli` one user instruction at a time, keep the running list of `await page…` lines, wait for the user to log in or pass 2FA, save `.auth/state.json`, and maintain a per-site locator cookbook |
| [playwright-spec-authoring](playwright-spec-authoring/SKILL.md) | Author | Turn the running list into `tests/<name>.spec.ts` with no login steps or credentials, a per-site helpers file (manual-login wait, overlay dismissal, re-auth wait, downloads, popups, print stub) and an assertion after every step |
| [playwright-spec-replay](playwright-spec-replay/SKILL.md) | Replay | Run the spec headed, tell the user exactly when to act, read the failure from the log / `error-context.md` / trace, apply the matching fix pattern and re-run until it passes |

## Shared rules

- The user performs every login, 2FA, captcha and native-dialog step; the agent never types, reads or stores a credential.
- Journeys are read-only by default: nothing that creates, pays, transfers, deletes or changes settings without an explicit instruction.
- Assertions are structural (headings, tabs, columns, known names, filename patterns), never on live prices, balances or dates.
- Locators learned while recording or fixing go into the project's cookbook at `tests/site-cookbooks/<host>.md`; the template is in [playwright-cli-recording/references/sites/README.md](playwright-cli-recording/references/sites/README.md).
