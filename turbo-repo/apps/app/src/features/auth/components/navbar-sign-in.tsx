import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";

interface NavbarSignInProps {
  /** Organization logo as base64 data URL; if provided, shown instead of default logo */
  orgLogoUrl?: string | null;
}

export default function NavbarSignIn({ orgLogoUrl }: NavbarSignInProps = {}) {
  return (
    <div className="w-full h-fit">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand data-testid="login-navbar" href="https://www.mintral.cl/">
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
