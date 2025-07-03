import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { fromString } from "@/features/common/services/days.service";

export default function TripData( {task, msg}: {task: TaskResponse, msg: I18nRecord}) {
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

  return (
    <div className="flex flex-col">
          <h2 className="text-sm font-normal text-gray-700">Viaje</h2>
          <div className="flex text-sm text-gray-500 flex-col font-light">
            <span className="text-gray-600  text-xs">
              {(msg!.cards as I18nRecord).serviceCode as string}:{" "}
              <span className="text-gray-800  text-xs">{(task.mintral_serviceCode as string) ?? "-"}</span>
            </span>
            <span className="text-gray-600  text-xs">
              {(msg!.cards as I18nRecord).clientCode as string}:{" "}
              <span className="text-gray-800  text-xs">{(task.mintral_clientCode as string) ?? "-"}</span>
            </span>
            <span className="text-gray-600  text-xs">
              {(msg!.cards as I18nRecord).origin as string}-
              {(msg!.cards as I18nRecord).destination as string}:{" "}
              <span className="text-gray-800  text-xs">
                {task.mintral_originDelegateCode as string}-
                {task.mintral_destinationDelegateCode as string}
              </span>
            </span>
            <span className="text-gray-600  text-xs">
              {(msg!.cards as I18nRecord).scheduling as string}:{" "}
              <span className="text-gray-800  text-xs">{etd.format("DD/MM/YYYY HH:mm")} - {eta.format("DD/MM/YYYY HH:mm")}</span>
            </span>
          </div>
        </div>
  );
}