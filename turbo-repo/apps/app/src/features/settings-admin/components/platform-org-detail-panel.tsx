"use client";

import { Spinner } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { PlatformOrganizationListItem } from "../platform/platform.types";
import { useOrganizationOwners } from "../platform/use-platform-organizations";

interface PlatformOrgDetailPanelProps {
  readonly organization: PlatformOrganizationListItem;
  readonly dict: I18nRecord;
}

interface FactProps {
  readonly label: string;
  readonly value: string | null;
}

function Fact({ label, value }: Readonly<FactProps>) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-white break-all">
        {value ?? "—"}
      </dd>
    </div>
  );
}

interface NoOwnersProps {
  readonly organization: PlatformOrganizationListItem;
  readonly dict: I18nRecord;
}

/**
 * With Alfresco membership, the Alfresco managers of the top-level
 * organization act as its owners until one is assigned, so an empty list is
 * normal there. With native membership nobody can manage the organization.
 */
function NoOwners({ organization, dict }: Readonly<NoOwnersProps>) {
  if (organization.membershipSource === "ALFRESCO") {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("platformView.alfrescoOwners", dict)}
      </p>
    );
  }
  return (
    <p className="text-sm text-amber-700 dark:text-amber-300">
      {tr("platformView.noOwners", dict)}
    </p>
  );
}

function Owners({ organization, dict }: Readonly<NoOwnersProps>) {
  const { owners, isLoading, error } = useOrganizationOwners(organization.slug);
  if (isLoading) return <Spinner size="sm" />;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {tr("platformView.ownersError", dict)}
      </p>
    );
  }
  if (owners.length === 0) {
    return <NoOwners organization={organization} dict={dict} />;
  }
  return (
    <ul className="text-sm text-gray-900 dark:text-white">
      {owners.map((owner) => (
        <li key={owner}>{owner}</li>
      ))}
    </ul>
  );
}

function ownersTitle(
  organization: PlatformOrganizationListItem,
  dict: I18nRecord
): string {
  if (organization.parentSlug === null) return tr("platformView.owners", dict);
  return tr("platformView.parentOwners", dict, {
    parent: organization.parentSlug,
  });
}

/**
 * What a platform owner sees of an organization they do not belong to: its
 * settings and owners, read-only. Managing members and integrations needs a
 * role in the organization.
 */
export default function PlatformOrgDetailPanel({
  organization,
  dict,
}: PlatformOrgDetailPanelProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {organization.displayName || organization.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("platformView.readOnly", dict)}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Fact
            label={tr("platformView.slug", dict)}
            value={organization.slug}
          />
          <Fact
            label={tr("platformView.tenantClientId", dict)}
            value={organization.tenantClientId}
          />
          <Fact
            label={tr("platformView.membershipSource", dict)}
            value={trDynamic(
              `platformView.sources.${organization.membershipSource}`,
              dict
            )}
          />
          <Fact
            label={tr("platformView.parent", dict)}
            value={organization.parentSlug}
          />
          <Fact
            label={tr("platformView.taxId", dict)}
            value={organization.taxId}
          />
        </dl>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
          {ownersTitle(organization, dict)}
        </h3>
        <Owners organization={organization} dict={dict} />
      </section>
    </div>
  );
}
