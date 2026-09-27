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
export type PlatformSection = "branding" | "superusers" | "models" | "usage";

/** The providers the harness can call. Mirrors `ModelProviderService.KNOWN`. */
export const MODEL_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "deepseek",
  "qwen",
  "kimi",
  "glm",
] as const;

export type ModelProviderName = (typeof MODEL_PROVIDERS)[number];

/** Mirrors `ModelEntry`: prices are USD per million tokens. */
export interface ModelEntry {
  id: string;
  inputPerMtok: number | null;
  outputPerMtok: number | null;
  default: boolean;
}

/** Mirrors `ModelProviderResponse`. The key itself is never returned. */
export interface ModelProviderAdmin {
  provider: string;
  baseUrl: string | null;
  keyPreview: string;
  models: ModelEntry[];
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Mirrors `SetModelProviderRequest`. A blank `apiKey` keeps the stored one. */
export interface SetModelProvider {
  apiKey: string;
  baseUrl: string | null;
  models: ModelEntry[];
  enabled: boolean;
}

/** Mirrors `UsageTotal`: one organization and model over the period asked for. */
export interface ModelUsageTotal {
  organization: string | null;
  provider: string;
  model: string;
  runs: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  unpricedRuns: number;
}
