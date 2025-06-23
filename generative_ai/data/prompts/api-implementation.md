
You are a code-generation agent inside my editor.  
Create TypeScript files that match the MIOT BFF architecture described below.  
Leave `// TODO:` markers for business logic so I can fill them later.

────────────────────────────────────────────
GLOBAL RULES
────────────────────────────────────────────
• Root of the BFF lives at `apps/bff/src`.  
• Every module gets its own folder under `apps/bff/src/modules/`.  
• Each module must contain **exactly three files**:
  1. `<module>.schemas.ts`   – all Fastify/OpenAPI schemas
  2. `<module>.routes.ts`    – route definitions that import those schemas
  3. `<module>.routes.test.ts` – test file for the routes
• Use Fastify’s `FastifySchema` type; export an object named `routeSchema`.  
• Prefix routes with the directory name (`dirNameRoutePrefix: true` is already enabled).  
• All files compile under `tsconfig.json` (ES2022, `"module": "ESNext"`).  
• Do **not** implement DB queries—return hard-coded mock payloads for now.

────────────────────────────────────────────
MODULES TO GENERATE
────────────────────────────────────────────
You will be given a list of modules to generate from @apis-roadmap.md file.
Format will be:

```
## [NUMBER]. [MODULE NAME]  (BFF Node)

| Method | Path                  | Purpose                                                 |
| ------ | --------------------- | ------------------------------------------------------- |
| `METHOD` | `/path`             | `description` |
---
```
Example:

```
| `POST` | `/auth/signup`        | `{ email, password }` ➜ email-verify link               |
| `POST` | `/auth/login`         | `{ email, password }` → `{ accessToken, refreshToken }` |
| `POST` | `/auth/oauth/google`  | OIDC redirect flow                                      |
| `POST` | `/auth/refresh`       | swap refresh-token for new pair                         |
| `POST` | `/auth/logout`        | revoke current tokens                                   |
| `GET`  | `/user/me`            | signed-in profile + currentOrgId                        |
| `GET`  | `/user/organizations` | org list + role per org                                 |
---
```

────────────────────────────────────────────
FILE CONTENT GUIDELINES
────────────────────────────────────────────
• **Schemas**: include `description`, `tags`, query/body/response types, and `security: [{ bearerAuth: [] }]` where auth is required.  
• **Routes**: import `FastifyInstance, FastifyRequest, FastifyReply`; register handlers with inline arrow functions that return mock JSON (e.g., an array of demo objects).  
• Add `swagger.hidden = true` on any internal-only endpoints (none in this list).  
• At the top of each route file include:  
  ```typescript
  /**
   * Auto-generated: DO NOT EDIT BY HAND
   * @module <module-name>
   */
````

────────────────────────────────────────────
DELIVERABLE FORMAT
────────────────────────────────────────────
For each generated file, output in its own fenced code block:

```ts
// apps/bff/src/modules/<module>/<file>.ts
<file content>
```

Also output a final tree overview showing every new directory and file.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
