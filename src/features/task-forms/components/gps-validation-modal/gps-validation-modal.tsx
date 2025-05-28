"use client";

import { Modal, Table } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GpsValidationModalProps } from "./gps-validation-modal.types";
import { MapProvider } from "@/features/google-maps/provider/google-maps.provider";
import MapComponent from "./map";
import { tr } from "@/features/i18n/tr.service";

// This lists are so the elements to not "show" or to show in a different way are more understandable on the condition of displaying them
const date_values = ["ultimo_last_timestamp", "createdat"];
const no_displayable = ["lng", "lat"];

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
    <Modal
      dismissible
      show={openModal}
      onClose={onClose}
      size="xl"
      theme={{
        header: {
          base: "flex items-center justify-between rounded-t border-b p-5 dark:border-gray-600",
        },
        body: {
          base: "flex-1 overflow-auto px-5 pb-5",
        },
      }}
    >
      <Modal.Header className="border-none">
        <h2 className="text-base font-semibold">
          {(msg!.cards as I18nRecord).gpsValidation as string}
        </h2>
        <p className="text-sm text-gray-500 mt-1"></p>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <MapProvider>
            <div id="map" className="h-[200px]">
              {entityInfo?.lat && entityInfo?.lng && (
                <MapComponent
                  pointer={{
                    lat: entityInfo?.lat,
                    lng: entityInfo?.lng,
                  }}
                />
              )}
            </div>
          </MapProvider>
          <div className="overflow-auto">
            <Table striped>
              <Table.Body>
                {entityInfo &&
                  Object.entries(entityInfo!).map(
                    ([key, value]) =>
                      !no_displayable.includes(key) &&
                      value !== null &&
                      value !== undefined &&
                      value !== "" && (
                        <Table.Row key={key}>
                          <Table.Cell>
                            <strong>{tr(key, msg!.cards as I18nRecord)}</strong>
                          </Table.Cell>
                          <Table.Cell>
                            {!date_values.includes(key) &&
                              ((typeof value === "string" &&
                                `${value.replace("_", " ")}`) ||
                                (typeof value === "boolean" &&
                                  `${value ? tr("true", msg!.cards as I18nRecord) : tr("false", msg!.cards as I18nRecord)}`) ||
                                (typeof value === "number" && `${value}`))}
                            {date_values.includes(key) &&
                              `${new Date(
                                `${value as string}`,
                              ).toLocaleString()}`}
                          </Table.Cell>
                        </Table.Row>
                      ),
                  )}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
