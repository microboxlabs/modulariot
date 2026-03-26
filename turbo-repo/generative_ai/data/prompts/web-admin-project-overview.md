You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Build a rich **Project Overview** dashboard for ModularIoT.

• Route: /org/<orgId>/project/<projectId>
• Sections:
  1. Header: Project name, plan badge, live status dot.
  2. KPI row (6 metric cards) — see “metrics” below.
  3. Charts panel (time-series for TPS, Symptoms, Storage).
  4. Issues table with tabs Security | Performance.
  5. Slow Queries table (collapsed by default).
  6. Client Libraries accordion (JS, Python, Flutter, Go, etc).
  7. Example Projects accordion with 6 cards (Next.js fleet map, CLI sim, etc).

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15 (app router) + TypeScript  
Tailwind + flowbite (Card, Tabs, Accordion, DropdownMenu)  
Recharts for sparklines / charts  
Lucide icons  
Data fetched via `/api/projects/[id]/metrics?window=…` (stub).

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ components/
   │   ├─ MetricCard.tsx             ← value + sparkline
   │   ├─ KpiRow.tsx                 ← 6 cards with grid
   │   ├─ TimeSeriesPanel.tsx        ← charts
   │   ├─ IssuesTable.tsx            ← security/perf tabs
   │   ├─ SlowQueriesTable.tsx       ← collapsible
   │   └─ LibrariesAndExamples.tsx   ← accordion section
   ├─ api/
   │   └─ projects/[id]/metrics/route.ts   ← returns mock JSON // TODO real SQL
   └─ org/[orgId]/project/[projectId]/page.tsx  ← assembles dashboard

────────────────────────────────────────────
METRICS TO DISPLAY
────────────────────────────────────────────
• activeDevices
• totalDevices
• eventsPerMin
• ingestLatencyMs
• alerts24h
• criticalRatio
• storageGB
• advisorCalls

────────────────────────────────────────────
VISUAL RULES
────────────────────────────────────────────
• KPI cards: min-w-32, h-24, bg-muted, icon left, number right.
• Charts: single-series line, height 180, theme-aware.
• Tables: shadcn `Table` with 6 rows max, link to full Logs.
• Dropdown top-right to switch window (15m, 60m, 24h).

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• `"use client"` only in chart + dropdown components.
• Fetch metrics with SWR; refetch every 30 s.
• If plan==="free" hide Storage GB & Advisor calls cards.
• Placeholders for metric data with random numbers when API returns 501.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Directory tree of all new / updated files.
2. Then each file in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
