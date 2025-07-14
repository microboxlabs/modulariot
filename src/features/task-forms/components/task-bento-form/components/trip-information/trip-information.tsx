import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripData from "./trip-data";
import TripVerifications from "./trip-verifications";

export default function TripInformation({
  task,
  msg,
  lang,
  userGroups,
}: {
  task: TaskResponse;
  msg: I18nRecord;
  lang: string;
  userGroups: string[];
}) {
  console.log(task);

  return (
    <div className="flex flex-col flex-grow rounded-lg gap-2 dark:border-gray-700 portrait:w-full">
      <div className="flex flex-wrap gap-2">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-300 w-fit">
          Trip Information
        </h1>
        <h2 className="text-sm flex font-normal items-end text-gray-600  dark:text-gray-400 w-fit">
          {task.mintral_serviceCode + "-V"}
        </h2>
      </div>
      <div className="flex flex-wrap gap-2 w-fit">
        <TripData
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
        />
        <TripVerifications
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
          lang={lang}
          userGroups={userGroups}
        />
      </div>
    </div>
  );
}
