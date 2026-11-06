---
name: intake-azure-devops
description: Retrieve Azure DevOps work item information, including details, relations, history, and linked items. Use when analyzing a work item before implementation or debugging Azure DevOps state.
license: MIT
metadata:
  phase: intake
---

# Azure DevOps Skill

## Overview

This skill provides scripts to retrieve comprehensive information about Azure DevOps (ADO) work items. It is designed for agents that need to analyze work item content, dependencies, history, and related data before implementing features or fixes.

## Prerequisites

**Authentication via Azure CLI bearer token or a Personal Access Token (PAT).**

The scripts resolve credentials like this:
1. `AZURE_DEVOPS_EXT_PAT` environment variable (preferred if set)
2. `ADO_TOKEN` environment variable
3. Azure CLI bearer token — `az account get-access-token --scope https://app.vssps.visualstudio.com/.default` (requires `az login`)

> **Note:** Azure CLI bearer tokens **do** work against `dev.azure.com/_apis/...` endpoints when the correct scope (`https://app.vssps.visualstudio.com/.default`) is requested — no PAT needed if you're logged in with `az login`. A PAT is the fallback when Azure CLI is unavailable.

### Setting up a PAT

Generate one with sufficient scopes:
```bash
# From Azure DevOps portal:
#  1. https://dev.azure.com/<org>/_usersSettings/tokens
#  2. Click "New Token"
#  3. Scopes: `vso.WorkItemFull + vso.Read` (minimum for all scripts)
#  4. Copy the PAT and export it:
export AZURE_DEVOPS_EXT_PAT=your_pat_here
```

Or use GitHub CLI to set up persistent credentials:
```bash
git config --global credential.helper store
gh auth login --git-protocol https
```

## Available Scripts

### `scripts/get-workitem.js` - Retrieve Work Item Details

Retrieve all information about a single work item, including fields, relations, iterations, tags, and state history.

**Usage:**
```bash
node scripts/get-workitem.js <org_name> <project_name> <workitem_id> [-f FIELD_NAMES]
```

**Arguments:**
- `org_name` - Azure DevOps organization name (e.g., `my-org`)
- `project_name` - Project name (e.g., `MyProject`)
- `workitem_id` - Work item ID (numeric, e.g., `12345`)

**Optional flags:**
- `-f field1,field2,...` - Comma-separated list of specific fields to retrieve (omit for all fields)
- `-t format` - Output format: `json` (default), `markdown`, or `compact`
- `-w DIR` - Custom download directory for files and images (defaults to `.attachments/{org}_{project}_{id}`)
- `--download-all` or `-e` - Download all file attachments AND embedded screenshots from the Description field
- `-r N` - Number of revisions/history entries to include (default: 3)

**Examples:**
```bash
# Basic work item details (JSON)
node scripts/get-workitem.js my-org MyProject 12345

# Select specific fields
node scripts/get-workitem.js my-org MyProject 12345 -f System.Title,System.Description,System.State,System.Tags

# Markdown output for human readability
node scripts/get-workitem.js my-org MyProject 12345 -t markdown

# Download file attachments + embedded screenshots
export AZURE_DEVOPS_EXT_PAT="your-pat-here"
node scripts/get-workitem.js my-org MyProject 12345 --download-all

# Custom download directory
node scripts/get-workitem.js my-org MyProject 12345 --download-all -w ./my-saved-attachments
```

**Output:**
- **`json`** (default): Structured JSON with id, title, state, priority, areaPath, iterationPath, assignedTo, priority, all field values (`fieldValues`), relations, and timestamps. When `--download-all` is used, the output also includes `downloadedFiles` and `extractedImages` arrays.
- **`markdown`**: Formatted summary with sections for Title, State, Priority, Assigned to, Fields (truncated to 500 chars each), Relations/Links, Tags, downloaded files, extracted images, Created Date, Updated Date. When `--download-all` is used, additional `### Downloaded Files` and `### Extracted Images` subsections show file sizes and save paths.
- **`compact`**: One-line summary: `[id] [title] [state]`

**Attachment download behavior (`--download-all`):**
1. **File attachments**: Downloads all files attached via ADO's upload mechanism to `<download-dir>/<filename>`
2. **Embedded screenshots**: Searches the `System.Description` rich-text field for `<img src="...">` tags, resolves relative URLs to absolute dev.azure.com paths, and saves as `img_1.png`, `img_2.png`, etc.
3. Progress messages are output to stderr; results (including byte sizes) appear in both stderr and JSON/markdown output

### `scripts/check-workitem-state.js` - Verify Work Item State

Check if a work item is in an expected state. Useful as a pre-condition check before making changes.

**Usage:**
```bash
node scripts/check-workitem-state.js <org_name> <project_name> <workitem_id> --state ExpectedStateName
```

**Optional flags:**
- `--state StateName` - Required: the expected state (e.g., "Active", "Closed", "Done")
- `--json` - Output as JSON with pass/fail result

**Exit codes** — always reflect the check result, so this script works as a pre-condition gate:
- `0` - work item IS in the expected state
- `1` - work item is NOT in the expected state, or an error occurred (auth failure, network, 404, etc.)

On any error the script prints the HTTP status **and the server's error body** to stderr (e.g. a `TF401232: Work item ... does not exist` message), rather than a bare status code.

**Example:**
```bash
node scripts/check-workitem-state.js my-org myproject 42 --state Active --json
# Gate a following step on the state check:
node scripts/check-workitem-state.js my-org myproject 42 --state "To Do" && echo "ready to implement"
```

### `scripts/list-linked-items.js` - List Linked Work Items

Retrieve all linked work items for a given work item, grouped by relation type.

**Usage:**
```bash
node scripts/list-linked-items.js <org_name> <project_name> <workitem_id> [-t format] [-r relationType]
```

**Example:**
```bash
node scripts/list-linked-items.js my-org MyProject 12345 -t compact
node scripts/list-linked-items.js my-org MyProject 12345 -r "System.LinkTypes.Hierarchy-Forward"
```

## Workflow Example

1. **Analyze a work item before implementation:**
   ```bash
   node scripts/get-workitem.js myorg myproject 42 -t markdown
   ```

2. **Check linked items for dependencies:**
   ```bash
   node scripts/list-linked-items.js myorg myproject 42
   ```

3. **Verify the work item is still Active (not Closed):**
   ```bash
   node scripts/check-workitem-state.js myorg myproject 42 --state "Active" --json
   ```
   This returns `{"passed": true|false, "current": "<state>", "expected": "Active"}` and exits `0` when passed, `1` when not (or on error). If `passed` is `false`, handle accordingly (e.g., check if someone has already implemented the fix).

## Script Reference

| Script | Purpose |
|--------|---------|
| `get-workitem.js` | Main script - retrieve complete work item details and history |
| `check-workitem-state.js` | Check if a work item is in an expected state (exit code = pass/fail) |
| `list-linked-items.js` | List all linked/related work items (prints a clear "no linked items" message when none exist) |
| `ado-client.js` | Shared module - auth, `api-version`, and JSON fetch used by all three scripts above |

All scripts output machine-readable data suitable for further processing. They share a single `api-version` (currently `6.0`) and surface the server's error body on failure, so a `404` shows *why* rather than a bare status code.
