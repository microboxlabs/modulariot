"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Spinner } from "flowbite-react";
import { HiOutlinePhotograph } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DomainBrandingModal from "./domain-branding-modal";
import { domainLogoUrl } from "./platform-data-service";
import { useDomainBrandings } from "./use-domain-brandings";
import type { DomainBrandingAdmin, SetDomainBranding } from "./platform.types";

interface DomainBrandingCardProps {
  readonly dict: I18nRecord;
}

/**
 * Settings card listing every domain with its own logo. A domain with no row
 * here renders the bundled default, which is what an unbranded deployment
 * sharing an ECM with a branded one should show.
 */
export default function DomainBrandingCard({ dict }: DomainBrandingCardProps) {
  const { domains, isLoading, isSaving, error, save, remove } =
    useDomainBrandings();
  const [editing, setEditing] = useState<DomainBrandingAdmin | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const openCreate = () => {
    setEditing(null);
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEdit = (row: DomainBrandingAdmin) => {
    setEditing(row);
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (domain: string, value: SetDomainBranding) => {
    setSubmitError(null);
    try {
      await save(domain, value);
      setModalOpen(false);
      setEditing(null);
      toast.success(tr("toast.saved", dict, { domain }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRemove = async (domain: string) => {
    try {
      await remove(domain);
      toast.success(tr("toast.removed", dict, { domain }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("saveError", dict));
    }
  };

  function renderBody(): ReactNode {
    if (isLoading) return <Spinner size="sm" />;
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      );
    }
    if (domains.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
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
            onEdit={() => openEdit(row)}
            onRemove={() => handleRemove(row.domain)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlinePhotograph className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr("domainsTitle", dict)}
          </h3>
        </div>
        <Button size="xs" color="blue" onClick={openCreate} disabled={isSaving}>
          {tr("addDomain", dict)}
        </Button>
      </div>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("domainsDescription", dict)}
      </p>

      <div className="mt-3">{renderBody()}</div>

      <DomainBrandingModal
        show={isModalOpen}
        initial={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={(domain, value) => void handleSubmit(domain, value)}
        isSaving={isSaving}
        error={submitError}
        dict={dict}
      />
    </div>
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
