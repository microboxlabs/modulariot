import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { ExtendedTaskViewProps } from "@/features/task-forms/components/task-form/task-form.types";
import { HiClipboardList } from "react-icons/hi";
import { defaultLocale } from "@/features/i18n/tr.service";
import { getDictionary } from "@/features/i18n/i18n.service";
import DriverUserIcon from "@/features/icons/driver-user";
import DriverContactInfo from "@/features/task-forms/components/driver-contact-info/driver-contact-info";
import DriverValidation from "@/features/task-forms/components/driver-validation-card/driver-validation-card";
import { Driver } from "@/features/task-forms/components/driver-contact-info/driver-contact-info.type";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import TripInformation from "@/features/task-forms/components/trip-information-card/trip-information";
/* import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types"; */
import {
  /* ServiceValidationResponse, */
  TaskResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TaskActions from "@/features/task-forms/components/task-actions/task-actions";
import { ShippingCoordinatorProcessForms } from "@/features/task-forms/services/form.service.types";
import { getComments } from "@/utils/comments";
import { GeographicHistoric } from "../geographic-historic";

/* const TaskHeader = ({ title, endTime }: { title: string; endTime: string }) => (
  <Card className="pb-4">
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <span className="text-sm text-muted-foreground">
        {(new Date(endTime), "")}
      </span>
    </div>
  </Card>
); */

export async function NextCancelTripView({
  task,
  msg,
  lang,
}: ExtendedTaskViewProps) {
  const [dict, dictionary] = await getDictionary(lang ?? defaultLocale);
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

  const form_keys = [
    "wfship:monitoringInCourseTrip",
    "wfship:confirmTripDestinationArrival",
    "wfship:confirmMonitoringFinalization",
    "wfship:confirmTripDestinationDeparture",
    "wfship:confirmDelivery",
  ];

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-5">
        <Breadcrumb
          path={["tasks", "shipping", "details"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dictionary.pages as I18nRecord}
        />
      </div>
      <div className="w-full flex-1 flex h-full overflow-hidden px-2 pb-2 gap-2">
        <div className="h-full">
          <div className="h-full overflow-auto dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center justify-center">
                <DriverUserIcon />
              </div>
              <div className="h-px bg-gray-300 w-full"></div>
              {driver1 && <DriverContactInfo msg={msg!} driver={driver1} />}
              {driver2 && (
                <>
                  <div className="h-px bg-gray-300 w-full"></div>
                  <DriverContactInfo msg={msg!} driver={driver2} />
                </>
              )}
              <div className="h-px bg-gray-300 w-full"></div>
              <DriverValidation
                msg={msg!}
                driver1={driver1}
                driver2={driver2}
              />

              <div className="h-px bg-gray-300 w-full"></div>
              <TripInformation
                msg={msg}
                task={task as TaskResponse}
                lang={lang}
                entityInfo={undefined}
                serviceValidation={undefined}
              />

              <div className="h-px bg-gray-300 w-full"></div>
              <form>
                <h5 className="text-sm font-medium leading-loose text-gray-900 dark:text-white">
                  {}
                </h5>
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-medium leading-loose text-gray-900 dark:text-white">
                    {dict("pages.shippingDetailsTaskForm.comments")}
                  </p>

                  <p className="text-xs font-medium leading-loose text-gray-700 dark:text-white">
                    {getComments(task)}
                  </p>
                </div>
              </form>
              <div className="h-px bg-gray-300 w-full"></div>

              <div className="flex items-center justify-center">
                <TaskActions
                  taskId={task.id ?? ""}
                  taskType={task.taskFormKey as ShippingCoordinatorProcessForms}
                  lang={lang}
                  dict={
                    (dictionary.pages as I18nRecord)
                      .shippingDetailsTaskForm as I18nRecord
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <div
          className={`flex-1 flex h-full w-full ${
            form_keys.includes(task.taskFormKey as string)
              ? "flex-row"
              : "flex-col"
          }`}
        >
          {form_keys.includes(task.taskFormKey as string) && (
            <div className="flex h-full w-full">
              <GeographicHistoric
                task={task as TaskResponse}
                dictionary={dictionary as unknown as Record<string, string>}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
