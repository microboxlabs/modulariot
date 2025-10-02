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
import { useEffect } from "react";

export default function ModalTooltip({
  selectedTask,
  setSelectedTask,
  dict,
  lang,
  userGroups,
}: {
  readonly selectedTask: string | null;
  readonly setSelectedTask: (task: string | null) => void;
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly userGroups: string[];
}) {
  const pathname = usePathname();
  const pathWithoutLang = pathNameWithoutLanguage(pathname);
  const isFinishedPage = pathWithoutLang.includes("/finished");

  const { data, error, isLoading } = useGetTasksById(
    selectedTask ?? "",
    isFinishedPage
  );

  useEffect(() => {
    if (data?.taskResponse === null) {
      setSelectedTask(null);
    }
  }, [data?.taskResponse, setSelectedTask]);

  if (!selectedTask) {
    return null;
  }

  if (data?.taskResponse == null && !isLoading && !error) {
    return (
      <AbsoluteModal
        selected={selectedTask}
        setSelected={setSelectedTask}
        maxWidth="1500px"
        maxHeight="90vh"
        height=""
      >
        <div className="p-4 text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </AbsoluteModal>
    );
  }

  return (
    <AbsoluteModal
      selected={selectedTask}
      setSelected={setSelectedTask}
      maxWidth="1500px"
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
        <div className="flex flex-col bg-gray-100 dark:bg-gray-700 overflow-y-auto h-full cursor-default">
          <BentoHead
            show_horeference={false}
            task={data.taskResponse as TaskResponse}
            dict={dict}
            msg={dict}
            lang={lang}
            showActions={false}
            enableActions={false}
            show_go_to_bento={true}
          />
          <div className="grid grid-cols-1 gap-2 p-2 w-full overflow-y-auto">
            <div className="flex flex-col xl:flex-row w-full gap-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full xl:w-fit">
                <TripInformation
                  task={data.taskResponse as unknown as TaskResponse}
                  msg={dict}
                  isLoading={isLoading}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-fit">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow">
                  <DriverInfo
                    task={data.taskResponse as unknown as TaskResponse}
                    msg={dict}
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full sm:w-fit">
                  <ValidationsInfo
                    task={data.taskResponse as unknown as TaskResponse}
                    msg={dict}
                    lang={lang}
                    userGroups={userGroups}
                  />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-grow w-full">
              <SymptomsCard
                task={data.taskResponse as unknown as TaskResponse}
                dict={dict}
                reactive={false}
              />
            </div>
          </div>
        </div>
      )}
    </AbsoluteModal>
  );
}
