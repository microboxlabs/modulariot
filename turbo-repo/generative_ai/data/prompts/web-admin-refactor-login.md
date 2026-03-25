You are a code-generation agent inside my editor.

────────────────────────────────────────────
OBJECTIVE
────────────────────────────────────────────
Refactor the Sign-In / Sign-Up pages under **`apps/web-admin/`**:

1. **Desktop ≥ sm (640 px)**  
   • **Left column (MarketingPanel)** – full-height, showcases logo + punchy copy.  
   • **Right column (AuthForm)** – existing login / signup form with social buttons.  

2. **Mobile < sm**  
   • Hide MarketingPanel; show only AuthForm stacked vertically.

────────────────────────────────────────────
TECH & DEPENDENCIES
────────────────────────────────────────────
• Next.js 15 (app router, RSC)  
• TypeScript  
• Tailwind CSS + **Flowbite-React** for form + buttons  
• lucide-react icons  
• Framer Motion (≤ 300 ms) for subtle MarketingPanel fade-in  
• Use existing **`/public/logo.svg`**

────────────────────────────────────────────
FILE / FOLDER CHANGES
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ (auth)/
   │   ├─ login/page.tsx        # refactored layout
   │   └─ signup/page.tsx
   ├─ components/
   │   ├─ MarketingPanel.tsx    # left column
   │   └─ AuthForm.tsx          # right column form wrapper
   └─ styles/
       └─ auth.css              # optional isolated styles (import in layouts)

────────────────────────────────────────────
LAYOUT & STYLE SPECS
────────────────────────────────────────────
• Wrapper: `class="h-screen grid grid-cols-1 sm:grid-cols-2"`  
• **MarketingPanel** (hidden on `sm:hidden`):  
  – Background: `bg-primary-50 dark:bg-slate-900`  
  – Centered content:  
    1. `<Image src="/logo.svg" alt="ModularIoT" width={160} />`  
    2. H1 `text-3xl sm:text-4xl font-semibold tracking-tight`  
       “Monitor IoT fleets in real-time.”  
    3. P small tagline: “Symptom-driven alerts, usage-based billing, OSS.”  
    4. Optional tweet/testimonial block with lucide `Quote` icon.  
  – Framer Motion: fade-in + slide-up on mount.

• **AuthForm**:  
  – Max-w `sm:max-w-[420px] mx-auto my-auto px-6`  
  – Social buttons (GitHub, Google, Apple) via Flowbite `Button` + icons.  
  – Divider with `or`.  
  – Email + password inputs (Flowbite `TextInput`).  
  – Primary CTA `Sign In` / `Sign Up`.  
  – “Forgot password?” link and bottom switch link (“Don’t have an account? Sign up”).  
  – Respect dark-mode classes (`dark:bg-slate-800`, border colors).  

• **Accessibility**:  
  – `aria-label` on social buttons, form inputs.  
  – Keyboard focus ring on `Button` (`focus:ring-4 focus:ring-primary-300/50`).  

• **Responsiveness**:  
  – `sm:grid-cols-2`; MarketingPanel `hidden sm:flex flex-col items-center justify-center p-8`.  
  – On mobile, `MarketingPanel` remains `hidden`.

────────────────────────────────────────────
CODING RULES
────────────────────────────────────────────
• Use server components where possible; mark AuthForm `"use client"` since it has interactive validation.  
• Form does **not** have to connect to backend yet—leave submit handler `// TODO:`.  
• Import icons only for used providers.  
• Pull brand colors from Tailwind config (primary `#0FB8C9`, accent `#F58700`).  

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print concise **directory tree** of new/updated files.  
2. For each file, output in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Leave `// TODO:` where business logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────