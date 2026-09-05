"use client";

import { useState } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { domainLogoUrl } from "./platform-data-service";
import type { DomainBrandingAdmin } from "./platform.types";

interface DomainListProps {
  readonly domains: DomainBrandingAdmin[];
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly error: Error | null;
  readonly onEdit: (row: DomainBrandingAdmin) => void;
  readonly onRemove: (domain: string) => void;
  readonly dict: I18nRecord;
}

/**
 * Every domain with a logo of its own. A domain absent from this list renders
 * the bundled default, which is what an unbranded deployment sharing an ECM
 * with a branded one should show.
 */
export default function DomainList({
  domains,
  isLoading,
  isSaving,
  error,
  onEdit,
  onRemove,
  dict,
}: DomainListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={tr("loading", dict)} />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-6 text-sm text-red-600 dark:text-red-400">
        {tr("loadError", dict)}
      </p>
    );
  }
  if (domains.length === 0) {
    return (
      <p className="py-6 text-sm text-gray-500 dark:text-gray-400">
        {tr("domainsEmpty", dict)}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {domains.map((row) => (
        <DomainRow
          key={row.domain}
          row={row}
          dict={dict}
          busy={isSaving}
          onEdit={() => onEdit(row)}
          onRemove={() => onRemove(row.domain)}
        />
      ))}
    </ul>
  );
}

interface DomainRowProps {
  readonly row: DomainBrandingAdmin;
  readonly dict: I18nRecord;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

function DomainRow({ row, dict, busy, onEdit, onRemove }: DomainRowProps) {
  // Two clicks to delete, without a second modal: the first turns this row's
  // button into an explicit confirmation.
  const [isConfirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={domainLogoUrl(row.domain, row.logoEtag)}
          alt={tr("logoAlt", dict, { domain: row.domain })}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
          {row.domain}
        </p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {row.homeUrl ?? tr("noHomeUrl", dict)}
        </p>
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
          {tr("updatedBy", dict, {
            who: row.updatedBy ?? "—",
            when: new Date(row.updatedAt).toLocaleString(),
          })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {row.logoDarkEtag && (
          <Badge color="info">{tr("hasDarkLogo", dict)}</Badge>
        )}
        <Badge color={row.active ? "success" : "gray"}>
          {row.active ? tr("statusActive", dict) : tr("statusInactive", dict)}
        </Badge>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button size="xs" color="light" disabled={busy} onClick={onEdit}>
          {tr("edit", dict)}
        </Button>
        {isConfirming ? (
          <>
            <Button
              size="xs"
              color="failure"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onRemove();
              }}
            >
              {tr("removeConfirm", dict)}
            </Button>
            <Button
              size="xs"
              color="light"
              onClick={() => setConfirming(false)}
            >
              {tr("cancel", dict)}
            </Button>
          </>
        ) : (
          <Button
            size="xs"
            color="failure"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {tr("remove", dict)}
          </Button>
        )}
      </div>
    </li>
  );
}
