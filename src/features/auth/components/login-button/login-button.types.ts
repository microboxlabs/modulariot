import type { AuthProviderConfig } from "../../config/auth-providers.types";

export type LoginButtonProps = Readonly<{
  /** Provider configuration */
  provider: AuthProviderConfig;
  /** Translated label text */
  label: string;
  /** Click handler for the button */
  onClick?: () => void;
  /** Form action for server actions */
  formAction?: () => Promise<void>;
  /** Whether the button is in loading state */
  isLoading?: boolean;
  /** Whether this button should be rendered as primary */
  isPrimary?: boolean;
}>;
