"use client";

import { useEffect, useState } from "react";
import { HiOfficeBuilding } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import OrgListPanel from "./org-list-panel";
import OrgDetailPanel from "./org-detail-panel";

interface OrganizationsPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Organizations.
 *
 * All members can inspect their organization roster. Owners additionally
 * receive the application-role, permission, and integration controls.
 */
export default function OrganizationsPageContent({
  dict,
  lang,
}: OrganizationsPageContentProps) {
  const { activeOrg, availableOrgs, isLoading, error } = useOrgScopes();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Default the selection to the active org once scopes load.
  useEffect(() => {
    if (selectedSlug) return;
    if (activeOrg) setSelectedSlug(activeOrg.slug);
  }, [activeOrg, selectedSlug]);

  const orgsDict = dict?.organizations as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const selectedOrganization =
    availableOrgs.find((org) => org.slug === selectedSlug) ?? null;

  return (
    // Same shell as Settings > Credentials / Data sources / Connections: a
    // full-width breadcrumb bar (outside the scroll container, so it never
    // moves — including during rubber-band overscroll) above a capped
    // content column, whose list/detail panels scroll internally.
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "organizations"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-4 px-4 pt-2 pb-6 min-h-0 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <HiOfficeBuilding className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", orgsDict)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", orgsDict)}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {tr("loadError", orgsDict)}
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
          <OrgListPanel
            orgs={availableOrgs}
            isLoading={isLoading}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            dict={orgsDict}
          />
          <OrgDetailPanel organization={selectedOrganization} dict={orgsDict} />
        </div>
      </div>
    </div>
  );
}
