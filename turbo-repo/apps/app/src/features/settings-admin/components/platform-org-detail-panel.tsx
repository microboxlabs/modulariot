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

function Fact({ label, value }: FactProps) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-white break-all">
        {value ?? "—"}
      </dd>
    </div>
  );
}

interface OwnersProps {
  readonly slug: string;
  readonly dict: I18nRecord;
}

function Owners({ slug, dict }: OwnersProps) {
  const { owners, isLoading, error } = useOrganizationOwners(slug);
  if (isLoading) return <Spinner size="sm" />;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {tr("platformView.ownersError", dict)}
      </p>
    );
  }
  if (owners.length === 0) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        {tr("platformView.noOwners", dict)}
      </p>
    );
  }
  return (
    <ul className="text-sm text-gray-900 dark:text-white">
      {owners.map((owner) => (
        <li key={owner}>{owner}</li>
      ))}
    </ul>
  );
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
          {organization.displayName ?? organization.name}
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
          {tr("platformView.owners", dict)}
        </h3>
        <Owners slug={organization.slug} dict={dict} />
      </section>
    </div>
  );
}
