"use client";

import { useEffect, useState } from "react";
import { Button } from "flowbite-react";
import { HiOfficeBuilding, HiPlus } from "react-icons/hi";
import { mutate } from "swr";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { isPlatformScope } from "@/features/common/platform-scope";
import {
  isNoOrganizationError,
  useOrgScopes,
} from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useIsPlatformOwner } from "../platform/use-platform-membership";
import {
  PLATFORM_ORGANIZATIONS_KEY,
  usePlatformOrganizations,
} from "../platform/use-platform-organizations";
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
    availableOrgs: scopes,
    isLoading,
    error: scopesError,
    refresh,
  } = useOrgScopes();
  // The platform scope is in the switcher, not an organization to manage here.
  const availableOrgs = scopes.filter((org) => !isPlatformScope(org.slug));
  // Belonging to no organization is a state, not a failure.
  const error = isNoOrganizationError(scopesError) ? undefined : scopesError;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Once opened, the form stays mounted (hidden) so a pending owner retry
  // survives looking at another organization.
  const [formOpened, setFormOpened] = useState(false);

  const openForm = () => {
    setFormOpened(true);
    setCreating(true);
  };

  const select = (slug: string) => {
    setCreating(false);
    setSelectedSlug(slug);
  };

  const created = async (slug: string) => {
    // The caller may have named themselves owner: every view of membership
    // must look again before the new organization is selected.
    await Promise.all([
      refresh(),
      mutate(PLATFORM_ORGANIZATIONS_KEY),
      mutate(NO_ORGANIZATION_GATE_KEY),
    ]);
    setFormOpened(false);
    select(slug);
  };

  // Default the selection to the active org once scopes load.
  useEffect(() => {
    if (selectedSlug) return;
    if (activeOrg && !isPlatformScope(activeOrg.slug))
      setSelectedSlug(activeOrg.slug);
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
    if (creating) return null;
    if (selectedOtherOrg) {
      return (
        <PlatformOrgDetailPanel
          organization={selectedOtherOrg}
          dict={orgsDict}
        />
      );
    }
    return (
      <OrgDetailPanel organization={selectedOrganization} dict={orgsDict} />
    );
  };

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "organizations"]}
      icon={HiOfficeBuilding}
      title={tr("title", orgsDict)}
      description={tr("description", orgsDict)}
      actions={
        isPlatformOwner && (
          <Button size="sm" color="blue" onClick={openForm}>
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("newOrganization", orgsDict)}
          </Button>
        )
      }
    >
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
        <div className="flex min-h-0 flex-col">
          {formOpened && (
            <div
              className={
                creating
                  ? "flex min-h-0 flex-col gap-4 overflow-y-auto pr-1"
                  : "hidden"
              }
            >
              <OrganizationsSection
                dict={
                  (dict?.platform as I18nRecord)?.organizations as I18nRecord
                }
                onCreated={created}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}
          {detail()}
        </div>
      </div>
    </SettingsPageShell>
  );
}
