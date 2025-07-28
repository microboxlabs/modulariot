import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ValidationItem, ValidationStatus } from "./validations.types";
import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { GoX } from "react-icons/go";

import CustomCard from "@/features/common/components/custom-card/custom-card";

// Validation status icons
const ValidationIcon = ({ status }: { status: ValidationStatus }) => {
  switch (status) {
    case "approved":
      return (
        <div className="w-5 h-5 text-white bg-green-500 border border-gray-400 rounded-full flex items-center justify-center p-1">
          <FaCheck className="w-full h-full" />
        </div>
      );
    case "alert":
      return (
        <div className="w-5 h-5 text-white bg-yellow-300 border border-gray-400 rounded-full flex items-center justify-center">
          <TbExclamationMark className="w-full h-full" />
        </div>
      );
    case "not_approved":
      return (
        <div className="w-5 h-5 text-white bg-red-500 border border-gray-400 rounded-full flex items-center justify-center">
          <GoX className="w-full h-full" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="w-5 h-5 bg-white border border-gray-400 rounded-full flex-shrink-0" />
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
  const isNotApproved = item.status === "not_approved";
  return (
    <div className="flex gap-2 items-center">
      <ValidationIcon status={item.status} />
      <span
        className={`text-sm ${
          isNotApproved ? "text-red-500" : "text-gray-600 dark:text-gray-300"
        }`}
      >
        {(msg.bento as I18nRecord)[item.key] as string}
      </span>
    </div>
  );
};

export default function ValidationsInfo({
  task,
  msg,
}: {
  task: TaskResponse;
  msg: I18nRecord;
}) {
  const { data: _serviceValidation } = useGetServiceValidation(
    task.mintral_serviceCode as string,
  );

  console.log(_serviceValidation);
  console.log("--------------------------------");
  console.log(task);
  // Helper function to determine validation status based on service validation data
  const getValidationStatus = (validationKey: string): ValidationStatus => {
    // For now, we'll use mock data. In a real implementation,
    // this would be based on actual validation data from the task or API
    const mockStatuses: Record<string, ValidationStatus> = {
      gpsValidation: "not_approved",
      consolidation: "approved",
      documentSeparation: "approved",
      clientSystemValidation: "approved",
      assignedDepartureDate: "approved",
      assignedArrivalDate: "not_approved",
      assignedDeliveryDate: "approved",
      generalAlcoholTest: "approved",
      generalDrugTest: "approved",
      generalDrowsinessTest: "approved",
      driverApp: "approved",
      biometricValidation: "alert",
    };

    return mockStatuses[validationKey] || "pending";
  };

  // Define all validations to display
  const validations: ValidationItem[] = [
    {
      key: "gpsValidation",
      status: getValidationStatus("gpsValidation"),
      label: "GPS Validation",
    },
    {
      key: "consolidation",
      status: getValidationStatus("consolidation"),
      label: "Consolidation",
    },
    {
      key: "documentSeparation",
      status: getValidationStatus("documentSeparation"),
      label: "Document Separation",
    },
    {
      key: "clientSystemValidation",
      status: getValidationStatus("clientSystemValidation"),
      label: "Client System Validation",
    },
    {
      key: "assignedDepartureDate",
      status: getValidationStatus("assignedDepartureDate"),
      label: "Assigned Departure Date",
    },
    {
      key: "assignedArrivalDate",
      status: getValidationStatus("assignedArrivalDate"),
      label: "Assigned Arrival Date",
    },
    {
      key: "assignedDeliveryDate",
      status: getValidationStatus("assignedDeliveryDate"),
      label: "Assigned Delivery Date",
    },
    {
      key: "generalAlcoholTest",
      status: getValidationStatus("generalAlcoholTest"),
      label: "General Alcohol Test",
    },
    {
      key: "generalDrugTest",
      status: getValidationStatus("generalDrugTest"),
      label: "General Drug Test",
    },
    {
      key: "generalDrowsinessTest",
      status: getValidationStatus("generalDrowsinessTest"),
      label: "General Drowsiness Test",
    },
    {
      key: "driverApp",
      status: getValidationStatus("driverApp"),
      label: "Driver App",
    },
    {
      key: "biometricValidation",
      status: getValidationStatus("biometricValidation"),
      label: "Biometric Validation",
    },
  ];

  return (
    <CustomCard
      title={(msg.bento as I18nRecord).validations as string}
      subtitle={null}
    >
      <div className="flex flex-col flex-grow rounded-lg whitespace-nowrap relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
          {validations.map((validation) => (
            <ValidationItemComponent
              key={validation.key}
              item={validation}
              msg={msg}
            />
          ))}
        </div>
      </div>
    </CustomCard>
  );
}
