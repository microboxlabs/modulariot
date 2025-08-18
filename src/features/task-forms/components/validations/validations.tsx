"use client";
import CheckCircleIcon from "@/features/icons/check-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import ErrorCircleIcon from "@/features/icons/error-circle";
import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import { TaskFormProps } from "../task-form/task-form.types";
/* import GpsValidationItem from "../gps-validation-item/gps-validation-item";
import { I18nRecord } from "@/features/i18n/i18n.service.types"; */
import EllipseIcon from "@/features/icons/ellipse";
import { logger } from "@/lib/logger";

export default function Validations({
  task,
  lang,
  msg,
  userGroups,
}: TaskFormProps) {
  const { data: serviceValidation, isLoading: _isLoadingServiceValidation } =
    useGetServiceValidation(task.mintral_serviceCode as string);
  logger.info("lang", lang);
  logger.info("userGroups", userGroups);
  return (
    <div className="text-gray-600 flex flex-row justify-between w-full">
      <small className="flex items-center p-3">
        {serviceValidation?.v_01?.v_01eval === 1 && <CheckCircleIcon />}
        {serviceValidation?.v_01?.v_01eval === 2 && <ExclamationIcon />}
        {serviceValidation?.v_01?.v_01eval === 3 && <ErrorCircleIcon />}
        {serviceValidation?.error && <EllipseIcon />}
        <span className="text-gray-400 text-sm ml-2">
          {msg?.check1Subtitle as string}
        </span>
      </small>
      <small className="flex items-center p-3">
        {serviceValidation?.v_02?.v_02eval === 1 && <CheckCircleIcon />}
        {serviceValidation?.v_02?.v_02eval === 2 && <ExclamationIcon />}
        {serviceValidation?.v_02?.v_02eval === 3 && <ErrorCircleIcon />}
        {serviceValidation?.error && <EllipseIcon />}
        <span className="text-gray-400 text-sm ml-2">
          {msg?.check2Subtitle as string}
        </span>
      </small>
      <small className="flex items-center p-3">
        {serviceValidation?.v_03?.v_03eval === 1 && <CheckCircleIcon />}
        {serviceValidation?.v_03?.v_03eval === 2 && <ExclamationIcon />}
        {serviceValidation?.v_03?.v_03eval === 3 && <ErrorCircleIcon />}
        {serviceValidation?.error && <EllipseIcon />}
        <span className="text-gray-400 text-sm ml-2">
          {msg?.check3Subtitle as string}
        </span>
      </small>
      {/* <GpsValidationItem
        task={task}
        lang={lang}
        userGroups={userGroups}
        msg={{
          check4Subtitle: msg?.check4Subtitle as string,
          cards: msg?.cards as I18nRecord,
        }}
        item={null}
      /> */}
    </div>
  );
}
