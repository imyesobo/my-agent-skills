---
name: intake-figma
description: Read a Figma design (layout, styles, variables/tokens, components, images, comments) and its Code Connect mappings using the Figma REST API and Code Connect CLI, without the Figma MCP. Use when given a figma.com URL or when implementing UI from a Figma design.
license: MIT
metadata:
  phase: intake
---

# Figma Skill (REST API + Code Connect, no MCP)

Figma has **no official general-purpose CLI** for reading designs. Use the REST API
(`https://api.figma.com`) through `scripts/figma.js` (Node ≥18, zero dependencies). The only
official CLI is **`@figma/code-connect`** (`npx figma connect ...`), used for Code Connect.

## Credentials

Resolution order in the script:
1. `FIGMA_TOKEN` — Personal Access Token, sent as `X-Figma-Token` (preferred).
2. `FIGMA_OAUTH_TOKEN` — OAuth2 access token, sent as `Authorization: Bearer`.

Create a PAT: Figma → avatar → **Settings → Security → Personal access tokens → Generate new token**.
Minimum scopes for this skill: `file_content:read`, `file_metadata:read`,
`library_content:read`, `file_comments:read`, `file_dev_resources:read`,
`file_versions:read`, plus `library_assets:read`/`team_library_content:read` for team libraries and
`file_variables:read` for variables (Variables REST API requires an **Enterprise** plan).
Code Connect publishing needs `code_connect:write`. Tokens expire (max 90 days) — a `401` means regenerate.

Handling rules (important for agents):
- Keep the token in an env var or secret manager (`export FIGMA_TOKEN=...`, direnv `.envrc`, a
  git-ignored `.env`, or CI secrets). **Never** put it in code, commits, logs, command-line
  arguments, or chat. Never `echo` it.
- If it is missing, **stop and ask the user** to set it; do not search the disk for tokens.
- Verify with `node scripts/figma.js me` (prints user email/handle, not the token).
- The account behind the token must be able to open the file; `403/404` usually means no access.

## Workflow

Given a URL like `https://www.figma.com/design/<FILE_KEY>/Name?node-id=12-34`
(the script parses key and `node-id`, converting `12-34` → `12:34`):

1. `node scripts/figma.js me` — validate credentials.
2. `node scripts/figma.js outline "<url>" --depth 3` — cheap structural overview (ids + names).
3. `node scripts/figma.js nodes "<url>" --ids 12:34` — full detail for the target frame(s):
   auto layout, constraints, fills, strokes, effects, text styles, `componentId`,
   `boundVariables`, `styles` references. Add `--depth N` for large frames and request subtrees
   instead of the whole file (files can be tens of MB and are rate limited).
4. `node scripts/figma.js images "<url>" --ids 12:34 --format png --scale 2` — rendered image
   URLs (expire in ~30 days); download with `curl -o`. Use `--format svg` for icons.
   `image-fills` lists URLs of bitmaps used as fills.
5. `node scripts/figma.js components "<url>"` and `variables "<url>"` — component/style
   catalogue and design tokens (resolve `boundVariables` ids against variables output;
   modes give theme values like light/dark).
6. `node scripts/figma.js comments "<url>"` / `dev-resources "<url>"` — designer notes and
   linked code/tickets.
7. Check Code Connect (below) before generating new components.

Other: `file`, `versions`, `team-components <team_id>`, `raw /v1/...` for any GET endpoint.
Run `node scripts/figma.js --help` for all options.

### Reading the node JSON
- Node types: `FRAME`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `TEXT`, `RECTANGLE`, `VECTOR`, `GROUP`...
- Layout: `layoutMode` (HORIZONTAL/VERTICAL), `itemSpacing`, `padding*`,
  `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutSizingHorizontal/Vertical`
  (FIXED/HUG/FILL), `absoluteBoundingBox`.
- Colors are 0–1 floats `{r,g,b,a}` → multiply by 255 for hex/rgb.
- Text: `characters`, `style` (fontFamily, fontSize, fontWeight, lineHeightPx, letterSpacing).
- Instances: `componentId` → look up in `components` output (`name`, `key`, `componentSetId`);
  `componentProperties` hold variant/boolean/text values.
- Prefer tokens (`boundVariables`, `styles`) over raw values when the codebase has tokens.

### API limits
Rate limits are per token and plan; a `429` includes `Retry-After`. Avoid whole-file fetches,
batch node ids (comma-separated), and cache outputs in a temp file rather than refetching.

## Code Connect

Code Connect maps Figma components to real code components so generated code reuses them.
Mappings live in **your repo** (`*.figma.tsx`, `*.figma.ts`, `*.figma.swift`, `*.figma.kt`, or
`*.figma.template.js`) and are published to Figma (shown in Dev Mode). Config: `figma.config.json`.

Find mappings locally (no API needed):
```bash
node scripts/figma.js code-connect .        # files + the Figma URLs they point to
```
A mapping looks like:
```tsx
import figma from '@figma/code-connect'
figma.connect(Button, 'https://www.figma.com/design/<KEY>/X?node-id=1-2', {
  props: { label: figma.string('Label'), kind: figma.enum('Type', { Primary: 'primary' }) },
  example: ({ label, kind }) => <Button kind={kind}>{label}</Button>,
})
```
To use it: match the Figma node (or its `componentId` → component key / `componentSetId`)
to a mapping URL's `node-id`, then emit that code component with the mapped props instead of
re-creating markup. If a node has no mapping, check `dev-resources` and then the repo's
component library by name.

Code Connect CLI (needs Node and `FIGMA_ACCESS_TOKEN` env var — the CLI uses this name; set it
from `FIGMA_TOKEN` in the shell, e.g. `FIGMA_ACCESS_TOKEN="$FIGMA_TOKEN" npx figma connect ...`):
```bash
npm i -D @figma/code-connect
npx figma connect create "<figma-component-url>"   # scaffold a mapping file
npx figma connect parse                            # validate locally, prints resulting JSON
npx figma connect publish                          # publish (needs code_connect:write, Org/Enterprise)
npx figma connect unpublish
```
Publishing changes shared state: only run `publish`/`unpublish` when the user asks.
Published mappings appear in the file's Dev Mode and as Dev Resources; there is no
documented public REST endpoint to list them, so rely on local `.figma.*` files first.

## Troubleshooting
- `no credentials` → set `FIGMA_TOKEN`. `401` → expired/invalid. `403` → missing scope or no file access
  (variables also need Enterprise). `404` → wrong key/node id; the `node-id` in URLs uses `-`, the API uses `:`.
- Huge output → use `outline`, `--depth`, and specific `--ids`.
- Do not modify the design: this skill is read-only (GET requests only).
