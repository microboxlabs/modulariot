You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────

1. **Create an abstract identity-provider layer** (`IdentityClient`) and a concrete **Auth0** implementation in `apps/web-admin/lib/api/auth0.ts`.

2. Expose the following methods (all return typed results / throw errors):

   ```ts
   listClients()
   createClient(input)
   getClient(id)
   updateClient(id, input)
   deleteClient(id)

   listClientCredentials(clientId)
   createClientCredential(clientId, input)
   getClientCredential(clientId, credId)
   updateClientCredential(clientId, credId, input)
   deleteClientCredential(clientId, credId)
   rotateClientSecret(clientId)
   getEnabledConnections(clientId)
   ```

3. **Update Prisma schema** so each **Project** can store a mapping to its Auth0 application (`clientId`, `clientSecret`, etc.) and so **Users** can be matched to an Auth0 user-id.

4. Add a **Zod-validated server util** that, given the current session, verifies the user is **OWNER** (or ADMIN) of the organization before it can call the Auth0 wrapper.

5. Leave TODOs where a deeper implementation is deferred (e.g. rotating secrets, auditing).

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────

* Bun + TypeScript
* `auth0` NPM package (`node-auth0` already installed)
* Next.js 15 (App Router)
* Prisma ORM (`packages/db`)
* Zod for validation
* `getServerSession()` (next-auth) for current user

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
packages/db/
├─ schema.prisma                          (update)
└─ migrations/…                           (auto – omit content)

apps/web-admin/
└─ lib/
└─ api/
├─ identityClient.ts               ← interface / abstract base
├─ auth0.ts                        ← concrete implementation
└─ authGuard.ts                    ← helper to verify org ownership

────────────────────────────────────────────
DB MODEL CHANGES (Prisma)
────────────────────────────────────────────

```prisma
/// NEW — enum of future providers
enum IdentityProvider {
  AUTH0
  // OPENID      // TODO: future
}

/// NEW — link each project to its IDP application
model ProjectIdentityApp {
  id             String           @id @default(uuid())
  provider       IdentityProvider
  project        Project          @relation(fields: [projectId], references: [id])
  projectId      String           @unique
  externalAppId  String           @unique   // Auth0 client_id
  externalSecret String?          // optional client_secret
  metadata       Json?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}

/// OPTIONAL — map user ↔ provider user-id for future SSO checks
model UserIdentity {
  id            String           @id @default(uuid())
  provider      IdentityProvider
  user          User             @relation(fields: [userId], references: [id])
  userId        String
  externalUserId String          @unique
  createdAt     DateTime         @default(now())
}

```

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• **identityClient.ts**

```ts
export interface IdentityClient {
  listClients(): Promise<Client[]>
  createClient(input: CreateClientInput): Promise<Client>
  getClient(id: string): Promise<Client>
  updateClient(id: string, input: UpdateClientInput): Promise<Client>
  deleteClient(id: string): Promise<void>

  listClientCredentials(clientId: string): Promise<Credential[]>
  createClientCredential(clientId: string, input: CreateCredInput): Promise<Credential>
  getClientCredential(clientId: string, credId: string): Promise<Credential>
  updateClientCredential(clientId: string, credId: string, input: UpdateCredInput): Promise<Credential>
  deleteClientCredential(clientId: string, credId: string): Promise<void>
  rotateClientSecret(clientId: string): Promise<RotatedSecret>
  getEnabledConnections(clientId: string): Promise<Connection[]>
}
```

• **auth0.ts**

```ts
import { ManagementClient } from 'auth0'
import { IdentityClient } from './identityClient'
import { z } from 'zod'

// TODO: read from secure runtime env
const mgmt = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_MGMT_ID!,
  clientSecret: process.env.AUTH0_MGMT_SECRET!,
  scope: 'read:clients create:clients delete:clients update:clients read:client_keys create:client_keys delete:client_keys'
})

export class Auth0Client implements IdentityClient {
  // implement required methods with mgmt.clients, mgmt.clientGrants, etc.
  async listClients() { /* TODO */ }
  async createClient(input) { /* TODO */ }
  async getClient(id) { /* TODO */ }
  async updateClient(id, input) { /* TODO */ }
  async deleteClient(id) { /* TODO */ }

  async listClientCredentials(clientId) { /* TODO */ }
  async createClientCredential(clientId, input) { /* TODO */ }
  async getClientCredential(clientId, credId) { /* TODO */ }
  async updateClientCredential(clientId, credId, input) { /* TODO */ }
  async deleteClientCredential(clientId, credId) { /* TODO */ }

  async rotateClientSecret(clientId) { /* TODO */ }
  async getEnabledConnections(clientId) { /* TODO */ }
}
```

• **authGuard.ts**

```ts
import { getServerSession } from 'next-auth'
import { prisma } from '@miot/db'         // path shorthand for packages/db
import { z } from 'zod'

export async function assertOrgOwner(projectId: string) {
  const session = await getServerSession()
  if (!session?.user?.id) throw new Error('Unauthenticated')

  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    include: { organization: { include: { memberships: true } } }
  })
  if (!proj) throw new Error('Project not found')

  const membership = proj.organization.memberships.find(
    m => m.userId === session.user.id
  )
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role))
    throw new Error('Forbidden')
}
```

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────

1. Print concise **directory tree** of all new / updated files.
2. Then output each file in its own fenced block, like:

```ts
// apps/web-admin/lib/api/identityClient.ts
<file content>
```

Add `// TODO:` where implementation stubs remain.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
