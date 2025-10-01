import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";

export default function NavbarSignIn() {
  return (
    <div className="w-full h-fit">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand data-testid="login-navbar" href="https://www.mintral.cl/">
          <AppLogo />
        </NavbarBrand>
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
