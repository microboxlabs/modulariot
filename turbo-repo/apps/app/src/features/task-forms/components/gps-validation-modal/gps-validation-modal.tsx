"use client";

import { Table, TableBody, TableCell, TableRow } from "flowbite-react";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GpsValidationModalProps } from "./gps-validation-modal.types";
import MapComponent from "./map";
import { tr, trDynamic } from "@/features/i18n/tr.service";

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
    <AbsoluteModal
      selected={openModal}
      setSelected={onClose}
      maxWidth="42rem"
      className="w-full rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex max-h-[85vh] w-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-600">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {msg?.cards
              ? ((msg!.cards as I18nRecord).gpsValidation as string)
              : ((msg as I18nRecord).gpsValidation as string)}
          </h2>
        </div>
        <div className="flex-1 overflow-auto px-5 pb-5 pt-4">
          <div className="flex flex-col gap-4">
            {entityInfo?.lat && entityInfo?.lng ? (
              <MapComponent
                msg={msg}
                pointer={{
                  lat: entityInfo.lat,
                  lng: entityInfo.lng,
                }}
              />
            ) : (
              <div className="w-full h-50 rounded-lg bg-gray-300 dark:bg-gray-700 animate-pulse" />
            )}
            <div className="overflow-auto">
              <Table striped>
                <TableBody>
                  {entityInfo &&
                    Object.entries(entityInfo!).map(
                      ([key, value]) =>
                        !no_displayable.includes(key) &&
                        value !== null &&
                        value !== undefined &&
                        value !== "" && (
                          <TableRow key={key}>
                            <TableCell>
                              <strong>
                                {msg?.cards
                                  ? tr(`cards.${key}`, msg)
                                  : trDynamic(key, msg ?? {})}
                              </strong>
                            </TableCell>
                            <TableCell>
                              {!date_values.includes(key) &&
                                ((typeof value === "string" &&
                                  `${value.replace("_", " ")}`) ||
                                  (typeof value === "boolean" &&
                                    `${
                                      value
                                        ? msg?.cards
                                          ? tr(
                                              "true",
                                              msg!.cards as I18nRecord
                                            )
                                          : tr("true", msg as I18nRecord)
                                        : msg?.cards
                                          ? tr(
                                              "false",
                                              msg!.cards as I18nRecord
                                            )
                                          : tr("false", msg as I18nRecord)
                                    }`) ||
                                  (typeof value === "number" && `${value}`))}
                              {date_values.includes(key) &&
                                `${new Date(
                                  `${value as string}`
                                ).toLocaleString()}`}
                            </TableCell>
                          </TableRow>
                        )
                    )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteModal>
  );
}
