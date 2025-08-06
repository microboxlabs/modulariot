import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "@/features/task-forms/components/task-bento-form/components/trip-information/trip-information";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useGetTaskData } from "@/features/common/providers/client-api.provider";
import DriverInfo from "@/features/task-forms/components/task-bento-form/components/driver/driver";
import { Spinner } from "flowbite-react";

export default function ModalTooltip({
  selectedTask,
  setSelectedTask,
  dict,
  lang,
  userGroups,
}: {
  selectedTask: string | null;
  setSelectedTask: (task: string | null) => void;
  dict: I18nRecord;
  lang: string;
  userGroups: string[];
}) {
  // Only fetch data when selectedTask is not null - this prevents unnecessary requests
  // and automatically cancels the request when selectedTask becomes null (modal closes)
  const { data, error, isLoading } = useGetTaskData(
    selectedTask ? selectedTask : "",
  );

  if (!selectedTask) {
    return null;
  }

  return (
    <AbsoluteModal selected={selectedTask} setSelected={setSelectedTask}>
      {isLoading && (
        <div className="flex justify-center items-center h-full p-5">
          <Spinner size="lg" />
        </div>
      )}
      {error && <div>Error: {error.message}</div>}
      {!isLoading && !error && (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 p-2">
          {/* Trip Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
            <TripInformation
              task={data.taskResponse as unknown as TaskResponse}
              msg={dict}
              lang={lang}
              userGroups={userGroups}
              isLoading={isLoading}
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
            <DriverInfo
              task={data.taskResponse as unknown as TaskResponse}
              msg={dict}
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
            <DriverInfo
              task={data.taskResponse as unknown as TaskResponse}
              msg={dict}
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
            <DriverInfo
              task={data.taskResponse as unknown as TaskResponse}
              msg={dict}
            />
          </div>
        </div>
      )}
    </AbsoluteModal>
  );
}
