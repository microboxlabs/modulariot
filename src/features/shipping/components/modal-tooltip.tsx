import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripInformation from "@/features/task-forms/components/task-bento-form/components/trip-information/trip-information";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useGetTasksById } from "@/features/common/providers/client-api.provider";
import DriverInfo from "@/features/task-forms/components/task-bento-form/components/driver/driver";
import { Spinner } from "flowbite-react";
import ValidationsInfo from "@/features/task-forms/components/task-bento-form/components/driver/validations";
import SymptomsCard from "@/features/task-forms/components/task-bento-form/components/side-data/symptoms-card";
import BentoHead from "@/features/task-forms/components/task-bento-form/bento-head";
import { usePathname } from "next/navigation";
import { pathNameWithoutLanguage } from "@/features/layout/utils/utils";

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
  /*
  const taskResponse = await getFinishedWorkflowByInstanceId(
    session.user.ticket,
    taskId,
  );
  */

  // Only fetch data when selectedTask is not null - this prevents unnecessary requests
  // and automatically cancels the request when selectedTask becomes null (modal closes)

  const pathname = usePathname();
  const pathWithoutLang = pathNameWithoutLanguage(pathname);
  const isFinishedPage = pathWithoutLang.includes("/finished");

  const { data, error, isLoading } = useGetTasksById(
    selectedTask ? selectedTask : "",
    isFinishedPage,
  );

  if (!selectedTask) {
    return null;
  }

  return (
    <AbsoluteModal
      selected={selectedTask}
      setSelected={setSelectedTask}
      maxWidth="1300px"
      maxHeight="90vh"
      height="fit-content"
    >
      {isLoading && (
        <div className="flex justify-center items-center h-full p-5">
          <Spinner size="lg" />
        </div>
      )}
      {error && <div>Error: {error.message}</div>}
      {!isLoading && !error && data && (
        <div className="flex flex-col bg-gray-100 dark:bg-gray-700 overflow-y-auto h-full">
          <BentoHead
            show_horeference={false}
            task={data.taskResponse as TaskResponse}
            dict={dict}
            msg={dict}
            lang={lang}
            showActions={false}
            enableActions={false}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 w-full overflow-y-auto">
            {/* Trip Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
              <TripInformation
                task={data.taskResponse as unknown as TaskResponse}
                msg={dict}
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
              <SymptomsCard
                task={data.taskResponse as unknown as TaskResponse}
                dict={dict as I18nRecord}
                reactive={false}
              />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
              <ValidationsInfo
                task={data.taskResponse as unknown as TaskResponse}
                msg={dict}
                lang={lang}
                userGroups={userGroups}
              />
            </div>
          </div>
        </div>
      )}
    </AbsoluteModal>
  );
}
