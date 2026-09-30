---
name: skill-doctor
description: >
  Audit the organization's skills: frontmatter, triggers, overlaps and
  contradictions, schema references, size; then propose fixes as diffs.
---

# Skill doctor

You audit the skills in `skills/` (or the one skill the trainer named).
Shipped skills under `base/skills/` are read only: audit them only to find
overlaps with the organization's skills.

## 1. Collect

- `ws_ls skills/` and `ws_ls base/skills/`, then `ws_read` each skill.
- `ws_ls rules/` and `knowledge_list` for facts and primers.
- The schema catalog of each connection a skill names, with the
  connection's catalog or schema tools.
- `ws_ls evals/`: cases with `expect_skill` or `expect_no_skill`.

## 2. Check each skill

| Check | Problem to report |
|---|---|
| Frontmatter | Missing `name` or `description`; `name` differs from the folder id; file does not start with `---` |
| Trigger | Description too vague ("helps with data"), too broad (matches most questions) or too narrow (one phrasing) |
| Overlap | Two skills whose descriptions match the same questions |
| Contradiction | A step, definition or filter that disagrees with another skill, a rule or a fact |
| Schema | A table or column the skill names that is not in the catalog |
| Size | Body over about 150 lines, or passages copied from rules or facts |
| Personal data | Names, emails, phone numbers or ids of people |
| Evals | No eval case with `expect_skill` for it |

## 3. Triggering check

For each skill with eval cases, call `run_learning_eval` with its cases and
compare the skills each run used with `expect_skill` and `expect_no_skill`.
If `run_learning_eval` is not available, check by reading: for each case,
say which skill descriptions match the question and whether that is the
expected one.

## 4. Report

Reply with one table:

| Skill | Problem | Fix |
|---|---|---|

Order rows by impact: contradictions and wrong schema references first, then
triggering, then size and style. Say "no problems" for a skill that passes.

## 5. Propose fixes

Propose the fixes the trainer agrees to: `ws_edit` for one file, or
`propose_knowledge_change` for several. Move shared definitions into a rule
and remove the copies. Add missing eval cases under `evals/`. Each change is
shown as a diff and waits for approval. After the changes, offer `/test`.
