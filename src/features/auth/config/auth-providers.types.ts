import { z } from "zod";

/**
 * Supported authentication provider types
 */
export const AuthProviderType = {
  OAUTH: "oauth",
  CREDENTIALS: "credentials",
  SAML: "saml",
  OIDC: "oidc",
} as const;

export type AuthProviderType =
  (typeof AuthProviderType)[keyof typeof AuthProviderType];

/**
 * Supported OAuth provider identifiers
 */
export const OAuthProviderId = {
  GOOGLE: "google",
  GITHUB: "github",
  MICROSOFT: "microsoft-entra-id",
} as const;

export type OAuthProviderId = (typeof OAuthProviderId)[keyof typeof OAuthProviderId];

/**
 * Supported icon identifiers for login buttons
 */
export const AuthProviderIcon = {
  GOOGLE: "google",
  GITHUB: "github",
  MICROSOFT: "microsoft",
  USER: "user",
  KEY: "key",
  SAML: "saml",
} as const;

export type AuthProviderIcon =
  (typeof AuthProviderIcon)[keyof typeof AuthProviderIcon];

/**
 * Schema for a single auth provider configuration
 */
export const authProviderSchema = z.object({
  /** Unique identifier for the provider */
  id: z.string(),
  /** Display name shown on the login button */
  name: z.string(),
  /** Type of authentication */
  type: z.enum(["oauth", "credentials", "saml", "oidc"]),
  /** OAuth provider identifier (for oauth type) */
  provider: z.string().optional(),
  /** Icon to display on the button */
  icon: z.enum(["google", "github", "microsoft", "user", "key", "saml"]).optional(),
  /** Whether this is the primary/highlighted button */
  primary: z.boolean().optional(),
  /** Whether team slug input is required (for SAML) */
  teamSlugRequired: z.boolean().optional(),
});

export type AuthProviderConfig = z.infer<typeof authProviderSchema>;

/**
 * Schema for the complete auth configuration
 */
export const authConfigSchema = z.object({
  /** List of authentication providers to display */
  providers: z.array(authProviderSchema).min(1),
  /** Text to show in the divider between provider groups */
  dividerText: z.string().optional(),
  /** Label for team slug input (SAML) */
  teamSlugLabel: z.string().optional(),
  /** Placeholder for team slug input (SAML) */
  teamSlugPlaceholder: z.string().optional(),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

/**
 * Default configuration matching current Mintral setup
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  providers: [
    {
      id: "microsoft-entra-id",
      name: "pages.login.buttons.continueWithMicrosoft",
      type: "oauth",
      provider: "microsoft-entra-id",
      icon: "microsoft",
      primary: true,
    },
    {
      id: "credentials",
      name: "pages.login.buttons.continueWithEmail",
      type: "credentials",
      icon: "user",
    },
  ],
  dividerText: "o",
};
