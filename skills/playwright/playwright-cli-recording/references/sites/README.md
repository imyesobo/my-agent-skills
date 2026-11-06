# Site cookbooks

Kept in the project you are recording against, one file per host: `tests/site-cookbooks/<host>.md` (e.g. `tests/site-cookbooks/shop.example.com.md`). Read it before recording on that site; append to it whenever a locator needed a workaround.

Suggested sections (tables, one row per control):

1. **Global** — login URL(s), logged-in landing URL, welcome/announcement dialogs and how to dismiss them, session restrictions (single session? storageState restorable?), re-authentication / 2FA pages, native dialogs (print), the per-site helpers file under `tests/helpers/`.
2. **One section per page/area** — URL pattern (hash routes included), key headings, tabs, actions, and for each control that was not clickable the obvious way: the locator that worked and why.
3. **Gotchas** — things that re-render after navigation, labels that exist twice, text nodes with empty `textContent`, slow popups/downloads.

Keep entries factual and copy-pasteable (`getByRole('button', { name: 'X', exact: true })`), and date the verification.

## Template for a new cookbook

```markdown
# Site cookbook — <host>

Per-site notes for the `playwright-cli-recording` skill. Helpers: `tests/helpers/<site>.ts`. Specs: `tests/<name>.spec.ts`.
Verified against https://<host> (<month year>). <One line on the tech: web components / shadow DOM / SPA hash routes…>

## Global

| What | Locator / fact |
|------|----------------|
| Login page | URL `…`; heading "…". **User logs in.** |
| Logged-in landing | URL `…`, heading "…" |
| Welcome/announcement dialog | `getByRole('button', { name: 'Close' })` (not scoped to `dialog`); host `<tag>` intercepts clicks until hidden |
| Session | restorable from storageState? single session? |
| Re-authentication / 2FA | heading "…" — user approves |
| Native dialogs | `button "Print"` calls `window.print()` → stub |

## <Page or area> (`<url pattern>`)

| What | Locator |
|------|---------|
| Heading | `heading "…" level 1` |
| <control that needed a workaround> | `<locator>` — <why> |

## Gotchas

- <re-rendering header → retry menu opener>
- <label text exists twice → label[for=id]>
```

Existing cookbooks: none in this plugin — the recording skill creates one in the tested project's `tests/site-cookbooks/` the first time you record on a site.
