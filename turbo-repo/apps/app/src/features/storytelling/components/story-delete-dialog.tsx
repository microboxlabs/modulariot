"use client";

import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryItem } from "../storytelling.types";

interface StoryDeleteDialogProps {
  readonly story: StoryItem | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly dict: I18nRecord;
}

export function StoryDeleteDialog({ story, onClose, onConfirm, dict }: StoryDeleteDialogProps) {
  return (
    <ConfirmationModal
      isOpen={story !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      size="md"
      variant="danger"
      blurBackdrop
      title={tr("delete.title", dict)}
      description={<span className="font-semibold">{story?.title}</span>}
      confirmLabel={tr("delete.confirmButton", dict)}
    />
  );
}
