import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Tooltip } from "flowbite-react";
import { FaCheck, FaIdCard, FaPhoneAlt, FaTimes } from "react-icons/fa";
import { IoIosMail } from "react-icons/io";
import { Driver } from "../../../driver-contact-info/driver-contact-info.type";
import DriverValidations from "./driver-validations";

export default function DriverData({
  driver,
  msg,
}: {
  driver: Driver;
  msg: I18nRecord;
}) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex flex-col">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-300 flex flex-row gap-2 whitespace-normal md:whitespace-nowrap items-center">
          {driver.name}
          <Tooltip
            style="auto"
            content={
              <div className="text-gray-600 dark:text-gray-400 text-sm flex gap-1 items-center w-fit font-light whitespace-nowrap">
                {(msg.bento as I18nRecord).biometric_verification as string}:{" "}
                <span className="text-gray-800 dark:text-gray-100 text-sm">
                  {driver.status === "verified"
                    ? ((msg.bento as I18nRecord).verified as string)
                    : ((msg.bento as I18nRecord).not_verified as string)}
                </span>
              </div>
            }
          >
            {driver.status === "verified" && (
              <div className="border border-green-500 bg-green-500 rounded-full p-1">
                <FaCheck className="w-4 h-4 text-white" />
              </div>
            )}
            {driver.status !== "verified" && (
              <div className="border border-red-500 bg-red-500 rounded-full p-1">
                <FaTimes className="w-4 h-4 text-white" />
              </div>
            )}
          </Tooltip>
        </h1>
        <h2 className="text-sm font-normal text-gray-500 dark:text-gray-400">
          {
            ((msg.pages as I18nRecord).shippingDetailsTaskForm as I18nRecord)[
              driver.varName as string
            ] as string
          }
        </h2>
      </div>

      {/* Trip specific data */}
      <div className="flex flex-row gap-2 items-stretch h-full">
        <div className="flex flex-col">
          <div className="flex text-sm text-gray-500 dark:text-gray-400 flex-col font-light h-full justify-center gap-1">
            <span className="text-gray-600 dark:text-gray-400 text-xs bg-gray-200 dark:bg-gray-700 rounded-md py-[0.15rem] px-1 flex gap-2 items-center w-fit">
              <FaIdCard className="w-4 h-4 inline-block" />
              <span className="text-gray-800 dark:text-gray-200 text-sm">
                {driver.rut}
              </span>
            </span>
            <span className="text-gray-600 dark:text-gray-400 text-xs bg-gray-200 dark:bg-gray-700 rounded-md py-[0.15rem] px-1 flex gap-2 items-center w-fit">
              <FaPhoneAlt className="w-4 h-4 inline-block" />
              <span className="text-gray-800 dark:text-gray-200 text-sm">
                {driver.phone}
              </span>
            </span>
            <span className="text-gray-600 dark:text-gray-400 text-xs bg-gray-200 dark:bg-gray-700 rounded-md py-[0.15rem] px-1 flex gap-2 items-center w-fit">
              <IoIosMail className="w-4 h-4 inline-block" />
              <span className="text-gray-800 dark:text-gray-200 text-sm">
                {driver.email}
              </span>
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          <DriverValidations
            _driver={driver}
            msg={
              (msg.pages as I18nRecord).transportValidationForm as I18nRecord
            }
          />
        </div>
      </div>
    </div>
  );
}
