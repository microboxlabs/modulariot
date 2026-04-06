---
name: coderabbit-pr-review
description: >
  Review the current pull request against CodeRabbitAI comments and fix valid issues.
  Fetches inline review comments left by coderabbitai[bot], validates each against the actual code,
  and applies fixes for valid issues. Use when the user asks to fix CodeRabbit comments, address
  CodeRabbit review, process CodeRabbit suggestions, or review/fix AI review comments on the PR.
---

# CodeRabbitAI PR Review and Fix

Review the current branch's PR for CodeRabbitAI inline comments and fix all valid issues.

## Prerequisites

- **`gh` CLI** must be authenticated (`gh auth status`). No additional tokens required.

## Workflow

### 1. Fetch CodeRabbitAI comments

Auto-detect the PR number, then fetch all inline review comments from the bot:

```bash
PR_NUMBER=$(gh pr view --json number -q '.number')

gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/comments" \
  --paginate \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]") | {id, path, line, start_line, body, diff_hunk, created_at, pull_request_review_id}]'
```

If `gh pr view` fails (no PR for this branch), ask the user for the PR number or use `-p <number>`.

If no comments are returned, report "No CodeRabbitAI comments found on this PR" and stop.

### 2. Parse each comment

Each comment body follows a structured format. Extract these fields:

| Field | How to extract |
|-------|---------------|
| **Severity** | First line: `_🟠 Major_` or `_🟡 Minor_` |
| **Title** | First `**...**` bold text after severity |
| **Explanation** | Text between title and first `<details>` block |
| **File** | `path` field from API response |
| **Line** | `line` field (end line); `start_line` if range |
| **Suggested fix** | Content inside `<details><summary>Suggested fix</summary>` |
| **AI agent prompt** | Content inside `<details><summary>🤖 Prompt for AI Agents</summary>` |

The **AI agent prompt** is specifically designed for LLM consumption and is the **primary guide** for fixes.

For parsing details, see [reference.md](reference.md).

### 3. Group by file and plan fixes

- Group parsed comments by **File** path.
- Within each file, order by **Line** number (ascending) so edits applied top-to-bottom keep line numbers valid.
- Read each referenced file to prepare for validation.

### 4. Validate and apply fixes

For each comment, in file-then-line order:

1. **Read the actual code** at the referenced file and line range.
2. **Evaluate validity**:
   - Is the code actually doing what CodeRabbit claims?
   - Does the suggestion align with existing project patterns?
   - Is this a meaningful improvement or just a style preference?
   - Would the fix introduce regressions?
   - Has the code already been changed since the comment was posted?
3. **If valid**: Apply the fix using the **AI agent prompt** as primary guide, cross-referencing the **suggested fix** diff. Make minimal changes. Preserve existing style.
4. **If invalid**: Skip it. Record the comment title and a one-line reason (e.g., "CodeRabbit misread context", "style preference conflicting with project convention", "code already fixed").

After editing a file, re-read affected regions to ensure no new issues (broken imports, syntax errors).

### 5. Verify

- Type-check changed files: `npx tsc --noEmit`
- Run tests for affected modules if available (e.g., `npx vitest run <path>`)

### 6. Report summary

After all comments are processed, report:

- **Fixed** (count): Comment title and file, one line each.
- **Skipped** (count): Comment title, file, and one-line reason.
- Reminder to review changes and run the full test suite.

## Severity guidance

| Marker | Level | Action |
|--------|-------|--------|
| 🟠 Major | Likely bug, security, or correctness issue | Prioritize fixing |
| 🟡 Minor | Code smell, missing edge case, improvement | Validate carefully — higher false-positive rate |

## Important guidelines

- **Never blindly apply all suggestions.** Always validate against the actual code.
- **Prefer the AI agent prompt** over the suggested diff when they conflict.
- **One logical edit per fix.** Do not combine multiple fixes into a single edit.
- **Preserve project style.** Do not change formatting or patterns beyond what the fix requires.
- **Watch for stale comments.** If the code has changed since the comment, skip with a note.

For the full comment schema and edge cases, see [reference.md](reference.md).
