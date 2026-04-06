---
name: gh-issue-writer
description: >
  Create and publish GitHub issues with full project board integration.
  Use when the user wants to create a feature request (feat:), bug report (bug:),
  or any tracked issue from a PR or description. Handles issue creation, project
  board association, status setting, and development branch checkout. Also use
  when the user says "create an issue", "write an issue for this PR",
  "track this work", or provides a PR URL to turn into an issue.
---

# GitHub Issue Writer

Create GitHub issues with project board integration and development branch setup.

## Workflow

1. Parse input (type + description or PR URL)
2. Create the issue via `gh issue create`
3. Add issue to project board and capture item ID
4. Set project status
5. Create and checkout development branch

## Step 1: Parse Input

Determine issue type from prefix or context:

- `feat:` → label `enhancement`
- `bug:` → label `bug`
- PR URL → inspect the PR with `gh pr view <url> --json title,body,labels` and derive type + description

Extract a concise title and body from the user input or PR.

## Step 2: Create the Issue

Load config and publish:

```bash
source .env.local

gh issue create \
  --repo "$GH_ISSUE_REPO" \
  --title "<title>" \
  --body "<body>" \
  --label "<labels>"
```

Capture the issue number from the output.

## Step 3: Add to Project Board

```bash
source .env.local

ITEM_ID=$(gh project item-add "$GH_PROJECT_NUMBER" \
  --owner "$GH_PROJECT_OWNER" \
  --url "https://github.com/$GH_ISSUE_REPO/issues/<ISSUE_NUMBER>" \
  --format json | jq -r '.id')
```

## Step 4: Set Project Status

```bash
source .env.local

# If files are already modified locally → "In Progress"
gh project item-edit \
  --project-id "$GH_PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$GH_STATUS_FIELD_ID" \
  --single-select-option-id "$GH_STATUS_IN_PROGRESS"

# Otherwise → "Ready for Development"
gh project item-edit \
  --project-id "$GH_PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$GH_STATUS_FIELD_ID" \
  --single-select-option-id "$GH_STATUS_READY_FOR_DEV"
```

## Step 5: Create Development Branch

```bash
source .env.local

gh issue develop <ISSUE_NUMBER> \
  --repo "$GH_ISSUE_REPO" \
  --branch-repo "$GH_ISSUE_REPO" \
  --base trunk \
  --name "based/<ISSUE_NUMBER>-<short-name>" \
  --checkout
```

Branch naming: `based/<issue-number>-<3-4-word-slug>`

If `--checkout` fails due to local changes:

```bash
git fetch origin && git checkout "based/<ISSUE_NUMBER>-<short-name>"
```

## Environment Variables

All values are read from `.env.local` (not committed to git):

| Variable | Example | Purpose |
|---|---|---|
| `GH_PROJECT_OWNER` | `microboxlabs` | Org or user |
| `GH_ISSUE_REPO` | `microboxlabs/modulariot` | Target repo |
| `GH_PROJECT_NUMBER` | `4` | Project board number |
| `GH_PROJECT_ID` | `PVT_...` | Project node ID |
| `GH_STATUS_FIELD_ID` | `PVTSSF_...` | Status field ID |
| `GH_STATUS_BACKLOG` | option ID | Backlog status |
| `GH_STATUS_READY_FOR_DEV` | option ID | Ready for Dev status |
| `GH_STATUS_IN_PROGRESS` | option ID | In Progress status |
| `GH_STATUS_IN_REVIEW` | option ID | In Review status |
| `GH_STATUS_DONE` | option ID | Done status |

To discover these values:

```bash
source .env.local
gh project list --owner "$GH_PROJECT_OWNER" --format json | jq '.projects[] | select(.number == <N>)'
gh project field-list <N> --owner "$GH_PROJECT_OWNER" --format json
```
