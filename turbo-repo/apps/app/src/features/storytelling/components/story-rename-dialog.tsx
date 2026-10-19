"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface StoryRenameDialogProps {
  /** The story being renamed; null keeps the dialog closed. */
  readonly story: { readonly id: string; readonly title: string } | null;
  readonly onClose: () => void;
  readonly onConfirm: (title: string) => void;
  readonly dict: I18nRecord;
}

export function StoryRenameDialog({
  story,
  onClose,
  onConfirm,
  dict,
}: StoryRenameDialogProps) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    setTitle(story?.title ?? "");
  }, [story]);

  const trimmed = title.trim();
  const submit = () => {
    if (trimmed && trimmed !== story?.title) onConfirm(trimmed);
    else onClose();
  };

  return (
    <Modal dismissible show={story !== null} onClose={onClose} size="md">
      <ModalHeader>{tr("rename.title", dict)}</ModalHeader>
      <ModalBody>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextInput
            autoFocus
            value={title}
            maxLength={280}
            aria-label={tr("rename.label", dict)}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button color="gray" type="button" onClick={onClose}>
              {tr("rename.cancel", dict)}
            </Button>
            <Button type="submit" disabled={!trimmed}>
              {tr("rename.confirm", dict)}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
