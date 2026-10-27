"use client";

import type { ReactNode } from "react";
import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME } from "../../modal-theme";
import { useMediaSource } from "../../media-source";

export function DeleteConfirmModal({
  show,
  onClose,
  onConfirm,
  fileName,
  dictionary,
  title,
  description,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Name shown in the grey box (a file here; a place or route elsewhere). */
  fileName: string;
  dictionary: I18nRecord;
  /** Overrides the file texts when deleting something else; `null` = no description. */
  title?: string;
  description?: ReactNode;
}>) {
  const recoverable = useMediaSource().recoverableDelete;
  const descArchivo = recoverable
    ? tr("bento.multimedia.delete_modal_desc", dictionary)
    : tr("bento.multimedia.delete_modal_desc_permanent", dictionary);
  const desc = description === undefined ? descArchivo : description;
  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="md"
      theme={MODAL_THEME}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">
            {title ?? tr("bento.multimedia.delete_modal_title", dictionary)}
          </span>
          {desc && (
            <span className="text-sm text-gray-500 mt-1 font-normal">
              {desc}
            </span>
          )}
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
              {fileName}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button color="alternative" onClick={onClose}>
              {tr("bento.multimedia.btn_cancel", dictionary)}
            </Button>
            <Button color="blue" onClick={onConfirm}>
              {tr("bento.multimedia.btn_delete", dictionary)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
