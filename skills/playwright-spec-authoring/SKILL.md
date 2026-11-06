---
name: playwright-spec-authoring
metadata:
  phase: playwright
description: "Turn a recorded running list of playwright-cli steps into a Playwright spec tests/<name>.spec.ts that loads storageState, contains no login or credentials, reuses or creates a per-site helpers file (manual-login wait, overlay dismissal, re-auth wait, downloads, popups, native print stub) and asserts every step. Use when: write the spec, generate the test file from the running list, add a section to an existing spec, which helper to use, what assertion to add after a step, create playwright.config.ts."
argument-hint: "Spec name and the running list (or 'add <section> to tests/<file>.spec.ts')"
---

# Writing a spec from a running list

Input: the numbered running list produced while recording (one `await page...` line per step with notes). Output: `tests/<name>.spec.ts` that passes with `npx playwright test tests/<name>.spec.ts`.

## 1. Project scaffolding (only if missing)

```bash
ls package.json playwright.config.ts tests/helpers 2>/dev/null
```

- No `package.json` → `npm init -y && npm i -D @playwright/test @types/node && npx playwright install chromium`.
- No `playwright.config.ts` → copy [config template](./assets/playwright.config.template.ts). It runs headed, 1 worker, with `storageState: '.auth/state.json'`, a long test timeout (manual login) and trace/video on failure.
- Add `.auth/`, `.playwright-cli/`, `test-results/`, `playwright-report/`, `node_modules/` to `.gitignore`.
- No `tests/helpers/<site>.ts` → copy [helpers template](./assets/site-helpers.template.ts) to `tests/helpers/<site>.ts` and adapt the three site-specific constants at the top (logged-in URL pattern, login URL pattern, overlay close-button names, re-auth heading). Everything else is generic.

Look at an existing spec for the same site first and mirror its structure.

## 2. Mandatory frame

```ts
import { test, expect } from '@playwright/test';
import { STORAGE_STATE, openLandingPage, /* …other helpers */ } from './helpers/<site>';

test.use({ storageState: STORAGE_STATE });

test('<Journey name>: <sections>', async ({ page }) => {
  await stubPrint(page);            // only if the journey presses a Print button
  await openLandingPage(page);      // goto + manual-login wait + overlay dismissal + state refresh
  …
});
```

Never write a login step, never fill credentials, never hard-code snapshot refs (`f24e316`), never `test.only`.

## 3. Translate each recorded step

| Recorded step / note | Write in the spec |
|----------------------|-------------------|
| `goto(<start url>)` + *(welcome dialog, conditional)* | `await openLandingPage(page);` |
| *(manual, not recorded)* login / 2FA / captcha | nothing — the helper waits for the user |
| a step after which the site showed a re-authentication screen | right after the click: `await passSecurityCheckIfNeeded(page, <locator proving the real page loaded>);` |
| a click that printed `Downloaded file …` | `const d = await downloadFrom(page, <trigger>); expect(d.suggestedFilename()).toMatch(/<pattern>$/i);` |
| a click after which `tab-list` showed a second tab | `await expectPopupFrom(page, <trigger>, /<url pattern>/);` |
| a Print button *(native dialog)* | `await <trigger>.click(); await expectPrintCalled(page);` |
| a menu opened by clicking an unnamed icon (`getByTestId(...)`) | wrap in a helper with retry (`openMenu` in the template) because headers often re-render after navigation |
| chip radio/checkbox clicked via its label | keep the label click, then `await expect(page.getByRole('radio', { name: '<label>' })).toBeChecked();` |
| a button whose label changes after first use (`Create…` → `Edit…`) | use a regex name: `/(Create\|Edit) note/` |
| a link whose name had leading/trailing whitespace or NBSP in the snapshot | regex name: `{ name: /Back/ }` |
| `page.goBack()` | keep, then assert the URL you returned to |
| truncated names emitted by playwright-cli (`{ name: 'More information about the' }`) | complete to the full accessible name from the snapshot |

Copy all other locators verbatim from the `### Ran Playwright code` lines.

## 4. One assertion after every step

Pick the strongest that is stable:

- URL: `await expect(page).toHaveURL(/#route\//);`
- Heading: `await expect(page.getByRole('heading', { name: '…', level: 1 })).toBeVisible();`
- State: `toHaveAttribute('aria-selected', 'true')`, `toBeChecked()`, `[expanded]` → `toBeVisible()` of the collapsed-label button
- Dialog open → its heading `toBeVisible()`; after closing → `toBeHidden()`
- List/table content: `toContainText(<text you created>)`, `columnheader` names, known item names
- Empty state text
- Live data (prices, balances, dates): assert structure, never values; for counts use `expect.poll(readCount).toBeLessThan(before)`

End with an assertion of the **final outcome** of the journey (the thing the task was about).

## 5. Locator rules

1. `getByRole` + full accessible name first; add `exact: true` whenever the name could be a prefix of another (`Close`/`Close session`, `Enrolled`/`Not enrolled`).
2. `getByText(..., { exact: true })` for chip labels and plain text.
3. CSS only for custom-element hosts or ids in the light DOM (`my-card[attr*="…"]`, `#date-picker a.next`); never for nodes inside a shadow root.
4. Don't scope to `getByRole('dialog')` on web-component sites — slotted buttons live outside the dialog node.
5. Don't anchor regexes on bare text nodes that share a parent (`/Results: \d+/`, not `/^Results: \d+$/`).
6. Duplicate labels → derive from a unique attribute: `label[for="${await input.getAttribute('id')}"]`.
7. Text inside nested shadow roots may have empty `textContent` → assert visibility and resulting navigation, not text.
8. Legit duplicates → `.first()` with a comment saying why.

## 6. Comments and naming

- Header comment: what the spec covers and what is deliberately out of scope.
- `// --- Section ---` per recorded block; comment only non-obvious workarounds.
- Test title: `'<Journey>: <comma-separated sections>'`. File: `tests/<kebab-name>.spec.ts` (suffix `-read` for read-only journeys if the project uses that convention).

## 7. Before handing over

```bash
npx playwright test --list | grep -i "<name>"
```

The test must be listed (this compiles the TypeScript). Then switch to the `playwright-spec-replay` skill.
