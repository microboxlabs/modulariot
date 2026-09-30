---
name: session-summary
description: >
  Summarize a work session in the chat: the questions asked, the answers
  with their numbers, what was saved, and what is still open.
when_to_use: >
  The user wraps up ("that's all", "resume lo que hicimos", "summary of
  today"), asks what was done in this conversation, or asks for a summary
  to keep or share.
---

# Session summary

## 1. Gather

- Read the thread from the start. Take only what a tool result or the user
  said; never add numbers.
- For each connection used in the thread, call `<connection>_analysis`
  (`list`) and `<connection>_memory` (`list`), and keep the entries this
  session created or changed.
- Note the widgets, stories and other artifacts produced in the thread.

## 2. Write

Use these sections, and leave out the ones that would be empty:

1. **Questions**: each question the user asked, one line each.
2. **Answers**: the answer to each, with its main numbers and the period
   or filter it applies to.
3. **Saved**: analyses (name and what it answers) and memory notes
   (definitions and facts) saved this session.
4. **Produced**: widgets, stories and other artifacts, with their links
   when they have one.
5. **Open**: questions not answered, assumptions not confirmed, and
   suggested next steps.

Keep it short: one screen. Write in the user's language.

## 3. Offer to save it

End with a `choices` block asking whether to save the summary as a story.
If the user says yes, `load_skill` `storyteller` and save it as a
`markdown` story with the same content.
