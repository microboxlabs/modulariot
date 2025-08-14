import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { GoX } from "react-icons/go";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
/* import { useGetValidation } from "@/features/common/providers/client-api.provider"; */
import { getValidationByServiceCode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { auth } from "@/auth";
import { ValidationIcon } from "./validation-icon";
import { ValidationStatus } from "./validations.types";

export default async function DriverValidations({
  driver,
  msg,
  serviceCode,
}: {
  driver: Driver;
  msg: I18nRecord;
  serviceCode: string;
}) {
  const session = await auth();
  if (!session) {
    return <div>No session</div>;
  }

  const tasks = await getValidationByServiceCode(
    session,
    serviceCode,
    "driver",
    driver.rut,
  ).catch(() => {
    return { validations: [] };
  });

  let alcoholTestStatus = "not_found";
  let drugTestStatus = "not_found";
  let sleepinessTestStatus = "not_found";
  let appTestStatus = "not_found";
  let identityTestStatus = "not_found";

  if (tasks?.validations?.length > 0) {
    tasks.validations.forEach((validation1) => {
      validation1.validations.forEach((validation) => {
        if (validation.name === "DRIVER_ALCOHOL_TEST") {
          alcoholTestStatus = validation.value === 0 ? "ok" : "not_found";
        }
        if (validation.name === "DRIVER_DRUG_TEST") {
          drugTestStatus = validation.value === 0 ? "ok" : "not_found";
        }
        if (validation.name === "DRIVER_SLEEP_TEST") {
          sleepinessTestStatus = validation.value === 0 ? "ok" : "not_found";
        }
        if (validation.name === "DRIVER_DRIVER_APP") {
          appTestStatus = validation.value === 0 ? "ok" : "not_found";
        }
        if (validation.name === "DRIVER_BIOMETRIC_VERIFICATION") {
          identityTestStatus = validation.value === 0 ? "ok" : "not_found";
        }
      });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-1 w-fit">
      <div className="flex gap-2 items-center flex-row">
        <ValidationIcon status={alcoholTestStatus as ValidationStatus} />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).alcoholTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <ValidationIcon status={drugTestStatus as ValidationStatus} />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).drugTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <ValidationIcon status={sleepinessTestStatus as ValidationStatus} />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).sleepinessTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <ValidationIcon status={appTestStatus as ValidationStatus} />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).appTest as string}
        </span>
      </div>
      <div className="flex gap-2 items-center flex-row">
        <ValidationIcon status={identityTestStatus as ValidationStatus} />
        <span className="text-gray-400 text-sm">
          {(msg.cards as I18nRecord).identityTest as string}
        </span>
      </div>
    </div>
  );
}

export function Ellipse() {
  return (
    <div className="w-5 h-5 bg-white border border-gray-400 rounded-full flex-shrink-0" />
  );
}

export function CheckCircle() {
  return (
    <div className="w-5 h-5 text-white bg-green-500 border border-gray-400 rounded-full flex items-center justify-center p-1">
      <FaCheck className="w-full h-full" />
    </div>
  );
}

export function Exclamation() {
  return (
    <div className="w-5 h-5 text-white bg-yellow-300 border border-gray-400 rounded-full flex items-center justify-center">
      <TbExclamationMark className="w-full h-full" />
    </div>
  );
}

export function ErrorCircle() {
  return (
    <div className="w-5 h-5 text-white bg-red-500 border border-gray-400 rounded-full flex items-center justify-center">
      <GoX className="w-full h-full" />
    </div>
  );
}
