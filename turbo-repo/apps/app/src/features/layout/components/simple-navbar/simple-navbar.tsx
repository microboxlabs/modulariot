import "server-only";

import { Navbar, NavbarBrand, Tooltip } from "flowbite-react";
import Link from "next/link";
import { LynxBrand } from "@modulariot/ui/brand/logo";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import { getPublicOrgLogo } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function SimpleNavbar() {
  // Try to get the organization logo from the public endpoint
  const orgLogo = await getPublicOrgLogo();

  return (
    <Navbar
      fluid
      className="fixed h-16 top-0 z-30 w-full border-b border-gray-200 bg-white p-0 sm:p-0 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="w-full p-3 pr-4">
        <div className="flex items-center">
          <div className="flex items-start justify-start flex-1">
            <Link href="https://www.mintral.cl/" className="flex items-center">
              {orgLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className="mr-3 h-8"
                  alt="Organization logo"
                  src={orgLogo}
                  width={150}
                />
              ) : (
                <LynxBrand
                  className="mr-3 text-(--brand-ink)"
                  iconClassName="h-11 w-11"
                  wordmarkClassName="h-5 w-auto"
                />
              )}
            </Link>
          </div>
          <div className="flex items-center justify-end flex-1 lg:gap-3">
            <div className="flex items-center">
              <div className="hidden dark:block">
                <Tooltip content="Toggle light mode">
                  <CustomThemeToggle />
                </Tooltip>
              </div>
              <div className="dark:hidden">
                <Tooltip content="Toggle dark mode">
                  <CustomThemeToggle />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Navbar>
  );
}
