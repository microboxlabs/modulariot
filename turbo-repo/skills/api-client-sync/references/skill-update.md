# Agent Skill Update Conventions (Layer 3)

## When to update which file

| Change | Update |
|---|---|
| New endpoint | `SKILL.md` Common Workflows + `references/reference.md` (TOC + new section) |
| New irreversible operation | Business rule in both `SKILL.md` and `references/reference.md` |
| New flag | Flag table in the relevant command section of `references/reference.md` |
| New response field | JSON output example in `references/reference.md` |

## SKILL.md workflow template

Add under `## Common Workflows`:

```markdown
### "Do X"

1. Step one.
2. Step two:
   ```
   miot calendar xxx <id> --output json
   ```
> ⚠️ Note irreversibility warning if applicable.
```

## `references/reference.md` — new command section

Add the new command to the TOC at the top of `reference.md`, then add its full section:

```markdown
## miot calendar xxx

`miot calendar xxx <id>`

One-sentence description.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--flag <val>` | string | yes | Description |

**JSON output:**
```json
{ "success": true }
```

---
```

## Business rule format

Add under `## Business Rules` in `SKILL.md`:

```
- `calendar xxx` is **irreversible** — describe consequences. Always confirm with user before running.
```

## Commit convention

Skills are committed directly to `trunk` (no package version bump — skills are not npm packages).

Message format:

```
feat(skills): update miot-calendar skill for <feature>

- Add <workflow> workflow
- Add <command> to reference.md
- Add business rule for <constraint>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
