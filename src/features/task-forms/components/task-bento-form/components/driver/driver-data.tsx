import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FaIdCard, FaPhoneAlt, FaUser } from "react-icons/fa";
//import { IoIosMail } from "react-icons/io";
import { Driver } from "../../../driver-contact-info/driver-contact-info.type";
import DriverValidations from "./driver-validations";

export default function DriverData({
  driver,
  msg,
  serviceCode,
}: {
  driver: Driver;
  msg: I18nRecord;
  serviceCode: string;
}) {
  const data = [
    {
      icon: <FaUser className="w-4 h-4 inline-block" />,
      value: driver.name,
    },
    {
      icon: <FaPhoneAlt className="w-4 h-4 inline-block" />,
      value: driver.phone,
    },
    {
      icon: <FaIdCard className="w-4 h-4 inline-block" />,
      value: driver.rut,
    } /* 
    {
      icon: <IoIosMail className="w-4 h-4 inline-block" />,
      value: driver.email,
    }, */,
  ];

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex flex-col">
        <h2 className="text-sm font-normal text-gray-500 dark:text-gray-400">
          {
            ((msg.pages as I18nRecord).shippingDetailsTaskForm as I18nRecord)[
              driver.varName as string
            ] as string
          }
        </h2>
      </div>

      {/* Trip specific data */}
      <div className="flex flex-row gap-4 items-stretch">
        <div className="flex flex-col">
          <div className="grid grid-cols-1 gap-2 w-fit">
            {data.map((item, index) => (
              <span
                className="text-gray-400 whitespace-nowrap w-fit flex flex-col sm:flex-row text-sm font-light gap-1"
                key={index}
              >
                {item.icon}
                <span className="text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {item.value}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-normal text-gray-500 dark:text-gray-400 mt-3 mb-2">
              {(msg.bento as I18nRecord).validations as string}
            </h2>
          </div>
          <DriverValidations
            driver={driver}
            serviceCode={serviceCode}
            msg={
              (msg.pages as I18nRecord).transportValidationForm as I18nRecord
            }
          />
        </div>
      </div>
    </div>
  );
}
