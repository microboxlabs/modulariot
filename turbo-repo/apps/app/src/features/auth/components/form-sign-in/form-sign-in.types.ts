import type { AuthConfig } from "../../config/auth-providers.types";

export type FormSignInMessages = {
  emailPlaceHolder: string;
  emailLabel: string;
  passwordLabel: string;
  rememberMeLabel: string;
  forgotPasswordLabel: string;
  buttonSubmitLabel: string;
  invalidCredentials: string;
  invalidFromData: string;
  /** @deprecated Use authConfig.providers[].name instead */
  buttonContinueWithMicrosoft: string;
  /** @deprecated Use authConfig.providers[].name instead */
  buttonContinueWithEmail: string;
  /** "¿No tienes cuenta?" prompt shown before the request-access link */
  requestAccessPrompt: string;
  /** "Solicitar acceso" link that switches the card to the register view */
  requestAccessLink: string;
  /** Card title for the main (provider buttons) view */
  mainTitle: string;
  /** Card description for the main (provider buttons) view */
  mainSubtitle: string;
  /** Card title for the credentials (email/password) view */
  loginTitle: string;
  /** Card description for the credentials (email/password) view */
  loginSubtitle: string;
};

/** Messages for the register ("request access") view */
export type RegisterFormMessages = {
  /** Card title for the register view */
  title: string;
  /** Card description for the register view */
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  lastnameLabel: string;
  lastnamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  submitLabel: string;
  passwordMismatchError: string;
  backToLoginLabel: string;
};

/** Pre-computed labels for each provider (by provider id) */
export type ProviderLabels = Record<string, string>;

/** SAML-specific labels */
export type SamlLabels = Readonly<{
  /** Label for team slug input */
  teamSlugLabel: string;
  /** Placeholder for team slug input */
  teamSlugPlaceholder: string;
  /** Error message when team slug is required but empty */
  teamSlugRequired: string;
}>;

export type FormSignInProps = Readonly<{
  messages: FormSignInMessages;
  /** Messages for the register ("request access") view */
  registerMessages: RegisterFormMessages;
  /** Auth providers configuration */
  authConfig: AuthConfig;
  /** Pre-computed labels for each provider */
  providerLabels: ProviderLabels;
  /** Translated divider text (e.g. "o") – shown without lines between button and secondary link */
  dividerText: string;
  /** SAML-specific labels (only needed if SAML provider is configured) */
  samlLabels?: SamlLabels;
  /** Post-sign-in destination (e.g. the CLI auth handoff page), passed
   * down from the page's searchParams so the client component doesn't
   * need useSearchParams (which requires a Suspense boundary). */
  callbackUrl?: string | null;
}>;
