import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";

interface NavbarSignInProps {
  /** Per-domain logo URL; if provided, shown instead of the default logo */
  orgLogoUrl?: string | null;
  /** Where the brand links to; unlinked when the domain configures no home URL */
  homeUrl?: string | null;
}

export default function NavbarSignIn({
  orgLogoUrl,
  homeUrl,
}: NavbarSignInProps = {}) {
  return (
    <div className="w-full h-fit dark:bg-gray-800">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand data-testid="login-navbar" href={homeUrl ?? undefined}>
          {orgLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="mr-3 h-8"
              alt="Organization logo"
              src={orgLogoUrl}
              width={150}
            />
          ) : (
            <AppLogo />
          )}
        </NavbarBrand>
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
