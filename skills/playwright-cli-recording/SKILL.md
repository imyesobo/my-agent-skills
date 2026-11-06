---
name: playwright-cli-recording
description: "Drive a headed browser with playwright-cli to record a user journey on any website step by step, including shadow-DOM / web-component sites. Use when: open a headed browser, playwright-cli open/snapshot/click/fill/run-code/eval, keep a running list of '### Ran Playwright code', wait for the user to log in or pass 2FA/captcha, state-save .auth/state.json, an element is not clickable or has no accessible name, intercepts pointer events, strict mode violation, find the clickable ancestor."
license: MIT
argument-hint: "Start URL (first time) or the next step the user wants"
metadata:
  phase: playwright
---

# Recording a journey with playwright-cli

You are the hands; the user is the brain. The user gives one instruction, you execute it in the headed browser, report what happened plus the updated running list, then wait for the next instruction.

## 0. Setup (once per session)

```bash
ls .playwright/cli.config.json 2>/dev/null || { mkdir -p .playwright && printf '{\n  "browser": { "browserName": "chromium" }\n}\n' > .playwright/cli.config.json; }
playwright-cli open <start-url> --headed
```

- `Chromium distribution 'chrome' is not found` → the config above is missing; create it and retry. Do not try `sudo` or `install-browser chrome`.
- Check `tests/site-cookbooks/<host>.md` in the project you are recording against. If it exists, read it: it lists verified locators, URL patterns and gotchas for this site. If not, you will create it at the end (see §7).

## 1. Login / 2FA / captcha — the user does it

If the page is a login, consent wall, captcha or second-factor screen, say exactly this and stop: *"The browser is on the login page. Please complete it in that window (I won't record it). Say 'continue' when you're in."* Use the ask-user tool with a single "continue" choice when available.

When the user says continue:

```bash
mkdir -p .auth && playwright-cli state-save .auth/state.json
playwright-cli snapshot > /tmp/snap.txt; grep -nE "Page URL|Page Title|dialog \[|button \"(Close|Cerrar|Accept|Aceptar|OK|Got it|Entendido)\"" /tmp/snap.txt | head
```

- Confirm the URL is past login. If not, ask again; never type credentials.
- If a welcome/announcement `dialog` is open, close it and record that step with the note *(welcome dialog, conditional)*.

The same rule applies at any later point where the page demands something only the user can do (re-authentication, device confirmation, native print/file dialogs): stop, do not record, ask, wait for "continue"/"done".

## 2. The action loop (repeat for every user instruction)

1. **Snapshot and locate** — never reuse a ref from an earlier snapshot:
   ```bash
   playwright-cli snapshot > /tmp/snap.txt
   grep -nE "heading|tab \"|button \"|link \"|textbox|radio|checkbox|combobox|cell \"|dialog \[" /tmp/snap.txt | grep -iE "<words from the instruction>" | head
   sed -n 'START,ENDp' /tmp/snap.txt      # see role, name, [ref=…], parents and siblings
   ```
2. **Act** — prefer the ref command; fall back to `run-code` with a role/text locator:
   ```bash
   playwright-cli click <ref>
   playwright-cli fill <ref> "text"
   playwright-cli run-code "async (page) => { await page.getByRole('link', { name: 'Back' }).click(); }"
   ```
   `run-code` takes a **function** `async (page) => { … }`, not bare statements. Escape `$` as `\$` inside double quotes.
3. **Verify** — new snapshot; grep for what you expected: URL change, a heading, `dialog [`, `[checked]`, `[expanded]`, `[selected]`, an empty-state text, `Downloaded file …` in the command output, or a new tab in `playwright-cli tab-list`.
4. **Report** in this shape, then stop:
   - the `### Ran Playwright code` line(s) returned by the command, verbatim and in order;
   - one or two lines on what changed (URL, title, visible headings/options);
   - a locator note if the obvious locator failed and what worked instead;
   - the full numbered **Running list so far** (every step since `goto`, with `(conditional)` / `(manual, not recorded)` notes).

If the user asks to *check* something without acting, answer from the snapshot and add nothing to the list.

## 3. playwright-cli command reference

| Need | Command |
|------|---------|
| Accessibility tree | `playwright-cli snapshot` (redirect to a file and grep; refs are per-snapshot) |
| Look at the layout | `playwright-cli screenshot` → view the `.png` |
| Run JS in the page | `playwright-cli eval "(() => { … })()"` |
| Arbitrary Playwright code | `playwright-cli run-code "async (page) => { … }"` |
| Tabs | `playwright-cli tab-list`, `playwright-cli tab-close <index>` |
| History | `playwright-cli go-back` |
| Session | `playwright-cli state-save .auth/state.json`, `state-load` |
| Let the user record a step (rare) | `playwright-cli recording-start` … user acts … `playwright-cli recording-stop` → append the printed code to the list |
| Close | `playwright-cli close` (always before `npx playwright test`) |

## 4. When a click fails — decision table

| Error / symptom | Meaning | Do this |
|-----------------|---------|---------|
| `<custom-element …> intercepts pointer events` when clicking text inside a card/tile | the web-component host owns the click; inner `<a>` is hidden | click the host: `page.locator('<tag>[<attr>*="<visible name>"]')` (find a stable attribute with `eval`) |
| `element is not visible` on an `<a>` inside a list row | hidden anchor; the row is the control | `page.locator('<row-tag>').filter({ hasText: '<unique row text>' })` |
| click on a `radio`/`checkbox` input times out, label "covers" it | chip-style inputs | click the label: `getByText('<label>', { exact: true })`, or `label[for="<input id>"]` when the same label text exists twice |
| `strict mode violation … resolved to 2 elements` | name is a prefix/substring of another, or legit duplicate | `exact: true`; scope to a parent component; `.first()` only when both are the same control |
| element has no accessible name (icon button, 3‑dots) | decorative icon slotted in a parent control | find the ancestor chain (§5) and click the parent (`data-testid`, `button`, `a`) |
| URL unchanged, nothing visible happened | new tab or download | `playwright-cli tab-list`; look for `Downloaded file`; `tab-close 1` after noting the URL/filename |
| command hangs ~30 s after a "Print"/"Save as" button | native browser dialog | stop, ask the user to dismiss it, record the step with note *(native dialog — stub in spec)* |
| `waiting for getByRole('dialog').getByRole('button', …)` while the button is visibly in the dialog | slotted light‑DOM children are not descendants of the `role=dialog` node | drop the `getByRole('dialog')` scope |
| `locator('aria-ref=…')` resolved to a `<span>`/`<path>`/`<div>` | you targeted text/icon, not the control | pick the nearest `button`/`link`/`cell` ref in the snapshot, or a role locator |
| the control is not present on this page but was before | action bar exists only on a parent page | navigate back (`Volver`/`Back`/`go-back`) first |

## 5. Find the clickable ancestor of a nameless element

First get the element's coordinates from a screenshot or a listing `eval`, then walk up through shadow roots:

```bash
playwright-cli eval "(() => { const X=<x>, Y=<y>; const find=(root)=>{ for (const el of root.querySelectorAll('*')) { const r=el.getBoundingClientRect(); if (r.width>0 && r.width<60 && Math.abs(r.left-X)<4 && Math.abs(r.top-Y)<4) return el; } for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const f=find(el.shadowRoot); if (f) return f; } return null; }; let el=find(document); const chain=[]; while (el && chain.length<12) { chain.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.getAttribute('data-testid')?'[testid='+el.getAttribute('data-testid')+']':'')+(el.getAttribute('aria-label')?'[aria='+el.getAttribute('aria-label').slice(0,30)+']':'')); el = el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null); } return chain; })()"
```

Click the first `button`/`a`/`[testid]` in the chain. Prefer `getByTestId`, then `getByRole`, then a host-tag CSS selector.

## 6. Scope discipline

Default to read-only: navigate, open menus and dialogs, switch tabs/filters, expand sections, download documents, type into search boxes. Do not submit forms that create, pay, transfer, delete or change settings unless the user explicitly states that the script is for that operation. If the user asks for one, say it belongs in a separate script and skip it.

## 7. Maintain the site cookbook

When the task is done (or when you discover a non-obvious locator), append to `tests/site-cookbooks/<host>.md` in the project you are recording against (commit it — it is the memory of the next session):

- the URL pattern of every page visited (hash routes included);
- the locator that worked for each control that needed a workaround, and why;
- recurring gotchas (overlays, re-rendering headers, single-session limits, 2FA pages, native dialogs).

Use tables grouped by page. Follow the template in [sites/README.md](./references/sites/README.md); if no cookbook exists for the host yet, create `tests/site-cookbooks/<host>.md` from that template.
