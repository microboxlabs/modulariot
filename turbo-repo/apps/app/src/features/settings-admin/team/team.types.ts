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
export interface CreatedInvitation {
  invitation: Invitation;
  token: string;
}

export interface InviteRequest {
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
  permissions: string[];
}

export interface AccessCatalog {
  baseRoles: BaseRole[];
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
