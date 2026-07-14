import type { PropsWithChildren } from "react";
import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import FooterSignIn from "@/features/auth/components/footer-sign-in/footer-sign-in";
import type { FooterSignInProps } from "@/features/auth/components/footer-sign-in/footer-sign-in.types";

type AuthPageShellProps = PropsWithChildren<{
  /** Organization logo as base64 data URL; if provided, shown instead of default logo */
  orgLogoUrl?: string | null;
  footerMessages: FooterSignInProps["messages"];
  /** Tailwind max-width class for the centered content, e.g. "md:max-w-lg" (default) or "md:max-w-3xl" for wider flows like the register wizard */
  maxWidthClassName?: string;
}>;

/**
 * Shared navbar/content/footer chrome for auth pages (sign-in, register, ...),
 * so every scene the user can land on looks and feels the same. The
 * centered content itself (login card, register card, ...) is left to
 * each page since it differs and is still evolving.
 */
export default function AuthPageShell({
  orgLogoUrl,
  footerMessages,
  children,
}: Readonly<AuthPageShellProps>) {
  return (
    <div className="mx-auto flex flex-col md:h-screen bg-gray-50 dark:bg-gray-900">
      <NavbarSignIn orgLogoUrl={orgLogoUrl} />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full md:max-w-lg">{children}</div>
      </div>
      <FooterSignIn messages={footerMessages} />
    </div>
  );
}
