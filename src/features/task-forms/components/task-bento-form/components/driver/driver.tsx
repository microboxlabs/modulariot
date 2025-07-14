import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import DriverData from "./driver-data";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";

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
    varName: "Driver 1",
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
      varName: "Driver 2",
    };
  }

  return (
    <div className="flex flex-col flex-grow rounded-lg whitespace-nowrap relative">
      <DriverData driver={driver1} msg={msg} />
      {driver2 && (
        <>
          <hr className="w-full mb-2 mt-3 dark:border-gray-700" />
          <DriverData driver={driver2} msg={msg} />
        </>
      )}
    </div>
  );
}
