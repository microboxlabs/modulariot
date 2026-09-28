---
name: storyteller
description: >
  Save the results of the conversation as a story (a report, a deck, a
  diagram or a page) the user can keep, open later and share by link.
when_to_use: >
  The user asks to make a story, report, deck, presentation or summary of
  the work, to save or share a result, or to change a story made earlier.
  Also at the end of a work session, when the user accepts saving its
  summary.
mcp:
  url: ${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp
  tools: [stories_*]
  conversation_arg: sourceThreadId
---

# Storyteller

A story is a saved document with versions. Its owner sees it in Stories and
can share it with a link. The chat thread it came from is recorded for you.

## 1. Write the story

Use only numbers you read from a tool result in this thread. Order:

1. **Question**: what the user wanted to know, in one sentence.
2. **Answer**: the result first, with its main numbers.
3. **Evidence**: the figures behind the answer, as short lists or tables.
   Name the saved analyses (`<connection>_analysis`) that produce them, so
   the reader can run them again.
4. **Method**: the definitions, filters and period used, and any
   assumption that was not confirmed.
5. **Next steps**: open questions and what to check next.

Write in the user's language. Short sentences, no filler.

## 2. Choose the kind

| The user wants | kind | What to send |
|---|---|---|
| a report, a summary, notes | `markdown` | `version.content`: the Markdown |
| a presentation, slides | `deck` | `version.metadata`: `{"slides": [...]}` |
| one diagram or chart image | `svg` | `version.content`: the SVG source |
| an interactive page | `html` | `version.content`: a full HTML page |

Default to `markdown`. Use `html` only when the page must do something
Markdown cannot.

A deck has 5 to 10 slides. Each slide title says the slide's one message
("Norte concentra el 41 % de las devoluciones", not "Devoluciones por
región"). Slides are one of:

- `{"type": "title", "title": "...", "subtitle": "..."}`: the first slide.
- `{"type": "bullets", "title": "...", "items": ["...", "..."]}`: at most
  5 items.
- `{"type": "table", "title": "...", "headers": ["...", "..."], "rows": [["...", "..."]]}`:
  numbers go in tables, every cell a string.

No other slide types or fields.

## 3. Save and share

1. `stories_create` with a short `title`, the `kind`, a one-sentence
   `description` and the `version`. Leave `sourceMessageId` out.
2. `stories_link` with the new story's id. The result's `path` is the link.
3. Tell the user in two or three lines: the title, the kind, what it
   contains, and the link as a url block.

## 4. When the user asks for changes

Do not create a new story. Add a version to the same one with
`stories_add_version`: the full new content, a `label` and a one-line
`summary` of what changed. When you do not have the story's id, find it
with `stories_list` (by title), then read it with `stories_get`. To go back
to an earlier version, use `stories_set_current`.

If a call is refused or fails, say so in one line; do not retry with other
arguments.
