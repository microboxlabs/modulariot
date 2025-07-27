import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { fromString } from "@/features/common/services/days.service";

export default function TripData({
  task,
  msg,
}: {
  task: TaskResponse;
  msg: I18nRecord;
}) {
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

  const executionType =
    task.mintral_executionType === "T"
      ? "Troncal"
      : task.mintral_executionType === "F"
        ? "Faena"
        : task.mintral_executionType;

  const priority =
    task.mintral_priorityCode === "UR"
      ? "URGENTE"
      : task.mintral_priorityCode === "RG"
        ? "REGULARIZACIÓN"
        : task.mintral_priorityCode;

  const data = [
    {
      label: (msg!.cards as I18nRecord).patente as string,
      value: (task.mintral_truckLicensePlate as string) ?? "-",
    },
    {
      label: (msg!.cards as I18nRecord).serviceCode as string,
      value: (task.mintral_serviceCode as string) ?? "-",
    },
    {
      label: (msg!.cards as I18nRecord).clientName as string,
      value: (task.mintral_clientAbbreviation as string) ?? "-",
    },
    {
      label: (msg!.cards as I18nRecord).origin as string,
      value: (task.mintral_originDelegateCode as string) ?? "-",
    },
    {
      label: (msg!.cards as I18nRecord).destination as string,
      value: (task.mintral_destinationDelegateCode as string) ?? "-",
    },
    {
      label: (msg!.cards as I18nRecord).scheduling as string,
      value: `${etd.format("DD/MM/YYYY HH:mm")} - ${eta.format("DD/MM/YYYY HH:mm")}`,
    },
    {
      label: (msg!.cards as I18nRecord).priorityCode as string,
      value: priority,
    },
    {
      label: (msg!.cards as I18nRecord).executionType as string,
      value: executionType,
    },
    {
      label: (msg!.cards as I18nRecord).serviceKind as string,
      value: task.mintral_serviceKind
        ? (task.mintral_serviceKind as string).toUpperCase()
        : "-",
    },
    {
      label: (msg!.cards as I18nRecord).transportNumberCode as string,
      value: (task.mintral_servicePrincipalNumber as string) ?? "-",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-fit">
      {data.map((item, index) => (
        <span
          className="text-gray-600 dark:text-gray-400 whitespace-nowrap w-fit flex flex-col sm:flex-row text-sm font-light"
          key={index}
        >
          {item.label}
          <span className="mr-1">:</span>
          <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">
            {item.value as string}
          </span>
        </span>
      ))}
    </div>
  );
}
