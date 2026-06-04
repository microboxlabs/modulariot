"use client";

import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME } from "../../modal-theme";

export function DeleteConfirmModal({
  show,
  onClose,
  onConfirm,
  fileName,
  dictionary,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  dictionary: I18nRecord;
}>) {
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
          <span className="text-base font-semibold">{tr("bento.multimedia.delete_modal_title", dictionary)}</span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {tr("bento.multimedia.delete_modal_desc", dictionary)}
          </span>
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
