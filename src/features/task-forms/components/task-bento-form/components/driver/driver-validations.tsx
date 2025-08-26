"use client";
import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { GoX } from "react-icons/go";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useGetValidation } from "@/features/common/providers/client-api.provider";
import { ValidationIcon } from "./validation-icon";
import { ValidationItem, ValidationStatus } from "./validations.types";
import { Tooltip } from "flowbite-react";
import React from "react";

function renderTooltip(
  item: ValidationItem,
  msg: I18nRecord,
  children: React.ReactNode
) {
  const tooltipMessage =
    (item.label
      ? ((msg.cards as I18nRecord)[item.label] as string) || item.label
      : item.description
        ? ((msg.cards as I18nRecord)[item.description] as string) ||
          item.description
        : "") || "";
  const shouldHideTooltip = tooltipMessage.trim() === "";

  return shouldHideTooltip ? (
    children
  ) : (
    <Tooltip style="auto" content={tooltipMessage}>
      {children}
    </Tooltip>
  );
}

export default function DriverValidations({
  driver,
  msg,
  serviceCode,
}: {
  readonly driver: Driver;
  readonly msg: I18nRecord;
  readonly serviceCode: string;
}) {
  const { data, isLoading } = useGetValidation(
    serviceCode,
    "driver",
    driver.rut
  );

  let alcoholTestStatus = "not_found";
  let drugTestStatus = "not_found";
  let sleepinessTestStatus = "not_found";
  let appTestStatus = "not_found";
  let identityTestStatus = "not_found";
  let alcoholTestTooltip = "";
  let drugTestTooltip = "";
  let sleepinessTestTooltip = "";
  let appTestTooltip = "";
  let identityTestTooltip = "";

  if (data?.validations && data.validations.length > 0) {
    data.validations.forEach((validation1) => {
      validation1.validations.forEach((validation) => {
        if (validation.name === "DRIVER_ALCOHOL_TEST") {
          alcoholTestStatus = validation.value === 0 ? "ok" : "not_found";
          alcoholTestTooltip = (validation.label ||
            validation.description ||
            "") as string;
        }
        if (validation.name === "DRIVER_DRUG_TEST") {
          drugTestStatus = validation.value === 0 ? "ok" : "not_found";
          drugTestTooltip = (validation.label ||
            validation.description ||
            "") as string;
        }
        if (validation.name === "DRIVER_SLEEP_TEST") {
          sleepinessTestStatus = validation.value === 0 ? "ok" : "not_found";
          sleepinessTestTooltip = (validation.label ||
            validation.description ||
            "") as string;
        }
        if (validation.name === "DRIVER_DRIVER_APP") {
          appTestStatus = validation.value === 0 ? "ok" : "not_found";
          appTestTooltip = (validation.label ||
            validation.description ||
            "") as string;
        }
        if (validation.name === "DRIVER_BIOMETRIC_VERIFICATION") {
          identityTestStatus = validation.value === 0 ? "ok" : "not_found";
          identityTestTooltip = (validation.label ||
            validation.description ||
            "") as string;
        }
      });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-2 w-fit">
      {renderTooltip(
        {
          key: "alcoholTest",
          status: alcoholTestStatus as ValidationStatus,
          label: alcoholTestTooltip,
        },
        msg,
        <div className="flex gap-2 items-center flex-row">
          <ValidationIcon
            status={alcoholTestStatus as ValidationStatus}
            isLoading={isLoading}
          />
          <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-normal">
            {(msg.cards as I18nRecord).alcoholTest as string}
          </span>
        </div>
      )}
      {renderTooltip(
        {
          key: "drugTest",
          status: drugTestStatus as ValidationStatus,
          label: drugTestTooltip,
        },
        msg,
        <div className="flex gap-2 items-center flex-row">
          <ValidationIcon
            status={drugTestStatus as ValidationStatus}
            isLoading={isLoading}
          />
          <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-normal">
            {(msg.cards as I18nRecord).drugTest as string}
          </span>
        </div>
      )}
      {renderTooltip(
        {
          key: "sleepinessTest",
          status: sleepinessTestStatus as ValidationStatus,
          label: sleepinessTestTooltip,
        },
        msg,
        <div className="flex gap-2 items-center flex-row">
          <ValidationIcon
            status={sleepinessTestStatus as ValidationStatus}
            isLoading={isLoading}
          />
          <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-normal">
            {(msg.cards as I18nRecord).sleepinessTest as string}
          </span>
        </div>
      )}
      {renderTooltip(
        {
          key: "appTest",
          status: appTestStatus as ValidationStatus,
          label: appTestTooltip,
        },
        msg,
        <div className="flex gap-2 items-center flex-row">
          <ValidationIcon
            status={appTestStatus as ValidationStatus}
            isLoading={isLoading}
          />
          <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-normal">
            {(msg.cards as I18nRecord).appTest as string}
          </span>
        </div>
      )}
      {renderTooltip(
        {
          key: "identityTest",
          status: identityTestStatus as ValidationStatus,
          label: identityTestTooltip,
        },
        msg,
        <div className="flex gap-2 items-center flex-row">
          <ValidationIcon
            status={identityTestStatus as ValidationStatus}
            isLoading={isLoading}
          />
          <span className="text-gray-600 dark:text-gray-300 text-sm whitespace-normal">
            {(msg.cards as I18nRecord).identityTest as string}
          </span>
        </div>
      )}
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
// Build trigger
