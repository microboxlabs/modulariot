"use client";

import type { DataSourceListItem } from "../types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";

interface DataSourceDeleteDialogProps {
  readonly dataSource: DataSourceListItem | null;
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly loading?: boolean;
  readonly dict: I18nRecord;
}

export function DataSourceDeleteDialog({
  dataSource,
  show,
  onClose,
  onConfirm,
  loading,
  dict,
}: DataSourceDeleteDialogProps) {
  return (
    <ConfirmationModal
      isOpen={show}
      onClose={onClose}
      onConfirm={onConfirm}
      size="md"
      variant="danger"
      title={tr("deleteConfirm", dict)}
      description={
        <>
          <span className="font-semibold">{dataSource?.name}</span>
        </>
      }
      confirmLabel={
        loading ? tr("deleting", dict) : tr("deleteButton", dict)
      }
      isProcessing={loading}
    />
  );
}
