"use client";

import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface IntegrationDeleteDialogProps {
  readonly show: boolean;
  readonly title: string;
  /** What is about to go, named — the operator confirms a thing, not an id. */
  readonly name: string | undefined;
  /** Why the API will refuse, when we can already tell it will. */
  readonly warning?: string | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly loading?: boolean;
  readonly dict: I18nRecord;
}

/**
 * Delete confirmation for both lists on this page, shaped like the credentials
 * dialog: name the record, and say up front when something still depends on it
 * rather than letting the API's 409 be the first the operator hears of it.
 */
export function IntegrationDeleteDialog({
  show,
  title,
  name,
  warning,
  onClose,
  onConfirm,
  loading,
  dict,
}: IntegrationDeleteDialogProps) {
  return (
    <ConfirmationModal
      isOpen={show}
      onClose={onClose}
      onConfirm={onConfirm}
      size="md"
      variant="danger"
      title={title}
      description={
        <span className="flex flex-col gap-2">
          <span className="font-semibold">{name}</span>
          {warning && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {warning}
            </span>
          )}
        </span>
      }
      confirmLabel={
        loading ? tr("delete.deleting", dict) : tr("common.delete", dict)
      }
      isProcessing={loading}
    />
  );
}
