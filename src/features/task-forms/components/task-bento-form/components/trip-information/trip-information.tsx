import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import CheckCircleIcon from "@/features/icons/check-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import ErrorCircleIcon from "@/features/icons/error-circle";
import EllipseIcon from "@/features/icons/ellipse";
import TripData from "./trip-data";
import TripVerifications from "./trip-verifications";

export default function TripInformation( {task, msg, lang, userGroups}: {task: TaskResponse, msg: I18nRecord, lang: string, userGroups: string[]}) {
  return (
    <div className="flex flex-col h-fit w-fit bg-gray-200 rounded-lg p-2 border border-gray-300 portrait:w-full">
        <h1 className="text-md font-normal text-gray-700">Trip Information</h1>
        <div className="flex text-sm text-gray-500 flex-col gap-2 font-light pl-1">Federico Echeverria Ramirez Segundo</div>
        {/* Trip specific data */}
        <div className="flex flex-row gap-2 mt-2 items-stretch">
          <TripData task={task} msg={msg} />
          <div className="w-px bg-gray-300 self-stretch"/>
          <TripVerifications task={task} msg={msg} lang={lang} userGroups={userGroups} />
        </div>
        {/* Trip verifications */}
    </div>
  );
}