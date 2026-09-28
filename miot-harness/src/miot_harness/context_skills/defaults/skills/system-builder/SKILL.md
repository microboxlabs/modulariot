---
name: system-builder
description: >
  Inspect and set up the organization's integration connections (the
  external APIs and databases ModularIoT talks to): list them, read one,
  create one from a template and test it. Turn widgets of the conversation
  into a dashboard.
when_to_use: >
  The user asks which systems are connected, why a connection fails, or
  wants to connect a new system or check that one works. Also when the user
  wants a dashboard of the results of the conversation.
mcp:
  url: ${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp
  tools: [connections_*]
---

# System builder

A connection is how the organization reaches an external system: a base
URL, the credential it signs in with, and the operations it can call. Most
connections are created from a template, which fixes the provider and the
operation. Every tool here needs an organization owner; if the server
refuses, say so and stop.

## Reading

- `connections_list` shows every connection with its status (`DRAFT`,
  `ACTIVE`, `TEST_FAILED`) and last test result.
- `connections_get` adds the operations a connection can call.
- A credential appears only as its id. Never ask for, show or guess a
  secret; masked values (`***`) stay masked.

## Creating a connection

1. `connections_templates` lists the templates and the credentials a
   connection can use.
2. Agree with the user on the template, a short name, the base URL and the
   credential. When the credential does not exist yet, ask the user to
   create it in the Integrations screen and stop: secrets are never typed in
   the chat.
3. `connections_create` with `templateId`, `name`, `baseUrl` and
   `credentialProfileId`. `metadata` takes only non-secret settings the
   template needs.
4. `connections_test` right after. Report the result in one line; on a
   failure, give the message and what to check (URL, credential, network).

Do not create a second connection for the same system to work around a
failed test; fix the first one or ask the user.

## Building a dashboard from the conversation

1. Show each result the dashboard needs with `<connection>_show` (a saved
   `<connection>_analysis` can be passed as `analysis`). Each call returns a
   `widget_id`. Use KPIs for single numbers, bar or line charts for
   breakdowns and trends, tables for detail.
2. `dashboard_draft` with a `title`, a one-sentence `description` and the
   widget ids in display order: KPIs first, then charts, then tables. At
   most 12.
3. The user sees a preview and a button that creates the dashboard in their
   site; nothing is saved until they press it. Say so in one line.

A dashboard made this way keeps the data as shown in the chat; it does not
refresh. Dashlets read live data only from a PostgREST function of the
dashboard's data source, not from a saved analysis. When the user needs the
numbers to refresh, say which analysis should become a database function
(its name and SQL), and that after that the dashlet's Data settings can
point to the function; its columns must then be picked again.

## Answering

Name connections by their name, with the provider in parentheses. After a
change, say what changed and the new status.
