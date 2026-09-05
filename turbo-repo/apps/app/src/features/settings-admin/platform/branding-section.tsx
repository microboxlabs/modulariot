"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { HiOutlinePhotograph } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import DefaultLogoCard from "./default-logo-card";
import DomainBrandingModal from "./domain-branding-modal";
import DomainList from "./domain-list";
import { useDomainBrandings } from "./use-domain-brandings";
import type { DomainBrandingAdmin, SetDomainBranding } from "./platform.types";

interface BrandingSectionProps {
  /** `pages.userSettings.platform.branding`. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Platform › Branding: one logo per domain, plus the bundled
 * default every domain without a row falls back to.
 */
export default function BrandingSection({
  dict,
  lang,
}: BrandingSectionProps) {
  const { domains, isLoading, isSaving, error, save, remove } =
    useDomainBrandings();
  const [editing, setEditing] = useState<DomainBrandingAdmin | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

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
      closeModal();
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

  return (
    <>
      <section className="shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <HiOutlinePhotograph className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">
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

        <div className="mt-3">
          <DomainList
            domains={domains}
            isLoading={isLoading}
            isSaving={isSaving}
            error={error}
            onEdit={openEdit}
            onRemove={(domain) => void handleRemove(domain)}
            lang={lang}
            dict={dict}
          />
        </div>
      </section>

      <DefaultLogoCard dict={dict} />

      <DomainBrandingModal
        show={isModalOpen}
        initial={editing}
        onClose={closeModal}
        onSubmit={(domain, value) => void handleSubmit(domain, value)}
        isSaving={isSaving}
        error={submitError}
        dict={dict}
      />
    </>
  );
}
