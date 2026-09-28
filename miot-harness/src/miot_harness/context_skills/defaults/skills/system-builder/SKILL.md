---
name: system-builder
description: >
  Inspect and set up the organization's integration connections (the
  external APIs and databases ModularIoT talks to): list them, read one,
  create one from a template and test it.
when_to_use: >
  The user asks which systems are connected, why a connection fails, or
  wants to connect a new system or check that one works.
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

## Answering

Name connections by their name, with the provider in parentheses. After a
change, say what changed and the new status.
