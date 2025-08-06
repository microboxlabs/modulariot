import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import Reason from "./reason";

export default function Message({
  comment,
  this_mail,
}: {
  comment: any;
  this_mail: string;
}) {
  return (
    <div
      className={`flex flex-row gap-2 ${comment.sender === this_mail ? "flex-row-reverse ml-12" : "mr-12"}`}
    >
      <InitialIdentifier name={comment.sender} />
      <div
        className={`flex flex-col ${comment.sender === this_mail ? "rounded-lg rounded-tr-none" : "rounded-lg rounded-tl-none"} p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600`}
      >
        <div className="flex flex-row gap-2">
          <p className="text-md text-gray-700 dark:text-gray-300 font-light">
            {comment.name}
          </p>
          {comment.reason && <Reason reason={comment.reason} />}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 font-light">
          {comment.message}
        </p>
      </div>
    </div>
  );
}
