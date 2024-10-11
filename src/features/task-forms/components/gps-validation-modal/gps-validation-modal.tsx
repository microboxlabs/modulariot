"use client";

import { Modal, Table } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GpsValidationModalProps } from "./gps-validation-modal.types";

export default function GpsValidationModal({
  openModal,
  setOpenModal,
  msg,
  entityInfo,
}: GpsValidationModalProps) {
  const onClose = () => {
    setOpenModal(false);
  };

  return (
    <Modal dismissible show={openModal} onClose={onClose} size="xl">
      <Modal.Header className="border-none">
        <div className="flex flex-col items-start">
          <h2 className="text-base font-semibold">
            {(msg!.cards as I18nRecord).gpsValidation as string}
          </h2>
          <p className="text-sm text-gray-500 mt-1"></p>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="overflow-auto">
          <Table striped>
            <Table.Body>
              {entityInfo &&
                Object.entries(entityInfo!).map(([key, value]) => (
                  <Table.Row key={key}>
                    <Table.Cell>
                      <strong>{key}</strong>
                    </Table.Cell>
                    <Table.Cell>{`${value as string}`}</Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer className="border-none flex justify-end"></Modal.Footer>
    </Modal>
  );
}
