import { Navbar, NavbarBrand } from "flowbite-react";
import Image from "next/image";
// eslint-disable-next-line import/no-unresolved
import logoImage from "@assets/logo-mintral-1.png";

export default function NavbarSignIn() {
  return (
    <div className="min-h-8 mb-8">
      <Navbar fluid>
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
      </Navbar>
    </div>
  );
}
