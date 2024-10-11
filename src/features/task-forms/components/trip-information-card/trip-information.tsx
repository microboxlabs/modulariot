import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { fromString } from "@/features/common/services/days.service";
import EllipseIcon from "@/features/icons/ellipse";
import { DriverVerifiedCardProps } from "../driver-verified-card/driver-verified-card.types";
import CheckCircleIcon from "@/features/icons/check-circle";
import { calcGpsValidationType } from "../../services/client-form.service";
import ErrorCircleIcon from "@/features/icons/error-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import { useState } from "react";
import GpsValidationModal from "../gps-validation-modal/gps-validation-modal";

export default function TripInformation({
  lang,
  task,
  msg,
  entityInfo,
}: DriverVerifiedCardProps) {
  const [showGpsValidationModal, setShowGpsValidationModal] = useState(false);

  const openGpsValidationModal = () => {
    setShowGpsValidationModal(true);
  };

  const eta = fromString(
    task.properties.mintral_estimatedArrivalDate as string,
  );
  const etd = fromString(
    task.properties.mintral_estimatedDepartureDate as string,
  );

  const gpsValidationType = entityInfo
    ? calcGpsValidationType(entityInfo)
    : undefined;

  return (
    <div>
      <h5 className="text-sm font-medium leading-loose">
        {(msg!.cards as I18nRecord).tripInformation as string}
      </h5>
      <div className="flex flex-col gap-2.5 mt-3">
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).clientCode as string}:{" "}
          {(task.properties.mintral_clientCode as string) ?? "-"}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).origin as string}-
          {(msg!.cards as I18nRecord).destination as string}:{" "}
          {task.properties.mintral_originDelegateCode as string}-
          {task.properties.mintral_destinationDelegateCode as string}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).scheduling as string}:{" "}
          {eta.format("DD/MM/YYYY HH:mm")} - {etd.format("DD/MM/YYYY HH:mm")}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 mt-6">
        <div className="flex gap-2">
          <EllipseIcon />
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).consolidation as string}
          </span>
        </div>
        <div className="flex gap-2">
          <EllipseIcon />
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).documentSeparation as string}
          </span>
        </div>
        <div className="flex gap-2">
          <EllipseIcon />
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).clientSystemValidation as string}
          </span>
        </div>
        <div className="flex gap-2">
          {gpsValidationType === "ok" && <CheckCircleIcon />}
          {gpsValidationType === "warning" && <ExclamationIcon />}
          {gpsValidationType === "error" && <ErrorCircleIcon />}
          {gpsValidationType === undefined && <EllipseIcon />}
          <a
            href="#"
            className="text-gray-400 text-sm hover:underline"
            onClick={openGpsValidationModal}
          >
            {(msg!.cards as I18nRecord).gpsValidation as string}
          </a>
        </div>
      </div>
      <GpsValidationModal
        openModal={showGpsValidationModal}
        setOpenModal={() => setShowGpsValidationModal(false)}
        msg={msg!}
        entityInfo={entityInfo}
        lang={lang}
        task={task}
      />
    </div>
  );
}
