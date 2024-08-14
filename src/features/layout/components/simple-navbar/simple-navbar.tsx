import "server-only";

import { DarkThemeToggle, Navbar, NavbarBrand, Tooltip } from "flowbite-react";
import Image from "next/image";
import Link from "next/link";
import logoImage from "@assets/logo-mintral-1.png";

export async function SimpleNavbar() {
  return (
    <Navbar
      fluid
      className="fixed h-16 top-0 z-30 w-full border-b border-gray-200 bg-white p-0 sm:p-0 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="w-full p-3 pr-4">
        <div className="flex items-start">
          <div className="flex items-start justify-start flex-1">
            <NavbarBrand as={Link} href="/">
              <Image className="mr-3 h-8" alt="" src={logoImage} width={150} />
            </NavbarBrand>
          </div>
          <div className="flex items-center justify-end flex-1 lg:gap-3">
            <div className="flex items-center">
              <div className="hidden dark:block">
                <Tooltip content="Toggle light mode">
                  <DarkThemeToggle />
                </Tooltip>
              </div>
              <div className="dark:hidden">
                <Tooltip content="Toggle dark mode">
                  <DarkThemeToggle />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Navbar>
  );
}
