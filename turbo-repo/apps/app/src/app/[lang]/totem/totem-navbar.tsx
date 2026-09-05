import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";
import DomainLogo from "@/features/branding/domain-logo";

interface TotemNavbarProps {
  readonly orgLogoUrl?: string | null;
  readonly orgLogoUrlDark?: string | null;
  readonly homeUrl?: string | null;
}

export default function TotemNavbar({
  orgLogoUrl,
  orgLogoUrlDark,
  homeUrl,
}: Readonly<TotemNavbarProps>) {
  return (
    <div className="w-full h-fit">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand data-testid="login-navbar" href={homeUrl ?? undefined}>
          {orgLogoUrl ? (
            <DomainLogo
              logoUrl={orgLogoUrl}
              logoUrlDark={orgLogoUrlDark}
              testId="org-logo"
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
