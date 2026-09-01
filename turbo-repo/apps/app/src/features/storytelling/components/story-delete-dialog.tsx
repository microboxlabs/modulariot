"use client";

import { Button, Modal, ModalBody } from "flowbite-react";
import { HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryItem } from "../storytelling.types";

interface StoryDeleteDialogProps {
  /** One story = the per-card kebab menu's delete; several = the grid's
   * selection-toolbar mass delete — same dialog either way. */
  readonly stories: readonly StoryItem[];
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly dict: I18nRecord;
}

export function StoryDeleteDialog({ stories, onClose, onConfirm, dict }: StoryDeleteDialogProps) {
  const isSingle = stories.length === 1;
  return (
    <Modal
      dismissible
      show={stories.length > 0}
      onClose={onClose}
      size="sm"
      className="backdrop-blur-[10px]"
      theme={{
        content: {
          inner:
            "relative flex max-h-[90dvh] flex-col rounded-lg border border-gray-300 bg-white shadow dark:border-gray-700 dark:bg-gray-800",
        },
      }}
    >
      <ModalBody className="flex flex-col items-center gap-1 py-6 text-center">
        <HiExclamation className="mb-2 h-9 w-9 text-red-500 dark:text-red-400" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {isSingle
            ? tr("delete.title", dict)
            : tr("delete.multipleTitle", dict, { count: String(stories.length) })}
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold">
            {isSingle ? stories[0]?.title : stories.map((s) => s.title).join(", ")}
          </span>
        </p>
        <div className="flex w-full justify-center gap-3">
          <Button color="red" onClick={onConfirm}>
            {tr("delete.confirmButton", dict)}
          </Button>
          <Button color="gray" onClick={onClose}>
            {tr("delete.cancelButton", dict)}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
