import { getComments } from "@/utils/comments";
import { ExtendedTaskResponse } from "@/features/task-forms/components/task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Comment({
  task,
  dict,
}: {
  task: ExtendedTaskResponse;
  dict: I18nRecord;
}) {
  const comments = getComments(task);

  return (
    <div className="w-full h-full p-2 flex flex-col gap-2">
      <div className="block">
        <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
          {(dict.comments as I18nRecord).title as string}
        </h1>
        <h2 className="text-sm font-light text-gray-500 dark:text-gray-400">
          {(dict.comments as I18nRecord).subtitle as string}
        </h2>
      </div>
      <div className="flex flex-grow bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-gray-700 dark:text-gray-300">
        {comments}
      </div>
    </div>
  );
}
