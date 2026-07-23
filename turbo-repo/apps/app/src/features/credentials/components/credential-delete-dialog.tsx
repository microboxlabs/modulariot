"use client";

import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { CredentialListItem } from "../credential.types";

interface CredentialDeleteDialogProps {
  readonly credential: CredentialListItem | null;
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly loading?: boolean;
  readonly dict: I18nRecord;
}

/**
 * Deleting a credential that something still references breaks that consumer at
 * its next run, so the dialog names the references instead of just confirming.
 */
export function CredentialDeleteDialog({
  credential,
  show,
  onClose,
  onConfirm,
  loading,
  dict,
}: CredentialDeleteDialogProps) {
  const usageCount = credential?.usedBy.length ?? 0;

  return (
    <ConfirmationModal
      isOpen={show}
      onClose={onClose}
      onConfirm={onConfirm}
      size="md"
      variant="danger"
      title={tr("delete.title", dict)}
      description={
        <span className="flex flex-col gap-2">
          <span className="font-semibold">{credential?.name}</span>
          {usageCount > 0 && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {trDynamic("delete.inUseWarning", dict, {
                count: String(usageCount),
              })}
              {": "}
              {credential?.usedBy.map((usage) => usage.label).join(", ")}
            </span>
          )}
        </span>
      }
      confirmLabel={
        loading ? tr("delete.deleting", dict) : tr("delete.confirmButton", dict)
      }
      isProcessing={loading}
    />
  );
}
