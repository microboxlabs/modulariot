import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { fromString } from "@/features/common/services/days.service";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaCog,
  FaMapMarkerAlt,
  FaTruck,
} from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import { FormattedDate } from "@/features/common/components/formatted-date";

export default function TripData({
  task,
  msg,
  isLoading = false,
}: {
  task: TaskResponse;
  msg: I18nRecord;
  isLoading?: boolean;
}) {
  const eta = fromString(
    task.mintral_arrivalDate
      ? (task.mintral_arrivalDate as string)
      : task.mintral_estimatedArrivalDate
        ? (task.mintral_estimatedArrivalDate as string)
        : ""
  );
  const etd = fromString(
    task.mintral_departureDate
      ? (task.mintral_departureDate as string)
      : task.mintral_expectedDepartureDate
        ? (task.mintral_expectedDepartureDate as string)
        : (task.mintral_estimatedDepartureDate as string)
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
        : task.mintral_priorityCode
          ? task.mintral_priorityCode
          : "-";

  const data = [
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).patente as string,
      value: (task.mintral_truckLicensePlate as string) ?? "-",
    },
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).trailer as string,
      value: (task.mintral_trailerLicensePlate as string) ?? "-",
    },
    {
      icon: <FaClipboardList className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).serviceCode as string,
      value: (task.mintral_serviceCode as string) ?? "-",
    },
    {
      icon: <FaCog className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).executionType as string,
      value: executionType,
    },
    {
      icon: <FaMapMarkerAlt className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).route as string,
      value:
        task.mintral_originDelegateCode && task.mintral_destinationDelegateCode
          ? (task.mintral_originDelegateCode as string) +
            " - " +
            (task.mintral_destinationDelegateCode as string)
          : "-",
    },
    /* {
      icon: <FaMapMarkerAlt className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).destination as string,
      value: (task.mintral_destinationDelegateCode as string) ?? "-",
    }, */
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).serviceKind as string,
      value: task.mintral_serviceKind
        ? (task.mintral_serviceKind as string).toUpperCase()
        : "-",
    },
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).clientName as string,
      value: (task.mintral_clientAbbreviation as string) ?? "-",
    },
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).transportNumberCode as string,
      value: (task.mintral_servicePrincipalNumber as string) ?? "-",
    },
    {
      icon: <FaShield className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).estado as string,
      value: priority,
    },
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).supplierId as string,
      value: task.mintral_supplierId ?? "-",
    },
  ];
  const originIsSitrans =
    (
      JSON.parse(task.mintral_geofenceDestinationMetadata as string) as Record<
        string,
        boolean | undefined
      >
    )["origin_is_sitrans"] ?? null;
  // All elements whose data can variate a lot (to long texts) will be here
  const variable_length_data = [
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).supplierName as string,
      value: (task.mintral_supplierName as string) ?? "-",
    },
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).originIsSitrans as string,
      value:
        originIsSitrans === null
          ? "-"
          : originIsSitrans === true
            ? "interno"
            : "externo",
    },
    {
      icon: <FaCalendarAlt className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).scheduling as string,
      value: (
        <>
          <FormattedDate
            date={etd.format("MM/DD/YYYY HH:mm")}
            format="datetime"
          />
          <span className="mx-2">-</span>
          <FormattedDate
            date={eta.format("MM/DD/YYYY HH:mm")}
            format="datetime"
          />
        </>
      ),
      /* value: `${etd.format("DD/MM/YYYY HH:mm")} - ${eta.format("DD/MM/YYYY HH:mm")}`, */
    },
  ];

  return (
    <div className="flex flex-col gap-2 w-fit">
      <div className="flex flex-wrap gap-x-4 w-fit">
        <div className="w-fit flex flex-col gap-2">
          {data.slice(0, Math.ceil(data.length / 2)).map((item, index) => (
            <LoadableLabel
              key={index}
              label={item.label}
              value={item.value as string}
              isLoading={isLoading}
              icon={item.icon}
            />
          ))}
        </div>
        <div className="w-fit flex flex-col gap-2">
          {data.slice(Math.ceil(data.length / 2)).map((item, index) => (
            <LoadableLabel
              key={index + Math.ceil(data.length / 2)}
              label={item.label}
              value={item.value as string}
              isLoading={isLoading}
              icon={item.icon}
            />
          ))}
        </div>
      </div>
      {variable_length_data.map((item, index) => (
        <LoadableLabel
          key={index}
          label={item.label}
          value={item.value}
          isLoading={isLoading}
          icon={item.icon}
        />
      ))}
    </div>
  );
}
