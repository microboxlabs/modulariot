# CodeRabbitAI PR Review — Reference

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /repos/{owner}/{repo}/pulls/{pr}/comments` | Inline review comments (file-level, with line numbers) |
| `GET /repos/{owner}/{repo}/issues/{pr}/comments` | Issue-level comments (walkthrough/summary — not actionable) |

Only the **pulls comments** endpoint returns actionable inline review comments with file paths and line numbers.

## Fetching comments

```bash
# Auto-detect PR number
PR_NUMBER=$(gh pr view --json number -q '.number')

# Fetch all CodeRabbitAI inline comments (paginated)
gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/comments" \
  --paginate \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]") | {id, path, line, start_line, body, diff_hunk, created_at, pull_request_review_id}]'
```

## API response fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Comment ID |
| `path` | string | File path relative to repo root |
| `line` | number | End line of the comment in the diff |
| `start_line` | number or null | Start line if the comment spans a range |
| `diff_hunk` | string | Diff context around the commented line |
| `body` | string | Full comment body (Markdown) |
| `user.login` | string | `coderabbitai[bot]` after filtering |
| `pull_request_review_id` | number | Review ID this comment belongs to |
| `created_at` | string | ISO timestamp |

## Comment body structure

Typical CodeRabbitAI inline comment:

```markdown
_⚠️ Potential issue_ | _🟠 Major_

**Title of the issue**

Explanation paragraph describing what is wrong and why.

<details>
<summary>Suggested fix</summary>

​```diff
- old code
+ new code
​```

</details>

<details>
<summary>🤖 Prompt for AI Agents</summary>

In `path/to/file.ts` at line N, do X because Y.

</details>

<!-- coderabbit:fingerprint:... -->
```

## Severity levels

| Marker | Level | Meaning |
|--------|-------|---------|
| `_🟠 Major_` | Major | Bugs, security issues, correctness problems |
| `_🟡 Minor_` | Minor | Code smells, missing edge cases, improvements |
| `_💡 Suggestion_` | Suggestion | Optional improvement, lowest priority |

## Parsing guidance

1. **Severity**: Match `_🟠 Major_` or `_🟡 Minor_` in the first line.
2. **Title**: First `**...**` bold text after the severity line.
3. **Explanation**: All text between the title and the first `<details>` block.
4. **Suggested fix**: Content between `<details><summary>Suggested fix</summary>` and its closing `</details>`. Uses unified diff format.
5. **AI agent prompt**: Content between `<details><summary>🤖 Prompt for AI Agents</summary>` and its closing `</details>`. Plain text with explicit instructions.
6. **Fingerprint**: HTML comment `<!-- coderabbit:fingerprint:... -->` — ignore.

Not all comments have every section. When the AI agent prompt is missing, use the explanation and suggested fix diff.

## Edge cases

- **Multi-line comments**: When `start_line` is not null, the comment spans from `start_line` to `line`. Read the full range.
- **Outdated comments**: If the file has been modified since the comment, the `diff_hunk` won't match current code. Skip these.
- **Threaded replies**: CodeRabbitAI may reply to its own comments. Deduplicate by `path` + `line` or filter by `pull_request_review_id`.
- **No inline comments**: The bot may only post a summary on the issues endpoint. Report no actionable comments found.
