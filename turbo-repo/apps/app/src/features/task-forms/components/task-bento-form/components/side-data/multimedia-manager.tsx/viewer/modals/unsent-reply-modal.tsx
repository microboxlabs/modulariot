"use client";

import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME } from "../../modal-theme";
import type { MutableRefObject } from "react";

export function UnsentReplyModal({
  show,
  onClose,
  onDiscard,
  onSave,
  dictionary,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  dictionary: I18nRecord;
}>) {
  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="sm"
      theme={MODAL_THEME}
    >
      <ModalHeader className="border-none">
        <span className="text-base font-semibold">{tr("bento.multimedia.unsent_reply_title", dictionary)}</span>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tr("bento.multimedia.unsent_reply_desc", dictionary)}
          </p>
          <div className="flex justify-end gap-2">
            <Button color="alternative" size="sm" onClick={onDiscard}>
              {tr("bento.multimedia.unsent_reply_discard", dictionary)}
            </Button>
            <Button color="blue" size="sm" onClick={onSave}>
              {tr("bento.multimedia.unsent_reply_save", dictionary)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
