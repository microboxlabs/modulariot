import type { PropsWithChildren } from "react";
import NavbarSignIn from "@/features/auth/components/navbar-sign-in";
import FooterSignIn from "@/features/auth/components/footer-sign-in/footer-sign-in";
import type { FooterSignInProps } from "@/features/auth/components/footer-sign-in/footer-sign-in.types";

type AuthPageShellProps = PropsWithChildren<{
  /** Per-domain logo URL; if provided, shown instead of the default logo */
  orgLogoUrl?: string | null;
  orgLogoUrlDark?: string | null;
  /** Where the brand links to; unlinked when the domain configures no home URL */
  homeUrl?: string | null;
  footerMessages: FooterSignInProps["messages"];
}>;

/**
 * Shared navbar/content/footer chrome for auth pages (sign-in, ...), so every
 * scene the user can land on looks and feels the same. The centered content
 * itself (login card, ...) is left to each page since it differs.
 */
export default function AuthPageShell({
  orgLogoUrl,
  orgLogoUrlDark,
  homeUrl,
  footerMessages,
  children,
}: Readonly<AuthPageShellProps>) {
  return (
    <div className="mx-auto flex flex-col md:h-screen bg-gray-50 dark:bg-gray-900">
      <NavbarSignIn
        orgLogoUrl={orgLogoUrl}
        orgLogoUrlDark={orgLogoUrlDark}
        homeUrl={homeUrl}
      />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full md:max-w-lg">{children}</div>
      </div>
      <FooterSignIn messages={footerMessages} />
    </div>
  );
}
