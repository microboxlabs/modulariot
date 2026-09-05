import "server-only";

import { Navbar, Tooltip } from "flowbite-react";
import Link from "next/link";
import { LynxBrand } from "@modulariot/ui/brand/logo";
import CustomThemeToggle from "@/features/theme/components/CustomThemeToggle";
import { getDomainBranding } from "@/features/branding/domain-branding.service";
import DomainLogo from "@/features/branding/domain-logo";

export async function SimpleNavbar({
  logoAlt,
}: Readonly<{ logoAlt?: string }>) {
  const branding = await getDomainBranding();
  const brand = branding?.logoUrl ? (
    <DomainLogo
      logoUrl={branding.logoUrl}
      logoUrlDark={branding.logoUrlDark}
      alt={logoAlt}
    />
  ) : (
    <LynxBrand
      className="mr-3 text-(--brand-ink)"
      iconClassName="h-11 w-11"
      wordmarkClassName="h-5 w-auto"
    />
  );

  return (
    <Navbar
      fluid
      className="fixed h-16 top-0 z-30 w-full border-b border-gray-200 bg-white p-0 sm:p-0 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="w-full p-3 pr-4">
        <div className="flex items-center">
          <div className="flex items-start justify-start flex-1">
            {branding?.homeUrl ? (
              <Link href={branding.homeUrl} className="flex items-center">
                {brand}
              </Link>
            ) : (
              <span className="flex items-center">{brand}</span>
            )}
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
