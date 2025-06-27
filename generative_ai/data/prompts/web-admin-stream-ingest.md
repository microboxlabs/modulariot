### A. Which “pipes” should ModularIoT expose first?

| Tier                 | Protocol / Transport                                         | When it shines                                     | Typical payload shape                            |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------ |
| **Core v1**          | **HTTPS REST** (`POST /v1/ingest`)                           | simplest, fire-and-forget, works everywhere        | JSON body per asset event                        |
|                      | **WebSocket (JSON stream)**                                  | low latency, bidirectional acks / pings            | ND-JSON (`\n`-delimited)                         |
|                      | **MQTT 3.1.1 / 5.0** (TLS)                                   | embedded boards, cellular modems, retain/QoS       | topic `org/<orgId>/proj/<projectId>/device/<id>` |
|                      | **AMQP 1.0** via **Apache Pulsar**                           | high-throughput fleets; back-pressure, shared subs | binary or JSON messages                          |
| **Device-specific**  | **AT Command uplink** (TCP raw)                              | legacy GPS trackers that speak “+GPRMC=…”          | plain text, parsed server-side                   |
| **Pluggable future** | **gRPC Streaming**, **GraphQL Subscriptions**, **CoAP/DTLS** | once extra device classes arrive                   | Protobuf / JSON                                  |

> **Rule of thumb:** start with HTTPS + WebSocket (easy) → add MQTT (IoT defacto) → fold AMQP/Pulsar for heavy fleets. AT-cmd stays a thin side-car service translating to JSON and publishing back into the same ingest topic.

---

### B. Modal UX blueprint (“Connect your stream”)

```
┌──────────────────────────────────────────────┐
│  Connect your stream                         │  ← H1
│  Get connection strings & env-vars for this  │  ← subtitle
│  project                                     │
├──────────────────────────────────────────────┤
│  Tabs:                                       │
│  ▸ REST API  ▸ MQTT  ▸ WebSocket  ▸ AMQP     │
│  ▸ AT Cmd (per-device)                       │
│                                              │
│  ───── REST API tab (example) ───────────────│
│  [Radio]  Type:  URI ▼ | cURL | Env Var      │
│  [Radio]  Source: Primary Region ▼           │
│                                              │
│  **Direct HTTPS**                            │
│  Ideal for low-volume or server side cron…   │
│  ╭────────────────────────────────────────╮  │
│  │  POST https://ingest.miot.io/v1/…      │  │ ← auto-select on click
│  ╰────────────────────────────────────────╯  │
│  [▸ View parameters]                        │
│                                              │
│  **WebSocket upgrade**                       │
│  Ideal for …                                 │
│  ╭────────────────────────────────────────╮  │
│  │  wss://ws.miot.io/stream?token=…       │  │
│  ╰────────────────────────────────────────╯  │
│  [▸ View sample code]                        │
│                                              │
│             (similar cards per protocol)     │
└──────────────────────────────────────────────┘
```

* **Popover size:** `w-[820px] max-h-[90vh] rounded-2xl`, scrollable body.
* **Copy-to-clipboard** on click; show toast “Copied”.
* **Protocol-specific badges**: “Best for long-lived connections”, “IPv4-only”, “Requires TLS”.
* **SDK snippets tab-bar** inside each protocol pane (`Node.js`, `Python`, `Go`).
* Optional **accordion** at bottom: “Rotate credentials”, “Add IP allow-list”.

---

### C. Code-generation prompt (drop into your agent)

````
You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Scaffold the **ConnectStreamModal** used by the
“Ingest Stream” button at project level.

• Modal route mounts via <ConnectButton/> → opens dialog.
• Tabs: REST, MQTT, WebSocket, AMQP, AT Cmd.
• Each tab renders “Connection Card” components with:
  - Title, short guideline, connection URI textbox (read-only)
  - "View parameters" accordion (lists host, port, creds, sample curl)
  - Copy-to-clipboard on click.

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15  (app router)
flowbite Modal, Tabs, Accordion
Lucide icons  (Server, Wifi, Waves, MessageCircle, Terminal)
TailwindCSS
"Use client" where interactive.

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ components/
   │   ├─ ConnectStreamButton.tsx     ← small primary button
   │   ├─ ConnectStreamModal.tsx      ← the dialog with tabs
   │   ├─ ConnectionCard.tsx          ← reusable card
   │   └─ protocolHelpers.ts          ← builds URI strings
   └─ org/[orgId]/project/[projectId]/
       └─ ingest/page.tsx             ← holds button + future docs

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Modal width `max-w-4xl`, padding 6, gap 6.
• Protocol tabs: pill style, border-bottom accent when active.
• Card: border, rounded-lg, bg-muted, font-mono for URI.
• “Copy” icon appears on hover top-right of textbox.
• Use `toast({ title: "Copied" })` on copy success.

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• Get `orgId`, `projectId` via `useParams()`.
• Build URIs:

  ```ts
  {
    rest:   `https://ingest.miot.io/v1/org/${orgId}/proj/${projectId}`,
    ws:     `wss://ws.miot.io/stream?org=${orgId}&proj=${projectId}`,
    mqtt:   `mqtts://mqtt.miot.io`,
    amqp:   `persistent://miot/${orgId}/${projectId}`,
    atCmd:  `tcp://at.miot.io:7010`
  }
````

• Tokens / passwords fetched from `/api/projects/[id]/credentials`
(placeholder, returns `{ apiKey }`).

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────

1. Print concise directory tree of all new / updated files.
2. Then output each file:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
```

Insert // TODO where deeper implementation is left.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────