"use client";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  ValidationItem,
  ValidationStatus,
  ServiceValidationData,
} from "./validations.types";

import CustomCard from "@/features/common/components/custom-card/custom-card";
import { useGetValidation } from "@/features/common/providers/client-api.provider";
import { ValidationIcon } from "./validation-icon";
import GpsValidationItem from "../../../gps-validation-item/gps-validation-item";
import { Tooltip } from "flowbite-react";

// Validation item component
export const ValidationItemComponent = ({
  item,
  msg,
}: {
  item: ValidationItem;
  msg: I18nRecord;
}) => {
  return (
    <div className="flex gap-1 items-center">
      <ValidationIcon status={item.status} isLoading={false} />
      <span className="text-sm  text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {((msg.bento as I18nRecord)[item.key] as string) || item.label}
      </span>
    </div>
  );
};

// Category component
const ValidationCategory = ({
  title,
  items,
  msg,
  lang,
  userGroups,
  task,
}: {
  title: string;
  items: ValidationItem[];
  msg: I18nRecord;
  lang: string;
  userGroups: string[];
  task: TaskResponse;
}) => {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-normal text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h2>
      <div className="space-y-1 flex flex-col gap-2">
        {items.map((item) => (
          <Tooltip
            style="auto"
            key={item.key}
            content={
              item.label
                ? ((msg.bento as I18nRecord)[item.label] as string)
                : item.description
                  ? ((msg.bento as I18nRecord)[item.description] as string)
                  : item.description
            }
          >
            {item.key === "gpsValidation" ? (
              <GpsValidationItem
                key={item.key}
                msg={msg}
                lang={lang}
                task={task as TaskResponse}
                userGroups={userGroups}
                item={item}
              />
            ) : (
              <ValidationItemComponent key={item.key} item={item} msg={msg} />
            )}
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

// Helper function to map API validation value to our status
const mapValidationValueToStatus = (value: number): ValidationStatus => {
  switch (value) {
    case 0:
      return "ok";
    case 1:
      return "error";
    case -1:
      return "not_found";
    default:
      return "not_found";
  }
};

// Helper function to map API validation name to our key
const mapValidationNameToKey = (name: string): string => {
  const nameToKeyMap: Record<string, string> = {
    GPS_DEVICE: "gpsValidation",
    CONSOLIDATION: "consolidation",
    RECORD_SEPARATION: "documentSeparation",
    CLIENT_SYSTEM_VALIDATION: "clientSystemValidation",
    ASSIGNED_DEPARTURE_DATE: "assignedDepartureDate",
    ASSIGNED_ARRIVAL_DATE: "assignedArrivalDate",
    ASSIGNED_DELIVERY_DATE: "assignedDeliveryDate",
    GENERAL_ALCOHOL_TEST: "generalAlcoholTest",
    GENERAL_DRUG_TEST: "generalDrugTest",
    GENERAL_SLEEP_TEST: "generalDrowsinessTest",
    GENERAL_DRIVER_APP: "driverApp",
    BIOMETRIC_VERIFICATION: "biometricValidation",
    GENERAL_BIOMETRIC_VERIFICATION: "biometricValidation",
  };
  return nameToKeyMap[name] || name.toLowerCase();
};

export default function ValidationsInfo({
  task,
  msg,
  lang,
  userGroups,
}: {
  readonly task: TaskResponse;
  readonly msg: I18nRecord;
  readonly lang: string;
  readonly userGroups: string[];
}) {
  const {
    data: serviceValidation,
    isLoading,
    error,
  } = useGetValidation(task.mintral_serviceCode);

  const validationData: ServiceValidationData =
    serviceValidation as ServiceValidationData;

  let content = null;

  if (isLoading) {
    content = (
      <div className="text-center bg-gray-300 dark:bg-gray-700 rounded-lg animate-pulse w-full h-full">
        <div className="flex gap-1 items-center opacity-0">
          <ValidationIcon status="not_found" isLoading={false} />
          <span className="text-sm  text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Fecha de llegada asignada
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    console.error(error);

    content = (
      <div className="text-center h-full flex justify-center items-center w-full">
        <span className="text-sm  text-red-500 whitespace-normal">
          Algo salió mal al obtener los
          <br></br>
          datos de validación.
        </span>
      </div>
    );
  }

  if (validationData?.validations) {
    content = (
      <div className="flex flex-col gap-4">
        {validationData?.validations.map((validation) => (
          <ValidationCategory
            key={validation.group}
            title={
              ((msg.bento as I18nRecord)[validation.group] as string) ||
              validation.group
            }
            items={validation.validations.map((validation) => ({
              key: mapValidationNameToKey(validation.name),
              status: mapValidationValueToStatus(validation.value),
              label: validation.label || validation.description,
              group: validation.group,
            }))}
            msg={msg}
            lang={lang}
            userGroups={userGroups}
            task={task}
          />
        ))}
      </div>
    );
  }

  return (
    <CustomCard title={null} subtitle={null}>
      <div className="flex flex-col h-full w-full">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-300 flex flex-row gap-2 whitespace-normal md:whitespace-nowrap items-center h-7">
          {(msg.bento as I18nRecord).validations as string}
        </h1>
        <div className="space-y-6 h-full">{content}</div>
      </div>
    </CustomCard>
  );
}
