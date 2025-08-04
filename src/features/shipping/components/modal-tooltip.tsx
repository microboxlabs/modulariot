import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "@/features/task-forms/components/task-bento-form/components/trip-information/trip-information";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useGetTaskData } from "@/features/common/providers/client-api.provider";
import DriverInfo from "@/features/task-forms/components/task-bento-form/components/driver/driver";

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
  // here get the task from the task id
  const { data, error, isLoading } = useGetTaskData(selectedTask || "");

  if (!selectedTask) {
    return null;
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <AbsoluteModal selected={selectedTask} setSelected={setSelectedTask}>
      <div className="grid grid-cols-2 grid-rows-2 gap-2 p-2">
        {/* Trip Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
          <TripInformation
            task={data as unknown as TaskResponse}
            msg={dict}
            lang={lang}
            userGroups={userGroups}
          />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
          <DriverInfo task={data as unknown as TaskResponse} msg={dict} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
          <DriverInfo task={data as unknown as TaskResponse} msg={dict} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
          <DriverInfo task={data as unknown as TaskResponse} msg={dict} />
        </div>
      </div>
    </AbsoluteModal>
  );
}
