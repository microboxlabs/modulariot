/** Mirrors the Quarkus `DomainBrandingDto`: metadata only, never the bytes. */
export interface DomainBrandingAdmin {
  domain: string;
  logoMime: string;
  logoEtag: string;
  /** Null when the domain ships one logo for both grounds. */
  logoDarkMime: string | null;
  logoDarkEtag: string | null;
  homeUrl: string | null;
  active: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

/** Mirrors `SetDomainBrandingRequest`. */
export interface SetDomainBranding {
  logoDataUrl: string;
  /**
   * Optional. Null clears a stored dark variant: the write replaces the row,
   * so an edit that means to keep one resends it.
   */
  logoDarkDataUrl: string | null;
  homeUrl: string | null;
  active: boolean;
}

/**
 * Mirrors `PlatformRoleDto`.
 *
 * `bootstrapAssigneeIds` come from the modulith's `miot.platform.owner-emails`
 * and only a deployment change can alter them, so the UI renders them
 * read-only rather than appearing to have dropped them on the next save.
 */
export interface PlatformRole {
  roleCode: string;
  assigneeIds: string[];
  bootstrapAssigneeIds: string[];
}

/** Mirrors `PlatformRoleMembershipDto`. */
export interface PlatformRoleMembership {
  roleCodes: string[];
}

export const PLATFORM_OWNER_ROLE = "PLATFORM_OWNER";

/** Which ground a stored logo is drawn for. Mirrors `LogoVariant` on the modulith. */
export type LogoVariant = "light" | "dark";

/** The panels Settings > Platform offers in its left-hand menu. */
export type PlatformSection = "branding" | "superusers";
