import { Navbar, NavbarBrand } from "flowbite-react";
import Image from "next/image";
// eslint-disable-next-line import/no-unresolved
import logoImage from "@assets/logo-mintral-1.png";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";

export default function TotemNavbar() {
  return (
    <div className="w-full h-fit">
      <Navbar fluid className="dark:bg-transparent">
        <NavbarBrand
          data-testid="login-navbar"
          href="https://www.mintral.cl/"
        ></NavbarBrand>

        <Image
          src={logoImage}
          className="mr-3"
          alt="Logo Mintral"
          width={150}
        />
        <CustomThemeToggle />
      </Navbar>
    </div>
  );
}
