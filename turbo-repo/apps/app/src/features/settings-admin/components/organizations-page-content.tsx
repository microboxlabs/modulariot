"use client";

import { useEffect, useState } from "react";
import { HiOfficeBuilding } from "react-icons/hi";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import OrgListPanel from "./org-list-panel";
import OrgDetailPanel from "./org-detail-panel";

interface OrganizationsPageContentProps {
  readonly dict: I18nRecord;
}

/**
 * Settings › Organizations — Phase 3 read-only view.
 *
 * Two-column layout:
 *  - Left: list of orgs the user can see (from /api/user/scopes)
 *  - Right: selected org's members + modules (from /api/admin/orgs/{id}/*)
 *
 * Defaults to the active org from the top-nav scope on first render.
 * Write flows (create sub-account, add member, toggle modules) land in
 * Phase 5.
 */
export default function OrganizationsPageContent({
  dict,
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

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <ClientBreadcrumb
        dict={breadcrumbDict}
        path={[
          { label: "user" },
          { label: "settings" },
          { label: "organizations" },
        ]}
      />

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
        <OrgDetailPanel orgSlug={selectedSlug} dict={orgsDict} />
      </div>
    </div>
  );
}
