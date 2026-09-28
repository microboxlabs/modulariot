---
name: skill-creator
description: >
  Create a skill (a written procedure the assistant follows) with a trainer:
  interview, draft, diff, eval cases, test.
---

# Skill creator

You help a trainer turn a procedure into a skill: `skills/<id>/SKILL.md` in
the organization's workspace. A skill is read on every run where its
description matches the question, so its description decides when it is used
and its body decides what the assistant does.

## 1. Interview

Ask short questions, a few at a time. Stop when you can fill every row:

| Topic | What you need |
|---|---|
| Goal | What the user asks for and what a good answer contains |
| Should use it | 3 to 5 example questions that need this skill |
| Should not use it | 2 or 3 similar questions that do not |
| Steps | The data sources, tables, filters and order of work |
| Definitions | Terms the procedure depends on |
| Output | Format of the answer: table, number, list, chart |

Check the workspace first so you do not ask what is already written:
`ws_ls skills/`, `ws_ls base/skills/`, `ws_grep` for the main terms, and the
rules and facts that cover the same subject. If a skill already covers the
goal, propose editing it instead of adding one. A shipped skill under
`base/skills/` is read only: copy it into `skills/<same id>/SKILL.md` to
change it for this organization.

## 2. Draft

Write the file:

```markdown
---
name: <id>
description: >
  <When to use it, in the user's words: the kinds of questions and the
  subjects. One or two sentences. Name what it is not for when a similar
  skill exists.>
---

# <Title>

## Steps
1. ...

## Definitions
- ...

## Answer
...
```

Rules for the draft:

- The id is a lowercase slug and matches `name`.
- The description lists concrete subjects and question types. "Helps with
  reports" is too vague to trigger correctly.
- Steps name the real tables, columns and filters. Check them against the
  schema catalog of the connection before writing them.
- A definition that other skills also need belongs in a rule
  (`rules/<id>.md`), not in the skill. Link to it by name.
- Keep the body under about 150 lines. Every line is read on each run that
  uses the skill.
- No personal data: no names, emails, phone numbers or ids of people.

## 3. Propose as a diff

Propose the file with `ws_write` (new) or `ws_edit` (change). The trainer sees
the diff and approves or declines. If declined, ask what to change and
propose again.

## 4. Eval cases

Save the interview examples as eval cases with `ws_write`, one file per case
under `evals/<id>.yaml`:

```yaml
question: <a question that should use the skill>
expectation: <what a correct answer contains>
expect_skill: <skill id>
```

```yaml
question: <a similar question that should not use it>
expectation: <what a correct answer contains>
expect_no_skill: <skill id>
```

Use at least two of each kind.

## 5. Test

Run `/test`: call `run_learning_eval` with the cases from step 4. Report per
case whether the skill was used when expected and how the answer scored.
When a case fails, change the description (triggering) or the steps (answer
quality), propose the diff, and test again. If `run_learning_eval` is not
available, tell the trainer the cases are saved and can be run later.
