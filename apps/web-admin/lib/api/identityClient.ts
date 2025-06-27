import { z } from 'zod'

export const CreateClientInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  app_type: z.enum(['native', 'spa', 'regular_web', 'non_interactive']).default('regular_web'),
  callbacks: z.array(z.string()).optional(),
  web_origins: z.array(z.string()).optional(),
  allowed_origins: z.array(z.string()).optional(),
  grant_types: z.array(z.string()).optional(),
})

export const UpdateClientInputSchema = CreateClientInputSchema.partial()

export const CreateCredInputSchema = z.object({
  credential_type: z.enum(['public_key', 'x509_cert']),
  name: z.string(),
  pem: z.string().optional(),
  alg: z.string().optional(),
})

export const UpdateCredInputSchema = CreateCredInputSchema.partial()

export const ClientSchema = z.object({
  client_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  app_type: z.string(),
  callbacks: z.array(z.string()).optional(),
  web_origins: z.array(z.string()).optional(),
  allowed_origins: z.array(z.string()).optional(),
  grant_types: z.array(z.string()).optional(),
  client_secret: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const CredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  credential_type: z.string(),
  kid: z.string().optional(),
  alg: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const RotatedSecretSchema = z.object({
  client_secret: z.string(),
})

export const ConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string().optional(),
  strategy: z.string(),
  enabled_clients: z.array(z.string()).optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientInputSchema>
export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>
export type CreateCredInput = z.infer<typeof CreateCredInputSchema>
export type UpdateCredInput = z.infer<typeof UpdateCredInputSchema>
export type Client = z.infer<typeof ClientSchema>
export type Credential = z.infer<typeof CredentialSchema>
export type RotatedSecret = z.infer<typeof RotatedSecretSchema>
export type Connection = z.infer<typeof ConnectionSchema>

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