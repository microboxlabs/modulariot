import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import Reason from "./reason";
import { FormattedDate } from "@/features/common/components/formatted-date/formatted-date";

// types
type FlatMessage = {
  sender: string;
  name: string;
  message: string;
  reason: string | null;
  date: string;
  topicRef: string;
};

// helpers
function isProbablyHtml(input: string): boolean {
  return /<[^>]+>/.test(input);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertNewlinesToBr(input: string): string {
  return input.replace(/\n/g, "<br/>");
}

function toRenderableHtml(message: string): string {
  const content = message || "";
  if (isProbablyHtml(content)) {
    return convertNewlinesToBr(content);
  }
  return convertNewlinesToBr(escapeHtml(content));
}

export default function Message({
  comment,
  this_mail,
}: {
  comment: FlatMessage;
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
          <div className="flex flex-wrap gap-x-2">
            <p className="text-md text-gray-700 dark:text-gray-300">
              {comment.name}
            </p>
            {comment.reason && <Reason reason={comment.reason} />}
          </div>
          <p className="font-light text-xs text-gray-400 h-full flex justify-center items-center">
            {/* {new Date(comment.date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })} */}
            <FormattedDate date={comment.date} format="time" />
          </p>
        </div>
        <p
          className="text-sm text-gray-700 dark:text-gray-300 font-light break-words"
          dangerouslySetInnerHTML={{
            __html: toRenderableHtml(comment.message),
          }}
        />
      </div>
    </div>
  );
}
