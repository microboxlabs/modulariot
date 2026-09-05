import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";
import DomainLogo from "@/features/branding/domain-logo";

interface NavbarSignInProps {
  /** Per-domain logo URL; if provided, shown instead of the default logo */
  orgLogoUrl?: string | null;
  /** Dark-background variant; null uses the light one on both grounds */
  orgLogoUrlDark?: string | null;
  /** Where the brand links to; unlinked when the domain configures no home URL */
  homeUrl?: string | null;
}

export default function NavbarSignIn({
  orgLogoUrl,
  orgLogoUrlDark,
  homeUrl,
}: NavbarSignInProps = {}) {
  return (
    <div className="w-full h-fit dark:bg-gray-800">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand data-testid="login-navbar" href={homeUrl ?? undefined}>
          {orgLogoUrl ? (
            <DomainLogo logoUrl={orgLogoUrl} logoUrlDark={orgLogoUrlDark} />
          ) : (
            <AppLogo />
          )}
        </NavbarBrand>
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
