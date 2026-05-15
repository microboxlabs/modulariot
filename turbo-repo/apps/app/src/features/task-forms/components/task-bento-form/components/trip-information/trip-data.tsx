"use client";

import { useState } from "react";
import { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { fromString } from "@/features/common/services/days.service";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import ETAEditModal, {
  ETAMode,
  ManualETAReason,
} from "@/features/task-forms/components/eta-edit-modal/eta-edit-modal";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaCog,
  FaMapMarkerAlt,
  FaTruck,
} from "react-icons/fa";
import { FaShield } from "react-icons/fa6";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { tr } from "@/features/i18n/tr.service";

export default function TripData({
  task,
  taskId,
  msg,
  isLoading = false,
}: {
  task: TaskResponse;
  taskId: string;
  msg: I18nDictionary;
  isLoading?: boolean;
}) {
  // Get the raw arrival date string for editing
  const arrivalDateRaw = task.mintral_arrivalDate
    ? (task.mintral_arrivalDate as string)
    : task.mintral_estimatedArrivalDate
      ? (task.mintral_estimatedArrivalDate as string)
      : "";

  // Get current ETA mode and reason from task
  const currentEtaMode = (task.mintral_etaMode as ETAMode) || "calculated";
  const currentEtaReason =
    (task.mintral_manualEtaReason as ManualETAReason) ||
    "DESTINATION_SCHEDULE_RESTRICTIONS";
  const currentEtaReasonOther =
    (task.mintral_manualEtaReasonOther as string) || "";

  // State to track the current ETA value (updated after successful edit)
  const [currentArrivalDate, setCurrentArrivalDate] = useState(arrivalDateRaw);

  const eta = fromString(currentArrivalDate);
  const etd = fromString(
    task.mintral_departureDate
      ? (task.mintral_departureDate as string)
      : task.mintral_expectedDepartureDate
        ? (task.mintral_expectedDepartureDate as string)
        : (task.mintral_estimatedDepartureDate as string)
  );

  // Handle ETA update from modal (updates all fields)
  const handleETAUpdate = (values: Record<string, unknown>) => {
    // Update the local arrival date state for display
    const arrivalDate =
      values.mintral_arrivalDate || values.mintral_estimatedArrivalDate;
    if (arrivalDate) {
      setCurrentArrivalDate(arrivalDate as string);
    }
  };

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
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).supplierPrveCodigo as string,
      value: (task.mintral_supplierPrveCodigo as string) ?? "-",
    },
  ];

  // All elements whose data can variate a lot (to long texts) will be here
  const variableLengthData = [
    {
      icon: <FaTruck className="w-4 h-4" />,
      label: (msg!.cards as I18nRecord).supplierName as string,
      value: (task.mintral_supplierName as string) ?? "-",
    },
  ];

  // Editable arrival date field - rendered separately for inline editing
  const arrivalLabel = tr("cards.arrival", msg);
  const arrivalDisplayValue = eta.isValid() ? (
    <FormattedDate date={eta.format("MM/DD/YYYY HH:mm")} format="datetime" />
  ) : (
    "-"
  );

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
      {variableLengthData.map((item, index) => (
        <LoadableLabel
          key={index}
          label={item.label}
          value={item.value}
          isLoading={isLoading}
          icon={item.icon}
        />
      ))}
      {/* Departure and Arrival dates in the same row on desktop, stacked on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-x-4">
        <div className="shrink-0">
          <LoadableLabel
            label={tr("cards.departure", msg)}
            value={
              <FormattedDate
                date={etd.format("MM/DD/YYYY HH:mm")}
                format="datetime"
              />
            }
            isLoading={isLoading}
            icon={<FaCalendarAlt className="w-4 h-4" />}
          />
        </div>
        {/* Editable ETA field with multi-field modal */}
        <div className="shrink-0">
          <ETAEditModal
            taskId={taskId}
            currentMode={currentEtaMode}
            currentArrivalDate={currentArrivalDate}
            currentReason={currentEtaReason}
            currentReasonOther={currentEtaReasonOther}
            originGeofence={task.mintral_originDelegateCode as string}
            destinationGeofence={task.mintral_destinationDelegateCode as string}
            onUpdate={handleETAUpdate}
            triggerLabel={arrivalLabel}
            displayValue={arrivalDisplayValue}
            icon={<FaCalendarAlt className="w-4 h-4" />}
            disabled={isLoading}
            dict={msg}
          />
        </div>
      </div>
    </div>
  );
}
