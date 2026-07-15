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
  /** Card title for the SSO (team identifier) view */
  ssoTitle: string;
  /** Card description for the SSO (team identifier) view */
  ssoSubtitle: string;
  /** Submit button label for the SSO (team identifier) view */
  ssoSubmitLabel: string;
};

/**
 * Messages for the register ("request access") wizard.
 * 3 steps: organization -> profile -> verification. Each step drives the
 * card's main heading (title + subtitle), which swaps as the user moves
 * between steps — there's no separate static card title.
 */
export type RegisterFormMessages = {
  /** Main heading while on the organization step */
  stepOrganizationTitle: string;
  /** Subtitle under the heading while on the organization step */
  stepOrganizationSubtitle: string;
  organizationNameLabel: string;
  organizationNamePlaceholder: string;
  teamNameLabel: string;
  teamNamePlaceholder: string;
  /** Suffix shown next to the team name label, e.g. "(SSO)" */
  teamNameSsoLabel: string;
  /** Tooltip shown on hover over the invalid-state (X) icon, explaining the slug format rule */
  teamNameInvalidMessage: string;
  organizationLocationLabel: string;
  /** Shown in the location dropdown's trigger button before a country is picked */
  organizationLocationPlaceholder: string;
  /** Shown in the location dropdown when no country matches the typed search text */
  organizationLocationNoResults: string;
  organizationPhoneLabel: string;
  organizationPhonePlaceholder: string;
  organizationSizeLabel: string;
  industryLabel: string;
  /** Placeholder for the free-text field shown when the "Otro" industry badge is selected */
  industryOtherPlaceholder: string;
  monitoringInterestLabel: string;
  /** Placeholder for the free-text field shown when the "Otros" monitoring-interest badge is selected */
  monitoringInterestOtherPlaceholder: string;
  /** Suffix shown next to optional field labels, e.g. "(optional)" */
  optionalLabel: string;

  /** Main heading while on the profile step */
  stepProfileTitle: string;
  /** Subtitle under the heading while on the profile step */
  stepProfileSubtitle: string;
  /** "Create account with" label above the OAuth provider buttons */
  createAccountWithLabel: string;
  /** Divider text between the OAuth buttons and the manual fields (same as sign-in's) */
  dividerText: string;
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;

  /** Main heading while on the verification step */
  stepVerificationTitle: string;
  /** The verification step's only description — shown in the panel below the
   * heading, not duplicated as a header subtitle like the other steps */
  verificationMessage: string;
  /** "Send verification email" button label */
  verifyEmailLabel: string;

  /** "Next" button label, shown on every step but the last */
  nextLabel: string;
  /** "Back" button label, shown on every step */
  backLabel: string;
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
  /** Switches the parent card to the register view (?view=register), no page navigation */
  onRegisterClick: () => void;
  /** Whether to show the "Sign up" / request-access link, resolved
   * server-side from ENABLE_REGISTER_LINK. */
  showRegisterLink: boolean;
}>;
