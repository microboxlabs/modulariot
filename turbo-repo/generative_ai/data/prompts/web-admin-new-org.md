You are a code-generation agent inside my editor.

────────────────────────────────────────────
OBJECTIVE
────────────────────────────────────────────
Implement a **Create Organization** page/dialog that matches the clean,
center-aligned card pattern in the screenshot, but branded for ModularIoT.

• Root repo: `apps/web-admin/`
• Tech: Next.js 15 (app router), TypeScript, Tailwind + Flowbite-React,
  zod + react-hook-form, lucide-react icons.
• Route: `/org/new`
• On submit, call `POST /api/organizations` with body `{ name, type, plan }`
  then redirect to `/org` selector once 201 is returned.

────────────────────────────────────────────
BRAND & STYLE
────────────────────────────────────────────
• Colors – primary blue `#0790ff`; accent orange `#ff6a14`.
• Typography – `font-semibold` headings, relaxed body text.
• Dialog card:
  `max-w-lg w-full border rounded-2xl shadow-md bg-white dark:bg-slate-900
   p-8 space-y-6`
• Field labels left-aligned, inputs right-aligned using Flowbite `Select`
  and `TextInput`.
• Buttons – `Cancel` (gray outline) and `Create organization` (primary).
• Helper text under each field (`text-sm text-slate-500 dark:text-slate-400`).
• Note below form: “You can rename your organization later.”
• Center card horizontally & vertically: `grid place-items-center h-screen`.

────────────────────────────────────────────
FORM DATA
────────────────────────────────────────────
Fields & defaults
 1. **Name**  (string, required)   placeholder “Organization name”
 2. **Type**  (enum)               options: Personal (default), Startup, Enterprise, Non-profit
 3. **Plan**  (enum)               options: Free – $0/mo (default), Pro – $49/mo
      • Include a small “Pricing ↗︎” link next to label that opens `/pricing` (Next link).

Validation (zod)
  – name: 3-60 chars
  – type: enum
  – plan: enum

────────────────────────────────────────────
FILES TO GENERATE / UPDATE
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ org/
   │   ├─ new/page.tsx                 # Create org screen
   │   └─ components/
   │       └─ CreateOrgForm.tsx        # Form component
   └─ lib/
       └─ api/org.ts                   # helper createOrganization()

────────────────────────────────────────────
COMPONENT NOTES
────────────────────────────────────────────
• **page.tsx** – Server component; imports `<CreateOrgForm />`.
  Wraps with card grid container.
• **CreateOrgForm.tsx** (client)
  - `"use client"`
  - RHF + zod resolver.
  - Disabled submit & button spinner while posting.
  - On success `router.push("/org")`.
  - Show inline error messages.

────────────────────────────────────────────
CODING RULES
────────────────────────────────────────────
• Keep business logic minimal; use `// TODO:` where DB/API isn’t available.
• Fetch helper in `lib/api/org.ts` wraps `fetch("/api/organizations", …)`.
• Provide mock enum arrays in the form file for now.
• Accessibility: `aria-label` on inputs; `role="alert"` on error text.
• Dark-mode ready (`dark:` utility classes).

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print concise **directory tree** of new/updated files.  
2. For each generated file, output its content in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Place `// TODO:` where further logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────