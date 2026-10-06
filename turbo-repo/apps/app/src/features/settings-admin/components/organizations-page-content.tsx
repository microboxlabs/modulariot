"use client";

import { useEffect, useState } from "react";
import { Button } from "flowbite-react";
import { HiOfficeBuilding, HiPlus } from "react-icons/hi";
import { mutate } from "swr";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useIsPlatformOwner } from "../platform/use-platform-membership";
import { usePlatformOrganizations } from "../platform/use-platform-organizations";
import OrganizationsSection from "../platform/organizations-section";
import { NO_ORGANIZATION_GATE_KEY } from "../team/no-organization-gate";
import type { PlatformOrganizationListItem } from "../platform/platform.types";
import type { OrgSummary } from "../types";
import OrgListPanel from "./org-list-panel";
import OrgDetailPanel from "./org-detail-panel";
import PlatformOrgListPanel from "./platform-org-list-panel";
import PlatformOrgDetailPanel from "./platform-org-detail-panel";

interface OrganizationsPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** The scopes route answers 403 to someone who belongs to no organization. */
function isNoOrganization(error: unknown): boolean {
  return error instanceof Error && error.message.includes("403");
}

/** Platform-wide organizations the caller is not a member of. */
function othersThan(
  all: PlatformOrganizationListItem[],
  mine: OrgSummary[]
): PlatformOrganizationListItem[] {
  const memberOf = new Set(mine.map((org) => org.slug));
  return all.filter((org) => !memberOf.has(org.slug));
}

/**
 * Settings › Organizations.
 *
 * All members can inspect their organization roster. Owners additionally
 * receive the application-role, permission, and integration controls. A
 * platform owner also sees every other organization, read-only, and creates
 * new ones here.
 */
export default function OrganizationsPageContent({
  dict,
  lang,
}: OrganizationsPageContentProps) {
  const {
    activeOrg,
    availableOrgs,
    isLoading,
    error: scopesError,
    refresh,
  } = useOrgScopes();
  // Belonging to no organization is a state, not a failure.
  const noOrganization = isNoOrganization(scopesError);
  const error = noOrganization ? undefined : scopesError;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const select = (slug: string) => {
    setCreating(false);
    setSelectedSlug(slug);
  };

  const created = (slug: string) => {
    void refresh();
    // The caller may have named themselves owner: the gate must look again.
    void mutate(NO_ORGANIZATION_GATE_KEY);
    select(slug);
  };

  // Default the selection to the active org once scopes load.
  useEffect(() => {
    if (selectedSlug) return;
    if (activeOrg) setSelectedSlug(activeOrg.slug);
  }, [activeOrg, selectedSlug]);

  const orgsDict = dict?.organizations as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const selectedOrganization =
    availableOrgs.find((org) => org.slug === selectedSlug) ?? null;

  const { isPlatformOwner } = useIsPlatformOwner();
  const { organizations: platformOrgs, error: platformOrgsError } =
    usePlatformOrganizations(isPlatformOwner);
  // Until the caller's own organizations are known, every one would look foreign.
  const scopesKnown = !isLoading && !error;
  const otherOrgs = scopesKnown ? othersThan(platformOrgs, availableOrgs) : [];
  const selectedOtherOrg =
    otherOrgs.find((org) => org.slug === selectedSlug) ?? null;

  const detail = () => {
    if (creating) {
      return (
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <OrganizationsSection
            dict={(dict?.platform as I18nRecord)?.organizations as I18nRecord}
            onCreated={created}
          />
        </div>
      );
    }
    if (selectedOtherOrg) {
      return (
        <PlatformOrgDetailPanel
          organization={selectedOtherOrg}
          dict={orgsDict}
        />
      );
    }
    return (
      <OrgDetailPanel
        organization={selectedOrganization}
        dict={orgsDict}
        credentialsDict={dict?.credentials as I18nRecord}
      />
    );
  };

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
        <div className="flex items-center justify-between gap-3">
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
          {isPlatformOwner && (
            <Button size="sm" color="blue" onClick={() => setCreating(true)}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newOrganization", orgsDict)}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {tr("loadError", orgsDict)}
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
          <div className="grid min-h-0 content-start gap-4 overflow-y-auto">
            <OrgListPanel
              orgs={availableOrgs}
              isLoading={isLoading}
              selectedSlug={creating ? null : selectedSlug}
              onSelect={select}
              dict={orgsDict}
            />
            <PlatformOrgListPanel
              orgs={otherOrgs}
              failed={platformOrgsError !== undefined}
              selectedSlug={creating ? null : selectedSlug}
              onSelect={select}
              dict={orgsDict}
            />
          </div>
          {detail()}
        </div>
      </div>
    </div>
  );
}
