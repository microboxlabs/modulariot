export type BaseRole = "OWNER" | "ADMIN" | "MEMBER";

export interface TeamMember {
  userId: string;
  email: string | null;
  name: string | null;
  baseRole: BaseRole;
  status: string;
  source: string;
  roles: string[];
  joinedAt: string;
  lastSeenAt: string | null;
}

export interface TeamView {
  organization: string;
  membershipSource: "NATIVE" | "ALFRESCO";
  members: TeamMember[];
}

export interface Invitation {
  id: string;
  email: string;
  baseRole: BaseRole;
  roles: string[];
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  organization: string;
}

/** `token` is returned only when the invitation is created or resent. */
/** Whether the link was emailed. SENT means the mail provider accepted it. */
export interface MailDelivery {
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  detail: string | null;
}

export interface CreatedInvitation {
  invitation: Invitation;
  token: string;
  delivery?: MailDelivery | null;
}

export interface InviteRequest {
  /** The email's language. */
  lang?: string;
  emails: string[];
  baseRole: BaseRole;
  roles: string[];
  expiresInDays: number;
}

export interface CatalogPermission {
  key: string;
  module: string;
  label: Record<string, string>;
  explicitOnly: boolean;
  ownerOnly: boolean;
}

export interface CatalogRole {
  key: string;
  module: string;
  label: Record<string, string>;
  /** What the role is for, per language. Empty when the module gives none. */
  description?: Record<string, string>;
  permissions: string[];
}

/** A module that has roles. `ai` marks assistant modules, shown with the AI accent. */
export interface CatalogModule {
  key: string;
  label: Record<string, string>;
  description: Record<string, string>;
  ai: boolean;
}

export interface AccessCatalog {
  baseRoles: BaseRole[];
  modules?: CatalogModule[];
  permissions: CatalogPermission[];
  roles: CatalogRole[];
}

export interface MyAccess {
  organization: string;
  baseRole: BaseRole | null;
  roles: string[];
  permissions: string[];
}

/** The organization joined (its slug) and the new membership. */
export interface AcceptedInvitation {
  organization: string | null;
  member: TeamMember;
}

/** A group of members that holds roles through bindings. */
export interface Team {
  id: string;
  name: string;
  description: string | null;
  source: string;
  members: string[];
  roles: string[];
  createdAt: string;
}

export interface TeamRequest {
  name: string;
  description: string;
}

export type PrincipalKind = "USER" | "TEAM" | "SERVICE_ACCOUNT" | "CLIENT";

/** A role held by a user, team or service account, on the organization or one sub-account. */
export interface Binding {
  id: string;
  principalKind: PrincipalKind;
  principalId: string;
  role: string;
  scopeKind: "ORGANIZATION" | "SUB_ACCOUNT";
  subAccount: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface BindingRequest {
  principalKind: Exclude<PrincipalKind, "CLIENT">;
  principalId: string;
  role: string;
  subAccount?: string;
  expiresAt?: string;
}

/** An API key as listed: only `keyId`, the public part, never the secret. */
export interface ApiKey {
  id: string;
  keyId: string;
  name: string | null;
  createdAt: string;
  createdBy: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ServiceAccount {
  id: string;
  name: string;
  description: string | null;
  disabled: boolean;
  roles: string[];
  keys: ApiKey[];
  createdAt: string;
  createdBy: string | null;
  /** The OAuth credential this account's keys are exchanged for; null for none. */
  tokenCredentialRef: string | null;
}

export interface ServiceAccountRequest {
  name: string;
  description: string;
  roles: string[];
  expiresInDays?: number;
}

export interface KeyRequest {
  name: string;
  expiresInDays?: number;
}

/** `secret` is returned only here, once. */
export interface CreatedServiceAccount {
  serviceAccount: ServiceAccount;
  secret: string;
}

export interface CreatedKey {
  key: ApiKey;
  secret: string;
}
