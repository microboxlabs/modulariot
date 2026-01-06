---
name: gh-issue-writer
description: Create and publish GitHub issues with full project board integration. Use when the user wants to create feature requests (feat:) or bug reports (bug:), track work in GitHub Projects, and set up development branches.
---

# GitHub Issue Writer

Create and publish GitHub issues for the bubo project with full project board integration.

## When to Use

Use this skill when the user wants to:

- Create a new feature request (input starts with `feat:`)
- Report a bug (input starts with `bug:`)
- Track work in the Modular IoT project board

## Instructions

### Step 1: Parse User Input

1. Determine issue type from prefix:
- `feat:` → Feature request
- `bug:` → Bug report
2. Extract the brief description and additional context

### Step 2: Create the Issue

Publish the issue directly to the repository specified in `$GH_ISSUE_REPO` using `gh` CLI or GitHub MCP tools.

**Required fields:**

- **Title**: Concise, descriptive title based on user input
- **Labels**: Appropriate labels (e.g., `enhancement`, `bug`, `bubo`, `cli`, `github-integration`)
- **Body**: Fill in all template sections with relevant details

### Step 3: Associate Issue to Project and Capture Item ID

Read project configuration from `.env.local` file, add the issue to the project, and capture the project item ID in one step:

```bash
source .env.local

# Add to project and capture item ID (more efficient than querying all items)
ITEM_ID=$(gh project item-add $GH_PROJECT_NUMBER \
  --owner $GH_PROJECT_OWNER \
  --url "https://github.com/$GH_ISSUE_REPO/issues/<ISSUE_NUMBER>" \
  --format json | jq -r '.id')

echo "Project Item ID: $ITEM_ID"
```

### Step 4: Set Project Status

Set the status using the captured item ID:

```bash
source .env.local

# Set status based on context:
# If files are already modified → "In Progress"
gh project item-edit --project-id $GH_PROJECT_ID --id "$ITEM_ID" --field-id $GH_STATUS_FIELD_ID --single-select-option-id $GH_STATUS_IN_PROGRESS

# Otherwise → "Ready for Development"
gh project item-edit --project-id $GH_PROJECT_ID --id "$ITEM_ID" --field-id $GH_STATUS_FIELD_ID --single-select-option-id $GH_STATUS_READY_FOR_DEV
```

### Step 5: Create Development Branch

First identify the current repository with `git remote -v`, then create a linked branch:

```bash
source .env.local

gh issue develop <ISSUE_NUMBER> \
  --repo $GH_ISSUE_REPO \
  --branch-repo $GH_ISSUE_REPO \
  --base trunk \
  --name based/<ISSUE_NUMBER>-<short-name> \
  --checkout
```

**Branch naming:**

- Base branch: `trunk`
- Format: `based/<issue-id>-<short-name>`
- Short name: 3-4 words max, descriptive of the feature/fix

If `--checkout` fails due to local changes:

```bash
git fetch origin && git checkout based/<ISSUE_NUMBER>-<short-name>
```

## Required Environment Variables

These values must be set in the `.env.local` file (not committed to git):

```bash
# GitHub Organization/Repository
GH_PROJECT_OWNER=         # Organization or user (e.g., microboxlabs)
GH_ISSUE_REPO=            # Repository for issues (e.g., owner/repo)

# GitHub Project Configuration
GH_PROJECT_NUMBER=        # Project number (e.g., 4)
GH_PROJECT_ID=            # Project ID (starts with PVT_)
GH_STATUS_FIELD_ID=       # Status field ID (starts with PVTSSF_)

# Status Option IDs
GH_STATUS_BACKLOG=
GH_STATUS_READY_FOR_DEV=
GH_STATUS_IN_PROGRESS=
GH_STATUS_IN_REVIEW=
GH_STATUS_DONE=
```

To find these values, use:

```bash
source .env.local

# Get project ID
gh project list --owner $GH_PROJECT_OWNER --format json | jq '.projects[] | select(.number == <NUMBER>)'

# Get field IDs and option IDs
gh project field-list <PROJECT_NUMBER> --owner $GH_PROJECT_OWNER --format json
```

## Project Context

When writing issues, understand that bubo is:

- An enterprise AI coding agent with deep GitHub integration
- Automates software development workflows using Claude Code
- Built with TypeScript (strict mode), ESM modules, Node.js 20+
- Uses pnpm exclusively (never npm or yarn)
- Uses Zod for runtime validation of external data
- GitHub-native workflow: Issues, Projects v2, Pull Requests
- Can run as CLI, GitHub Action, or webhook service

**Code structure:**

- `cli/` - Command-line interface and commands
- `core/` - Core business logic and orchestration
- `types/` - TypeScript type definitions
- `utils/` - Shared utilities and helpers

**Relevant labels:**

- `bubo` - Triggers Bubo to work on this issue
- `bubo:in-progress` - Bubo is currently working on this
- `bubo:blocked` - Bubo encountered an issue and needs help
- `bubo:complete` - Bubo has completed the task
- `enhancement` - Feature requests
- `bug` - Bug reports

