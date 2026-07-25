"use client";

import { HiTrash } from "react-icons/hi";
import FormModal from "@/features/common/components/form-modal/form-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ModalGlyph } from "./modal-glyph";

interface IntegrationFormModalProps {
  readonly show: boolean;
  /** Editing an existing record rather than creating one: picks the verb and the delete action. */
  readonly isEdit: boolean;
  readonly title: string;
  readonly subtitle: string;
  /** Leading mark, rendered inside the shared glyph frame. */
  readonly glyph: React.ReactNode;
  readonly onClose: () => void;
  /** Delete this record — surfaced in the header when editing one. */
  readonly onDelete?: () => void;
  readonly onSubmit: () => void;
  readonly error: Error | null;
  readonly saving: boolean;
  readonly dict: I18nRecord;
  readonly children: React.ReactNode;
}

/**
 * The shell both records on this page are edited through.
 *
 * Templates and connections ask for different things but are the same kind of record —
 * created from a header action, saved from a footer button, deleted from a header icon —
 * so the chrome lives here and each form supplies only its fields.
 */
export function IntegrationFormModal({
  show,
  isEdit,
  title,
  subtitle,
  glyph,
  onClose,
  onDelete,
  onSubmit,
  error,
  saving,
  dict,
  children,
}: Readonly<IntegrationFormModalProps>) {
  let submitLabel: string;
  if (saving) {
    submitLabel = tr("common.saving", dict);
  } else if (isEdit) {
    submitLabel = tr("common.save", dict);
  } else {
    submitLabel = tr("common.create", dict);
  }

  return (
    <FormModal
      isOpen={show}
      onClose={onClose}
      size="3xl"
      title={title}
      subtitle={subtitle}
      icon={<ModalGlyph>{glyph}</ModalGlyph>}
      headerActions={
        isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={tr("common.delete", dict)}
            title={tr("common.delete", dict)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <HiTrash className="h-4 w-4" />
          </button>
        ) : null
      }
      submitLabel={submitLabel}
      isProcessing={saving}
      error={error}
      onSubmit={onSubmit}
      showCancelButton
      cancelLabel={tr("common.cancel", dict)}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </FormModal>
  );
}
