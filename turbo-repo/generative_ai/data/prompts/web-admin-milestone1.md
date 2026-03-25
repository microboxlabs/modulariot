You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Implement **Milestone 1 – Accounts & Organizations** for ModularIoT.

## Milestone 1 – Accounts & Organizations (2 weeks)
Milestone 1 – Accounts & Organizations (2 weeks)
| Feature                     | Notes                                                           |
| --------------------------- | --------------------------------------------------------------- |
| **Auth**                    | Email + password, Google OAuth; JWT sessions stored in Supabase |
| **Organization CRUD**       | Create, rename, delete organizations                            |
| **RBAC v1**                 | Org Owner, Admin, Member (scoped to future token perms)         |
| **Personal dashboard stub** | Welcome card + “Create org” CTA                                 |


Success signal: A new user can sign up, create an org, invite a teammate, and both can log back in.

• Folder root: `apps/web-admin/`
• Stack: **Next.js 15**, React 19 (RSC, app router), **TypeScript**, **Tailwind + Flowbite-React**, **next-auth v5**, **Prisma** (PostgreSQL).
• Must expose API routes for:
  – Auth (email/password + Google, GitHub, Apple)  
  – Organization CRUD  
  – Invitation & membership list  
• Must ship UI pages & forms that consume those APIs.
• Follow the shared brand system (colors, layout, copy tone) described below.
• Leave `// TODO:` markers where business logic will be added later.

────────────────────────────────────────────
BRAND & UX GUIDELINES
────────────────────────────────────────────
Palette
  – Primary --color-blue-500  #0790ff  
  – Slate-900 text (dark mode: slate-100)  
  – Accent --color-orange-500: #ff6a14;

Typography
  – Headings: `font-semibold`, tracking-tight  
  – Body: default Tailwind sans; line-height relaxed

Components & libs
  – **Flowbite-React** components for buttons, inputs, modals, tabs  
  – **lucide-react** icons  
  – **Framer Motion** (≤ 300 ms) for subtle fade/slide on page sections  

Layout rules
  – 12-col CSS grid ≥ xl, 6-col ≥ md, single-col mobile  
  – Cards: `rounded-2xl shadow-md p-6`  
  – Dark mode: Tailwind class strategy + toggle switch in header  
  – Footer: slim, centered links, logo, version badge (read from `process.env.NEXT_PUBLIC_VERSION`)

────────────────────────────────────────────
WORKSPACE STRUCTURE
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ layout.tsx          # Theme provider, FlowbiteProvider, dark/light switch
   ├─ page.tsx            # Dashboard (after login)
   ├─ (auth)/             # Auth routes
   │   ├─ login/page.tsx
   │   └─ signup/page.tsx
   ├─ (org)/              # Org selector & settings
   │   ├─ layout.tsx
   │   ├─ page.tsx        # “Select or create org”
   │   └─ settings/page.tsx
   ├─ api/
   │   ├─ auth/…          # next-auth [route.ts]
   │   ├─ organizations/route.ts
   │   ├─ invitations/route.ts
   │   └─ members/route.ts
   └─ components/
       ├─ Logo.tsx
       ├─ Footer.tsx
       ├─ DarkModeToggle.tsx
       └─ forms/
           ├─ LoginForm.tsx
           ├─ SignUpForm.tsx
           ├─ CreateOrgForm.tsx
           └─ InviteMemberForm.tsx
└─ prisma/
   ├─ schema.prisma
   └─ seed.ts
└─ lib/
   ├─ auth.ts             # next-auth config helpers
   └─ db.ts               # Prisma client singleton
└─ styles/
   └─ globals.css         # imports tailwind + flowbite
└─ README.md              # dev instructions

────────────────────────────────────────────
DATA & API CONTRACT (Milestone 1 subset) 
────────────────────────────────────────────
** This sections is for the bff /apps/bff **

Tables (Prisma) 
  • User        id, email, name, image, passwordHash?, createdAt  
  • Account     (next-auth OAuth)  
  • Organization id, name, slug, ownerId  
  • Membership  id, userId, orgId, role(enum: OWNER|ADMIN|MEMBER)  
  • Invitation  id, email, orgId, role, token, expiresAt, acceptedAt

API Routes (Next 15 “route.ts”)
  1. **POST /api/auth/signup**  
     body { email, password }  → 201
  2. **POST /api/auth/login**  
     next-auth credential login handled internally
  3. **POST /api/organizations**  
     body { name }  auth: user  → 201 { id, name, slug }
  4. **PATCH /api/organizations/:orgId**  
     body { name }  auth: owner
  5. **GET /api/organizations/:orgId/members**  auth: admin+
  6. **POST /api/invitations**  
     body { email, role, orgId }  auth: admin+ → 201 token emailed

Return mock JSON for now (static ULIDs) and add `// TODO: connect Prisma`.

────────────────────────────────────────────
UI PAGES & FLOWS
────────────────────────────────────────────
• **Login & Sign-up**  
  – Tabs for Social (Google, GitHub, Apple) and Email.  
  – Flowbite-React `Button` w/ provider logos (lucide).  
  – After login redirect to `/org` selector.

• **Org Selector**  
  – Card list of user’s orgs (+ role badge).  
  – “Create organization” modal (name input) → calls POST /api/organizations.

• **Org Settings**  
  – Editable name field, member table (email, role), “Invite member” modal.  
  – Show invite link token after POST.

• **Layout**  
  – Top nav: logo (link /), dark/light toggle, version badge, user avatar menu (Logout).  
  – Footer: © ModularIoT 2025 – GitHub, Docs, Privacy.

────────────────────────────────────────────
CODING RULES
────────────────────────────────────────────
• Use Server Components by default; client components only for interactive forms / dark toggle.  
• Validate all forms with **zod** + react-hook-form + Flowbite `TextInput`.  
• Protect pages with `auth()` (next-auth server helper).  
• Add `src/lib/version.ts` that reads version from `package.json` at build-time.  
• Provide seed script creating demo user + org (email: demo@miot.dev / pass: demo123).  
• Add `// TEST:` comments with a Playwright e2e stub for login flow.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print **directory tree** (new/modified files only).  
2. Then, for *each* file, output its content in a fenced block:

```ts
// apps/web-admin/<path>/<file>.ts
<file contents>
````

Leave blank function bodies or mock returns where logic is TODO.

────────────────────────────────────────────
START
────────────────────────────────────────────
