import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  ValidationItem,
  ValidationStatus,
  ServiceValidationData,
} from "./validations.types";
import { useGetValidationByServiceCode } from "@/features/common/providers/client-api.provider";
import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";

import CustomCard from "@/features/common/components/custom-card/custom-card";

// Validation status icons
const ValidationIcon = ({ status }: { status: ValidationStatus }) => {
  switch (status) {
    case "ok":
      return (
        <div className="w-5 h-5 text-white bg-gray-400 rounded-full flex items-center justify-center p-1">
          <FaCheck className="w-4 h-4" />
        </div>
      );
    case "not_found":
      return (
        <div className="w-5 h-5 text-white bg-yellow-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-4 h-4" />
        </div>
      );
    case "error":
    default:
      return (
        <div className="w-5 h-5 text-white bg-yellow-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-4 h-4" />
        </div>
      );
  }
};

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
      <ValidationIcon status={item.status} />
      <span className="text-sm  text-gray-600 dark:text-gray-300">
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
}: {
  title: string;
  items: ValidationItem[];
  msg: I18nRecord;
}) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) => (
          <ValidationItemComponent key={item.key} item={item} msg={msg} />
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
}: {
  readonly task: TaskResponse;
  readonly msg: I18nRecord;
}) {
  const { data: serviceValidation } = useGetValidationByServiceCode(
    task.mintral_serviceCode,
  );

  let validationData: ServiceValidationData | null = null;

  validationData = serviceValidation as ServiceValidationData;

  return (
    <CustomCard
      title={(msg.bento as I18nRecord).validations as string}
      subtitle={null}
    >
      <div className="space-y-6">
        {/* Equipment category - full width */}
        {validationData?.validations &&
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
            />
          ))}
      </div>
    </CustomCard>
  );
}
