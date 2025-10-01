import { Navbar, NavbarBrand } from "flowbite-react";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import AppLogo from "@/features/common/components/app-logo/app-logo";

export default function TotemNavbar() {
  return (
    <div className="w-full h-fit">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand
          data-testid="login-navbar"
          href="https://www.mintral.cl/"
        ></NavbarBrand>

        <AppLogo />
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
