import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import DriverData from "./driver-data";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";
import CustomCard from "@/features/common/components/custom-card/custom-card";

export default function DriverInfo({
  task,
  msg,
}: {
  task: TaskResponse;
  msg: I18nRecord;
}) {
  const driver1: Driver = {
    name: (task.mintral_driver1Name as string) ?? "-",
    email: (task.mintral_driver1Email as string) ?? "-",
    phone: (task.mintral_driver1Phone as string) ?? "-",
    rut: (task.mintral_driver1Rut as string) ?? "-",
    status: "verified",
    varName: "driver1",
  };
  let driver2: Driver | undefined;
  const driver2Name = task.mintral_driver2Name as string;
  if (driver2Name && driver2Name.trim() !== "") {
    driver2 = {
      name: (task.mintral_driver2Name as string) ?? "-",
      email: (task.mintral_driver2Email as string) ?? "-",
      phone: (task.mintral_driver2Phone as string) ?? "-",
      rut: (task.mintral_driver2Rut as string) ?? "-",
      status: "verified",
      varName: "driver2",
    };
  }

  return (
    <CustomCard title={null} subtitle={null}>
      <div className="flex flex-col flex-grow rounded-lg whitespace-nowrap relative">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-300 flex flex-row gap-2 whitespace-normal md:whitespace-nowrap items-center h-7">
          {((msg as I18nRecord).symptoms as I18nRecord).drivers as string}
        </h1>
        <div className="flex flex-row gap-4">
          <DriverData
            driver={driver1}
            msg={msg}
            serviceCode={task.mintral_serviceCode}
          />
          {driver2 && (
            <DriverData
              driver={driver2}
              msg={msg}
              serviceCode={task.mintral_serviceCode}
            />
          )}
        </div>
      </div>
    </CustomCard>
  );
}
