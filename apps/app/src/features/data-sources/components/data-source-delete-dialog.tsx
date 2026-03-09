"use client";

import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import type { DataSourceListItem } from "../types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

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
    <Modal show={show} size="md" onClose={onClose} popup>
      <ModalHeader />
      <ModalBody>
        <div className="text-center">
          <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
          <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
            {tr("deleteConfirm", dict)}{" "}
            <span className="font-semibold">{dataSource?.name}</span>?
          </h3>
          <div className="flex justify-center gap-4">
            <Button color="failure" onClick={onConfirm} disabled={loading}>
              {loading
                ? tr("deleting", dict)
                : tr("deleteButton", dict)}
            </Button>
            <Button color="gray" onClick={onClose}>
              {tr("cancel", dict)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
