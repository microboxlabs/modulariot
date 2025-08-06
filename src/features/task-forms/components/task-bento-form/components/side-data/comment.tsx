import { getComments } from "@/utils/comments";
import { ExtendedTaskResponse } from "@/features/task-forms/components/task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { MdOutlineCommentsDisabled } from "react-icons/md";

export default function Comment({
  task,
  dict,
}: {
  task: ExtendedTaskResponse;
  dict: I18nRecord;
}) {
  const comments = getComments(task);

  return (
    <CustomCard
      title={(dict.comments as I18nRecord).title as string}
      subtitle={(dict.comments as I18nRecord).subtitle as string}
    >
      <div className="flex p-1 gap-1 flex-1 min-h-0 flex-col overflow-y-auto bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
        {comments?.length > 0 ? (
          comments?.map((comment, index) => <div key={index}>{comment}</div>)
        ) : (
          <div className="text-gray-500 dark:text-gray-400 w-full h-full flex items-center justify-center flex-col">
            <MdOutlineCommentsDisabled className="w-8 h-8" />
            {(dict.comments as I18nRecord).no_comments as string}
          </div>
        )}
      </div>
    </CustomCard>
  );
}
