import { z } from "zod";

/**
 * Credentials — reusable identities/secrets that are configured once in Settings
 * and referenced from anywhere that talks to an external system (data sources,
 * integration connections, async jobs, channels).
 *
 * The screen's own model. `credentials-data-service.ts` maps the API's shape onto
 * it, which is why the two differ in a few names.
 */

/** Credential kinds the picker offers. Only some are implemented. */
export type CredentialTypeId =
  | "AZURE_ENTRA_CLIENT_CREDENTIALS"
  | "OAUTH2_CLIENT_CREDENTIALS"
  | "AUTH0_M2M"
  | "API_KEY"
  | "BEARER_TOKEN"
  | "BASIC_AUTH";

/** Where a credential is referenced from — the "configure once, reuse" payoff. */
export type CredentialUsageKind =
  | "DATA_SOURCE"
  | "INTEGRATION"
  | "JOB"
  | "CHANNEL";

export interface CredentialUsage {
  readonly id: string;
  readonly label: string;
  readonly kind: CredentialUsageKind;
}

export interface CredentialListItem {
  readonly id: string;
  readonly name: string;
  readonly typeId: CredentialTypeId;
  /**
   * Which deployment this credential is meant for. Providers issue one
   * client_id/secret pair per environment, so it is part of the credential's
   * identity rather than a deployment-time detail.
   *
   * Free text on purpose: three environments are seeded, but teams run staging,
   * sandbox, per-customer stacks and the like, so any label the user creates is
   * accepted rather than a closed enum.
   */
  readonly environment: string;
  /** Non-secret identifying detail shown in the list (e.g. masked client id). */
  readonly summary: string;
  readonly lastTestedAt?: string;
  readonly lastTestResult?: boolean;
  readonly usedBy: readonly CredentialUsage[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
  /** Type-specific config, minus secrets (never returned by the API). */
  readonly config:
    | AzureEntraConfig
    | OAuth2Config
    | Auth0M2MConfig
    | Record<string, string>;
}

/** Non-secret half of an Azure Entra client-credentials credential. */
export interface AzureEntraConfig {
  readonly tenantId: string;
  readonly clientId: string;
  readonly scope: string;
  readonly tokenRequestFormat: TokenRequestFormat;
  /** Set only when the default Entra token endpoint is not used. */
  readonly tokenUrlOverride?: string;
}

/**
 * Non-secret half of a generic OAuth2 client-credentials credential.
 *
 * Unlike Entra, the token endpoint is stated outright rather than derived —
 * there is no directory id to build it from. `audience` is what makes this
 * usable against Auth0: its M2M grant returns an opaque token unless the API
 * identifier is sent, so the field is offered here even though plain RFC 6749
 * has no such parameter.
 */
export interface OAuth2Config {
  readonly clientId: string;
  readonly tokenUrl: string;
  readonly scope?: string;
  readonly audience?: string;
  readonly tokenRequestFormat: TokenRequestFormat;
}

/**
 * Non-secret half of an Auth0 machine-to-machine credential.
 *
 * Auth0 M2M *is* OAuth2 client-credentials, so this persists as the backend's
 * `OAUTH2_CLIENT_CREDENTIALS` auth type rather than as a new one — the
 * `miot_integrations.credential_profiles.auth_type` CHECK constraint has no
 * `AUTH0_M2M` member and adding one buys nothing at the token layer.
 * {@link AUTH0_M2M_PROVIDER} on `publicConfig.provider` is what tells the two
 * apart on the way back, so an Auth0 credential reopens in the Auth0 form
 * instead of the generic one.
 *
 * `domain` is kept alongside the derived `tokenUrl` so the form can round-trip
 * the field the operator actually typed.
 */
export interface Auth0M2MConfig {
  readonly clientId: string;
  readonly tokenUrl: string;
  readonly audience?: string;
  readonly scope?: string;
  readonly tokenRequestFormat: TokenRequestFormat;
  /** Always {@link AUTH0_M2M_PROVIDER} on credentials created by the Auth0 form. */
  readonly provider?: string;
  /** Auth0 tenant domain the token endpoint was derived from. */
  readonly domain?: string;
}

export type TokenRequestFormat = "FORM" | "JSON";

/**
 * Logo sources for a credential type. Any image URL works — SVG, PNG, local
 * asset or remote — because logos render through a plain <img>.
 *
 * Provide `light`/`dark` when the mark needs different ink per theme, or just
 * `default` when one asset reads correctly on both (most brand marks do).
 * Missing entries fall back: theme-specific → default → the built-in key mark.
 */
export interface CredentialLogo {
  /** Used when the app is in light theme. */
  readonly light?: string;
  /** Used when the app is in dark theme. */
  readonly dark?: string;
  /** Theme-agnostic asset, and the fallback for whichever theme is missing. */
  readonly default?: string;
}

export interface CredentialTypeDescriptor {
  readonly id: CredentialTypeId;
  readonly nameKey: string;
  readonly descriptionKey: string;
  /** False until the backend supports the type — shown but not selectable. */
  readonly available: boolean;
  /**
   * Whether the credential can be verified without a business call. A token
   * grant can be exercised on its own; a bare API key or bearer token has
   * nothing to exercise until some endpoint is chosen, so those types offer no
   * test at all rather than a button that can't mean anything.
   */
  readonly supportsTest: boolean;
  /** Omit to fall back to {@link DEFAULT_CREDENTIAL_LOGO}. */
  readonly logo?: CredentialLogo;
}

/** Neutral key mark (PNG) used when a type ships no logo of its own. */
export const DEFAULT_CREDENTIAL_LOGO: CredentialLogo = {
  default: "/credential-logos/credential-default.png",
};

/**
 * Collapses a logo to the two sources the renderer needs. When both come out
 * equal the caller can render a single <img> instead of a light/dark pair.
 */
export function resolveCredentialLogo(logo?: CredentialLogo): {
  lightSrc: string;
  darkSrc: string;
} {
  const fallback =
    logo?.default ??
    DEFAULT_CREDENTIAL_LOGO.default ??
    DEFAULT_CREDENTIAL_LOGO.light ??
    "";
  return {
    lightSrc: logo?.light ?? fallback,
    darkSrc: logo?.dark ?? fallback,
  };
}

/**
 * Catalog backing the "Add credential" type picker. Azure Entra ships first
 * because it is what the first outbound integration needs.
 */
export const CREDENTIAL_TYPES: readonly CredentialTypeDescriptor[] = [
  {
    id: "AZURE_ENTRA_CLIENT_CREDENTIALS",
    nameKey: "types.azureEntra.name",
    descriptionKey: "types.azureEntra.description",
    available: true,
    supportsTest: true,
    // Brand mark reads on both themes, so one asset covers light and dark.
    logo: { default: "/credential-logos/azure-entra.svg" },
  },
  {
    id: "OAUTH2_CLIENT_CREDENTIALS",
    nameKey: "types.oauth2.name",
    descriptionKey: "types.oauth2.description",
    available: true,
    supportsTest: true,
    // Monochrome mark, so it needs per-theme ink.
    logo: {
      light: "/credential-logos/oauth2-light.svg",
      dark: "/credential-logos/oauth2-dark.svg",
    },
  },
  {
    id: "AUTH0_M2M",
    nameKey: "types.auth0M2M.name",
    descriptionKey: "types.auth0M2M.description",
    available: true,
    supportsTest: true,
    // Monochrome mark, so it needs per-theme ink.
    logo: {
      light: "/credential-logos/auth0-light.svg",
      dark: "/credential-logos/auth0-dark.svg",
    },
  },
  {
    id: "API_KEY",
    nameKey: "types.apiKey.name",
    descriptionKey: "types.apiKey.description",
    available: false,
    supportsTest: false,
  },
  {
    id: "BEARER_TOKEN",
    nameKey: "types.bearer.name",
    descriptionKey: "types.bearer.description",
    available: false,
    supportsTest: false,
  },
  {
    id: "BASIC_AUTH",
    nameKey: "types.basic.name",
    descriptionKey: "types.basic.description",
    available: false,
    supportsTest: false,
  },
];

/** Types whose credentials can be verified on their own. */
export function credentialTypeSupportsTest(typeId: CredentialTypeId): boolean {
  return findCredentialType(typeId)?.supportsTest ?? false;
}

export function findCredentialType(
  typeId: CredentialTypeId
): CredentialTypeDescriptor | undefined {
  return CREDENTIAL_TYPES.find((type) => type.id === typeId);
}

/**
 * Seeded environments. These have translated labels and fixed badge colours;
 * anything a user creates is shown verbatim.
 */
export const BUILT_IN_ENVIRONMENTS: readonly string[] = [
  "DEVELOPMENT",
  "QA",
  "PRODUCTION",
];

export function isBuiltInEnvironment(value: string): boolean {
  return BUILT_IN_ENVIRONMENTS.includes(value);
}

/** Trims and collapses inner whitespace; the value is otherwise kept as typed. */
export function normalizeEnvironment(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * The environment options offered by the picker: the seeded ones first, then
 * whatever already exists on other credentials, deduped case-insensitively so
 * typing "qa" doesn't create a twin of "QA".
 */
export function mergeEnvironments(
  ...groups: readonly (readonly string[])[]
): string[] {
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const raw of group) {
      const value = normalizeEnvironment(raw);
      if (!value) continue;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
  }
  return [...seen.values()];
}

/**
 * Matches a typed value against existing options, case-insensitively, so the
 * caller can reuse an existing environment instead of creating a near-duplicate.
 */
export function matchEnvironment(
  value: string,
  options: readonly string[]
): string | undefined {
  const key = normalizeEnvironment(value).toLowerCase();
  return options.find((option) => option.toLowerCase() === key);
}

/** Microsoft's v2.0 token endpoint for a directory (tenant). */
export const ENTRA_LOGIN_HOST = "https://login.microsoftonline.com";

export function buildEntraTokenUrl(tenantId: string): string {
  const tenant = tenantId.trim() || "{tenant-id}";
  return `${ENTRA_LOGIN_HOST}/${tenant}/oauth2/v2.0/token`;
}

/** Shows enough of an identifier to recognize it, never the whole value. */
export function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

export const AzureEntraCredentialSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100),
  environment: z
    .string()
    .min(1, "validation.environmentRequired")
    .max(40, "validation.environmentTooLong"),
  tenantId: z.string().min(1, "validation.tenantIdRequired"),
  clientId: z.string().min(1, "validation.clientIdRequired"),
  clientSecret: z.string().min(1, "validation.clientSecretRequired"),
  scope: z.string().min(1, "validation.scopeRequired"),
  tokenRequestFormat: z.enum(["FORM", "JSON"]),
  tokenUrlOverride: z
    .string()
    .url("validation.tokenUrlInvalid")
    .optional()
    .or(z.literal("")),
});

/** On edit the secret may be left blank to keep the stored one. */
export const AzureEntraCredentialEditSchema = AzureEntraCredentialSchema.extend(
  {
    clientSecret: z.string().optional(),
  }
);

export type AzureEntraFormData = z.infer<typeof AzureEntraCredentialSchema>;

/**
 * Generic OAuth2 client-credentials form.
 *
 * `scope` is optional here where Entra requires it: Entra rejects a grant with
 * no scope, but Auth0 derives permissions from the audience and is happy
 * without one, so demanding it would block the case this form exists for.
 */
export const OAuth2CredentialSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100),
  environment: z
    .string()
    .min(1, "validation.environmentRequired")
    .max(40, "validation.environmentTooLong"),
  tokenUrl: z
    .string()
    .min(1, "validation.tokenUrlRequired")
    .url("validation.tokenUrlInvalid"),
  clientId: z.string().min(1, "validation.oauth2ClientIdRequired"),
  clientSecret: z.string().min(1, "validation.clientSecretRequired"),
  audience: z.string().optional(),
  scope: z.string().optional(),
  tokenRequestFormat: z.enum(["FORM", "JSON"]),
});

/** On edit the secret may be left blank to keep the stored one. */
export const OAuth2CredentialEditSchema = OAuth2CredentialSchema.extend({
  clientSecret: z.string().optional(),
});

export type OAuth2FormData = z.infer<typeof OAuth2CredentialSchema>;

/**
 * Marks a generic OAuth2 credential profile as one the Auth0 form created.
 * Lives in `publicConfig` because the backend has no Auth0 auth type — see
 * {@link Auth0M2MConfig}.
 */
export const AUTH0_M2M_PROVIDER = "auth0";

/**
 * Auth0's token endpoint is always `/oauth/token` on the tenant domain, so the
 * form asks for the domain and derives the URL — same trade the Entra form
 * makes with the directory id. Deployments that front Auth0 with a proxy (ours
 * does, at `api.microboxlabs.com/api/v1/login`) state the endpoint outright via
 * `tokenUrlOverride` instead.
 */
export function buildAuth0TokenUrl(domain: string): string {
  let host = domain.trim().replace(/^https?:\/\//i, "");
  let hostEnd = host.length;
  while (hostEnd > 0 && host[hostEnd - 1] === "/") {
    hostEnd -= 1;
  }
  host = host.slice(0, hostEnd);
  return `https://${host || "{your-tenant}.auth0.com"}/oauth/token`;
}

/**
 * Auth0 machine-to-machine form.
 *
 * `audience` is required here where the generic OAuth2 form leaves it optional:
 * without an API identifier Auth0 issues an opaque token that the target API
 * cannot validate, so a credential saved without one is guaranteed broken. That
 * guarantee is most of the reason this preset exists.
 */
export const Auth0M2MCredentialSchema = z.object({
  name: z.string().min(1, "validation.nameRequired").max(100),
  environment: z
    .string()
    .min(1, "validation.environmentRequired")
    .max(40, "validation.environmentTooLong"),
  domain: z.string().min(1, "validation.auth0DomainRequired"),
  clientId: z.string().min(1, "validation.auth0ClientIdRequired"),
  clientSecret: z.string().min(1, "validation.clientSecretRequired"),
  audience: z.string().min(1, "validation.auth0AudienceRequired"),
  scope: z.string().optional(),
  tokenRequestFormat: z.enum(["FORM", "JSON"]),
  tokenUrlOverride: z
    .string()
    .url("validation.tokenUrlInvalid")
    .optional()
    .or(z.literal("")),
});

/** On edit the secret may be left blank to keep the stored one. */
export const Auth0M2MCredentialEditSchema = Auth0M2MCredentialSchema.extend({
  clientSecret: z.string().optional(),
});

export type Auth0M2MFormData = z.infer<typeof Auth0M2MCredentialSchema>;

/**
 * Any credential form's data. The list/create/update paths are type-agnostic —
 * they carry the payload to the API and let the per-type `toPublicConfig`
 * branch decide its shape.
 */
export type CredentialFormData =
  | AzureEntraFormData
  | OAuth2FormData
  | Auth0M2MFormData;

export interface CredentialTestResult {
  readonly success: boolean;
  readonly message: string;
  /** Token lifetime reported by the provider, when the test obtained one. */
  readonly expiresInSeconds?: number;
}
