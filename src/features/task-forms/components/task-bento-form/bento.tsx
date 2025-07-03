"use client";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { fromString } from "@/features/common/services/days.service";
import GpsValidationItem from "../gps-validation-item/gps-validation-item";
import CheckCircleIcon from "@/features/icons/check-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import ErrorCircleIcon from "@/features/icons/error-circle";
import EllipseIcon from "@/features/icons/ellipse";
import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import TripInformation from "./components/trip-information/trip-information";

export default function Bento({
  lang,
  task,
  user,
  userGroups,
  msg,
  active,
}: {
  lang: string;
  task: TaskResponse;
  user: string;
  userGroups: string[];
  msg: I18nRecord;
  active: boolean;
}) {
  console.log(task)

  

  

  return (
    <div className="flex w-full h-full p-2 gap-2">
      <div className="w-1/2">
        <TripInformation task={task} msg={msg} lang={lang} userGroups={userGroups} />
      </div>
      <div className="w-1/2">
        <TripInformation task={task} msg={msg} lang={lang} userGroups={userGroups} />
      </div>
    </div>
  );
}