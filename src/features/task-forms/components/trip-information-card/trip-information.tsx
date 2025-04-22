"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { fromString } from "@/features/common/services/days.service";
import EllipseIcon from "@/features/icons/ellipse";
import { DriverVerifiedCardProps } from "../driver-verified-card/driver-verified-card.types";
import CheckCircleIcon from "@/features/icons/check-circle";
import ErrorCircleIcon from "@/features/icons/error-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import GpsValidationItem from "../gps-validation-item/gps-validation-item";
import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import DownloadSignedDocument from "@/features/shipping/components/download-signed-document/download-signed-document";

export default function TripInformation({
  lang,
  task,
  msg,
  userGroups,
}: DriverVerifiedCardProps) {
  const eta = fromString(
    task.mintral_arrivalDate
      ? (task.mintral_arrivalDate as string)
      : task.mintral_estimatedArrivalDate
        ? (task.mintral_estimatedArrivalDate as string)
        : "",
  );
  const etd = fromString(
    task.mintral_departureDate
      ? (task.mintral_departureDate as string)
      : task.mintral_expectedDepartureDate
        ? (task.mintral_expectedDepartureDate as string)
        : (task.mintral_estimatedDepartureDate as string),
  );
  const { data: serviceValidation, isLoading: _isLoadingServiceValidation } =
    useGetServiceValidation(task?.mintral_serviceCode as string);

  const isError = (value?: {
    v_01eval?: number;
    v_02eval?: number;
    v_03eval?: number;
  }) =>
    serviceValidation?.error ||
    value?.v_01eval == -1 ||
    value?.v_02eval == -1 ||
    value?.v_03eval == -1;
  return (
    <div>
      <h5 className="text-sm font-medium leading-loose dark:text-white text-gray-900">
        {(msg!.cards as I18nRecord).tripInformation as string}
      </h5>

      <div className="flex flex-col gap-2.5 mt-3">
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).patente as string}:{" "}
          {(task.mintral_truckLicensePlate as string) ?? "-"}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).serviceCode as string}:{" "}
          {(task.mintral_serviceCode as string) ?? "-"}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).clientCode as string}:{" "}
          {(task.mintral_clientCode as string) ?? "-"}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).origin as string}-
          {(msg!.cards as I18nRecord).destination as string}:{" "}
          {task.mintral_originDelegateCode as string}-
          {task.mintral_destinationDelegateCode as string}
        </span>
        <span className="text-gray-400 text-xs">
          {(msg!.cards as I18nRecord).scheduling as string}:{" "}
          {etd.format("DD/MM/YYYY HH:mm")} - {eta.format("DD/MM/YYYY HH:mm")}
        </span>
        <span className="text-gray-400 text-xs">
          {task.mintral_hoReference && (
            <DownloadSignedDocument
              documentId={task.mintral_hoReference}
              asLink
              name="Carta Porte"
            />
          )}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 mt-6">
        <div className="flex gap-2">
          {isError(serviceValidation?.v_01) && <EllipseIcon />}
          {serviceValidation?.v_01?.v_01eval === 1 && <CheckCircleIcon />}
          {serviceValidation?.v_01?.v_01eval === 2 && <ExclamationIcon />}
          {serviceValidation?.v_01?.v_01eval === 3 && <ErrorCircleIcon />}
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).consolidation as string}
          </span>
        </div>
        <div className="flex gap-2">
          {isError(serviceValidation?.v_02) && <EllipseIcon />}
          {serviceValidation?.v_02?.v_02eval === 1 && <CheckCircleIcon />}
          {serviceValidation?.v_02?.v_02eval === 2 && <ExclamationIcon />}
          {serviceValidation?.v_02?.v_02eval === 3 && <ErrorCircleIcon />}
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).documentSeparation as string}
          </span>
        </div>
        <div className="flex gap-2">
          {isError(serviceValidation?.v_03) && <EllipseIcon />}
          {serviceValidation?.v_03?.v_03eval === 1 && <CheckCircleIcon />}
          {serviceValidation?.v_03?.v_03eval === 2 && <ExclamationIcon />}
          {serviceValidation?.v_03?.v_03eval === 3 && <ErrorCircleIcon />}
          <span className="text-gray-400 text-sm">
            {(msg!.cards as I18nRecord).clientSystemValidation as string}
          </span>
        </div>
        <div className="flex gap-2">
          <GpsValidationItem
            msg={msg}
            lang={lang}
            task={task}
            userGroups={userGroups}
          />
        </div>
      </div>
    </div>
  );
}
