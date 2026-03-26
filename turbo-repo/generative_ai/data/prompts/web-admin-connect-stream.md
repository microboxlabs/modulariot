You are a code-generation agent inside my editor.

────────────────────────────────────────────

## CONTEXT – why we’re changing the modal

────────────────────────────────────────────

### **Step 1 – Current gap**

Our **Connect Stream** modal shows a one-liner cURL that posts data with a static bearer token.
Reality: every device / backend first needs to obtain a **short-lived Auth0 M2M access-token** and then send data with that token. The modal must teach this 2-step flow.

### **Step 2 – Target UX (“two-step, one-scroll”)**

```
╔ Connect your stream
║ (REST tab example)
║
║ ①  Get an Auth token (once every 30 days)
║    curl -X POST https://{domain}.auth0.com/oauth/token \
║         -d '{ "client_id":"…", ... }'
║
║ ②  Send data
║    curl -X POST https://ingest.miot.io/v1/org/{org}/proj/{proj} \
║         -H "Authorization: Bearer $TOKEN" \
║         -d '{ "deviceId":"...", ... }'
║
║  Security banner: rotate creds, keep secret out of VCS…
╚
```

* Both commands visible in the same pane – copy twice, done.
* Other tabs (WebSocket, MQTT, …) will reuse the “Auth first → connect” pattern.

### **Step 3 – Implementation notes**

| Area          | Change                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **API**       | `GET /api/organizations/:orgId/projects/:projectId/credentials` returns Auth0 domain, clientId, audience, grantType & ingest URL. |
| **Component** | `ConnectionCard` now takes `steps: Step[]` with `title`, `code`, `description`.                       |
| **Helpers**   | `buildAuth0Curl(opts)` produces token fetch command; `buildRestCurl(url)` for the ingest command.     |
| **Security**  | Never expose `client_secret` in UI. Provide owner-only “Generate service credential” download later.  |
| **DX**        | Clipboard copy toast; highlights `$TOKEN` placeholder.                                                |

────────────────────────────────────────────

## GOAL

────────────────────────────────────────────

1. **Extend** the existing modal to show the two-step Auth0 + HTTPS flow.
2. **Refactor** components to support multiple “steps”.
3. **Stub** the credentials API endpoint that supplies Auth0 params and ingest URL.

────────────────────────────────────────────

## TECH STACK

────────────────────────────────────────────
Next.js 15 (app router) + TypeScript
Tailwind + flowbite (Dialog, Tabs)
Lucide icons
Prisma ORM (`packages/db`)
Zod for API validation

────────────────────────────────────────────

## CREATE / UPDATE THESE FILES

────────────────────────────────────────────
apps/web-admin/
└─ app/
    ├─ api/
      └─ organizations/\[orgId]/projects/\[projectId]/credentials/route.ts  ← new (stub returns hard-coded sample)
packages/ui/src/
    ├─ connect-stream-modal.tsx  ← build two-step REST tab
    ├─ connection-card.tsx  ← update for multi-step rendering
    ├─ protocol-helpers.tsx  ← `buildAuth0Curl`, `buildRestCurl`
    ├─ cta-buttons.tsx

────────────────────────────────────────────

## CODING NOTES

────────────────────────────────────────────

* `"use client"` where interactive.
* Fetch credentials once per modal open (`useSWR`).
* Copy-to-clipboard uses `navigator.clipboard.writeText`.
* `buildAuth0Curl` must insert placeholders in JSON body (`client_id`, `audience`, …).
* `credentials` API returns sample object; mark TODO to load real secrets later.

────────────────────────────────────────────

## OUTPUT FORMAT

────────────────────────────────────────────

1. Directory tree of all new / updated files.
2. Then each file in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
```

Include `// TODO:` where deeper logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
