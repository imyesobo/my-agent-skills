---
name: playwright-spec-replay
metadata:
  phase: playwright
description: "Run a Playwright spec headed, coordinate manual login / 2FA with the user, read the failure (log, error-context.md, trace) and apply the matching fix pattern, then re-run until it passes. Use when: replay the spec, run the test, npx playwright test, the script is stuck, test failed, strict mode violation, intercepts pointer events, waiting for event popup, Login required, Security validation required, element not found after goBack."
argument-hint: "tests/<file>.spec.ts"
---

# Replaying a spec until green

Specs recorded behind a login cannot run unattended: the user logs in each run and may have to approve a second factor. Your job is to run the spec, tell the user exactly when to act, read failures precisely, fix with the smallest change, and re-run.

## 1. Pre-flight

```bash
playwright-cli close 2>/dev/null                    # sites with single-session limits log the test out otherwise
npx playwright test --list | grep -i "<name>"       # compiles TS; the test must be listed
rm -rf test-results
```

## 2. Run — in the background, output to a log file

```bash
npx playwright test tests/<file>.spec.ts > /tmp/replay.log 2>&1; echo "EXIT=$?" >> /tmp/replay.log
```

Start it as a background/async command, then immediately tell the user: *"A new browser window opened. Please log in there; the test waits up to 5 minutes. If it prints 'Security validation required', approve it on your phone. Tell me when you're done."* Stop and wait. Do not poll in a tight loop; check when the user replies or the command completes.

Progress markers printed by the helpers:

| Marker | Who acts |
|--------|----------|
| `>>> Login required…` | user logs in; `ensureLoggedIn` waits for the logged-in URL |
| `>>> Dismissing overlay via "…"` | automatic |
| `>>> Security validation required…` | user approves 2FA; helper waits up to `MANUAL_STEP_TIMEOUT` |
| `>>> No new tab yet; clicking again...` | automatic retry for a slow popup |

## 3. Read the result

```bash
grep -nE ">>>|passed|failed|Error:|EXIT=" /tmp/replay.log | head -12
grep -n "^    > " /tmp/replay.log | head -3                     # failing spec line
sed -n '/Call log/,/^$/p' /tmp/replay.log | head -20            # what Playwright was waiting for
grep -nE "heading|dialog \[|button \"|Page URL" test-results/*/error-context.md | head -30   # page state at failure
```

`1 passed` → report and stop. Otherwise match a row below, apply the fix, back to step 1. Change only the failing step.

For timing questions, extract the action timeline from the trace:

```bash
cd test-results/*/ && mkdir -p tr && cd tr && unzip -o -q ../trace.zip && python3 - <<'EOF'
import json,glob
evs=[]
for f in glob.glob('*.trace'):
    for line in open(f):
        try: e=json.loads(line)
        except: continue
        if e.get('type')=='before': evs.append((e['startTime'],e.get('apiName'),json.dumps(e.get('params',{}))[:120]))
        elif e.get('type')=='after' and e.get('error'): evs.append((e['endTime'],'ERROR',e['error'].get('message','')[:100]))
evs.sort(); t0=evs[0][0]
for t,a,p in evs: print(f"{(t-t0)/1000:7.1f}s {a} {p}")
EOF
```

## 4. Failure → fix table

| Symptom (log / error-context) | Root cause | Fix |
|-------------------------------|------------|-----|
| `strict mode violation … 2 elements`: `A` and `No A`, or your number inside a longer one | name is a prefix/substring | `exact: true` |
| `strict mode violation`, both elements are the same visible text (`<div>` + `<span>`) | duplicated rendering | `.first()` + comment |
| `strict mode violation` on `getByPlaceholder`: a custom-element host and its inner `<input>` | host mirrors the placeholder | `page.locator('#<host id>').getByRole('textbox')` |
| `<some-overlay-host> intercepts pointer events` on the first clicks after login | announcement overlay still animating | make `openLandingPage`/`dismissOverlays` wait for that host to be hidden before the spec continues |
| `waiting for getByRole('dialog').getByRole('button', …)` though the button is on screen | slotted button is not inside the `dialog` node | remove the `getByRole('dialog')` scope |
| `<card-host> intercepts pointer events` / `element is not visible` on an inner `<a>` | clicked text/anchor inside a web component | click the host element (`<tag>[attr*="…"]`) or the row (`filter({ hasText })`) |
| `Timeout … click` on a `radio`/`checkbox` input | chip input covered by label | click the label text, or `label[for=<id>]` |
| `toBeVisible()` fails on a menu heading right after `goBack()`/Back link | trigger re-rendered, click hit a stale node | use the retrying `openMenu` helper |
| `toContainText` received only whitespace | text in nested shadow roots, empty `textContent` | drop the text check; assert visibility and resulting URL |
| `getByText(/^…$/)` not found while the text is in error-context | bare text node shares its parent with other nodes | unanchor the regex |
| `page.waitForEvent: Timeout … "popup"` | slow server-generated document / click missed | use `expectPopupFrom` (30 s, then re-click with 60 s) |
| waits 300 000 ms for a heading, error-context shows the **login page** | session logged out mid-run (another session was open) or user did not finish 2FA | close other sessions/browsers, re-run, remind the user |
| hangs ~20 s after a Print button | native dialog | `stubPrint(page)` before `goto`, assert with `expectPrintCalled` |
| passes once, fails later on a price/date/amount | live data | structural assertions only (headings, columns, known names, count comparisons) |
| `TimeoutError` on the first step, error-context shows the login page | user took longer than the manual timeout | re-run; raise `MANUAL_STEP_TIMEOUT` if the user needs more time |
| control not found but it exists on another page | action bar exists only on the parent page | navigate back before using it (mirror what was done when recording) |

## 5. Iterate

After each fix: `npx playwright test --list` (compile), then step 2 again. Ask the user to log in again each time. Keep a short list of fixes applied for the final summary.

## 6. Done criteria

- `1 passed` in `/tmp/replay.log`.
- No `.only`, no hard-coded snapshot refs, no credentials.
- Site cookbook updated with any new locator learned while fixing.
- Final summary: sections covered, fixes made during replay, caveats (manual login, 2FA, live data, single session).
