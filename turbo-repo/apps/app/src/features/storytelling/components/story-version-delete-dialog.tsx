"use client";

import { Button, Modal, ModalBody } from "flowbite-react";
import { HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryVersion } from "../story-versions";

interface StoryVersionDeleteDialogProps {
  readonly version: StoryVersion | null;
  /** Whether the version has descendants that go with it. */
  readonly hasBranch: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly dict: I18nRecord;
}

export function StoryVersionDeleteDialog({
  version,
  hasBranch,
  onClose,
  onConfirm,
  dict,
}: StoryVersionDeleteDialogProps) {
  return (
    <Modal
      dismissible
      show={version !== null}
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
          {tr("version.delete.title", dict)}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold">
            {tr("version.badgeLabel", dict, { label: version?.label ?? "" })}
          </span>
        </p>
        {hasBranch && (
          <p className="mb-2 text-xs text-red-600 dark:text-red-400">
            {tr("version.delete.branchWarning", dict)}
          </p>
        )}
        <div className="mt-3 flex w-full justify-center gap-3">
          <Button color="red" onClick={onConfirm}>
            {tr("version.delete.confirm", dict)}
          </Button>
          <Button color="gray" onClick={onClose}>
            {tr("version.delete.cancel", dict)}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
