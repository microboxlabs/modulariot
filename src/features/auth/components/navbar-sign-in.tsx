import { Navbar, NavbarBrand } from "flowbite-react";
import Image from "next/image";
// eslint-disable-next-line import/no-unresolved
import logoImage from "@assets/logo-mintral-1.png";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";

export default function NavbarSignIn() {
  return (
    <div className="min-h-8 mb-8">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand
          data-testid="login-navbar"
          href="https://flowbite-react.com"
        >
          <Image
            src={logoImage}
            className="mr-3"
            alt="Flowbite React Logo"
            width={150}
          />
        </NavbarBrand>
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
