import { logger } from "@/lib/logger";
import {
  AuthConfig,
  AuthProviderConfig,
  AuthProviderIcon,
  authConfigSchema,
  DEFAULT_AUTH_CONFIG,
} from "./auth-providers.types";

/**
 * Provider metadata mapping - derives type, icon from provider id
 */
const PROVIDER_METADATA: Record<
  string,
  { type: AuthProviderConfig["type"]; icon: AuthProviderIcon; teamSlugRequired?: boolean }
> = {
  google: { type: "oauth", icon: "google" },
  github: { type: "oauth", icon: "github" },
  microsoft: { type: "oauth", icon: "microsoft" },
  "microsoft-entra-id": { type: "oauth", icon: "microsoft" },
  saml: { type: "saml", icon: "saml", teamSlugRequired: true },
  credentials: { type: "credentials", icon: "user" },
};

/**
 * Parses simplified provider string format.
 * Format: "google,github*,saml" where * marks primary providers
 * 
 * @param configStr - Comma-separated provider list (e.g., "google*,github,saml")
 * @returns Parsed AuthConfig or null if invalid
 */
function parseSimplifiedConfig(configStr: string): AuthConfig | null {
  const providerStrings = configStr.split(",").map((s) => s.trim()).filter(Boolean);
  
  if (providerStrings.length === 0) {
    return null;
  }

  const providers: AuthProviderConfig[] = providerStrings.map((str) => {
    const isPrimary = str.endsWith("*");
    const id = isPrimary ? str.slice(0, -1) : str;
    const metadata = PROVIDER_METADATA[id];

    if (!metadata) {
      logger.warn(`Unknown provider: ${id}, using oauth defaults`);
    }

    return {
      id,
      // i18n key - will be resolved at render time
      name: `pages.login.buttons.${id}`,
      type: metadata?.type ?? "oauth",
      provider: id,
      icon: metadata?.icon ?? "key",
      primary: isPrimary,
      teamSlugRequired: metadata?.teamSlugRequired,
    };
  });

  return {
    providers,
    // Divider text from i18n
    dividerText: "pages.login.divider",
    teamSlugLabel: "pages.login.teamSlug.label",
    teamSlugPlaceholder: "pages.login.teamSlug.placeholder",
  };
}

/**
 * Loads auth configuration from environment variable.
 * Supports both simplified format (comma-separated) and legacy JSON format.
 * Falls back to default config if not set or invalid.
 */
function loadFromEnv(): AuthConfig | null {
  // Try new simplified format first
  const simplifiedConfig = process.env.AUTH_PROVIDERS;
  if (simplifiedConfig) {
    const parsed = parseSimplifiedConfig(simplifiedConfig);
    if (parsed) {
      logger.debug("Auth config loaded from AUTH_PROVIDERS env var (simplified format)");
      return parsed;
    }
  }

  // Fall back to legacy JSON format
  const legacyConfig = process.env.AUTH_PROVIDERS_CONFIG;
  if (legacyConfig) {
    try {
      const parsed: unknown = JSON.parse(legacyConfig);
      const validated = authConfigSchema.parse(parsed);
      logger.debug("Auth config loaded from AUTH_PROVIDERS_CONFIG env var (legacy JSON format)");
      return validated;
    } catch (error) {
      logger.warn(
        { error },
        "Failed to parse AUTH_PROVIDERS_CONFIG, falling back to default"
      );
    }
  }

  return null;
}

/**
 * Gets the auth configuration for the application.
 * Priority: AUTH_PROVIDERS (simplified) > AUTH_PROVIDERS_CONFIG (JSON) > Default config
 *
 * @returns The auth configuration to use
 */
export function getAuthConfig(): AuthConfig {
  // Try loading from environment variable first
  const envConfig = loadFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // Fall back to default configuration
  logger.debug("Using default auth configuration");
  return DEFAULT_AUTH_CONFIG;
}

/**
 * Checks if a specific provider type is enabled in the current config
 */
export function isProviderEnabled(
  config: AuthConfig,
  providerId: string
): boolean {
  return config.providers.some((p) => p.id === providerId);
}

/**
 * Gets the primary provider from the config (if any)
 */
export function getPrimaryProvider(config: AuthConfig) {
  return config.providers.find((p) => p.primary);
}

/**
 * Gets primary providers from the config (can be multiple)
 */
export function getPrimaryProviders(config: AuthConfig) {
  return config.providers.filter((p) => p.primary);
}

/**
 * Gets secondary providers (non-primary) from the config
 */
export function getSecondaryProviders(config: AuthConfig) {
  return config.providers.filter((p) => !p.primary);
}
