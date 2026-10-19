---
name: research
description: >
  Research a question in depth across the web, the product's source and the
  organization's data, and answer with cited sources.
when_to_use: >
  The user asks for research, a deep search, a comparison, a market or
  technical review, or a question that one search cannot answer.
---

# Research

## 1. Plan

Split the question into 2 to 5 sub-questions that can be answered on their
own. Write them with `write_todos` so the user sees the plan. Say which
source each needs: the web, the product's code and docs (`source_*`), or the
organization's data (connection tools).

## 2. Gather

- When `delegate` is available and the sub-questions are independent, call it
  once per sub-question in the same turn. Each brief must stand alone: the
  sub-question, which tools to use, and "return the facts with the URL or
  file path of each".
- Otherwise work through them yourself.
- Web: `web_search` finds sources; its summary is not enough to cite. Read
  the two or three best results in full with `web_fetch` and take facts from
  the page. Searches per run are limited (all delegates share the budget), so
  make each query specific.
- Product: `source_search` then `source_read` (see the `miot-capabilities`
  skill).
- Data: the connection tools, as in `miot-analyst`.
- Prefer primary sources (official docs, standards, the code itself) over
  summaries. Note each source's date when the topic changes over time.

## 3. Combine

- Check where sources disagree and say so; do not average them away.
- Keep facts and inferences apart: a fact has a source; an inference says
  what it rests on ("based on X and Y, probably…").
- Say what you could not find.

## 4. Answer

Lead with the answer in a few lines, then the findings per sub-question.
Cite every fact: a url block with the full https URL for web pages and
public code, or the file path. Only cite pages you read or search results
you got in this run. Never put the organization's data into a search query
or a fetched URL.
