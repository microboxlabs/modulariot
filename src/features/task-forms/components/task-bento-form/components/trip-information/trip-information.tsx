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
  return (
    <div className="flex flex-wrap items-center flex-grow bg-gray-100 dark:bg-gray-800 rounded-lg gap-2 p-2 border border-gray-300 dark:border-gray-700 portrait:w-full">
      <div className="flex flex-wrap flex-col gap-2 items-stretch w-fit">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-300 w-fit">Trip Information</h1>
        <TripData
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
        />
      </div>
      <TripVerifications
        task={task}
        msg={
          (msg.pages as I18nRecord)
            .transportValidationForm as I18nRecord
        }
        lang={lang}
        userGroups={userGroups}
      />
    </div>
  );
}
