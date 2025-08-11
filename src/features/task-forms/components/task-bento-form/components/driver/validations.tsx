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

// Validation item component
const ValidationItemComponent = ({
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
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) =>
          item.key === "gpsValidation" ? (
            <GpsValidationItem
              key={item.key}
              msg={msg}
              lang={lang}
              task={task as TaskResponse}
              userGroups={userGroups}
            />
          ) : (
            <ValidationItemComponent key={item.key} item={item} msg={msg} />
          ),
        )}
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
  const { data: serviceValidation } = useGetValidation(
    task.mintral_serviceCode,
  );

  const validationData: ServiceValidationData =
    serviceValidation as ServiceValidationData;

  return (
    <CustomCard
      title={(msg.bento as I18nRecord).validations as string}
      subtitle={null}
    >
      <div className="space-y-6">
        {/* Equipment category - full width */}
        {validationData?.validations ? (
          validationData?.validations.map((validation) => (
            <ValidationCategory
              key={validation.group}
              title={
                ((msg.bento as I18nRecord)[validation.group] as string) ||
                validation.group
              }
              items={validation.validations.map((validation) => ({
                key: mapValidationNameToKey(validation.name),
                status: mapValidationValueToStatus(validation.value),
                label: validation.name,
                group: validation.group,
              }))}
              msg={msg}
              lang={lang}
              userGroups={userGroups}
              task={task}
            />
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 w-fit">
            <div className="flex gap-1 items-center">
              <ValidationIcon status="not_found" isLoading={false} />
              <span className="text-sm  text-gray-600 dark:text-gray-300 whitespace-nowrap">
                Ejemplo de validaciones
              </span>
            </div>
          </div>
        )}
      </div>
    </CustomCard>
  );
}
