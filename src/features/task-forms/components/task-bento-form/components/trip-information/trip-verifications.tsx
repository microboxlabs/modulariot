"use client";

import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CheckCircleIcon from "@/features/icons/check-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import ErrorCircleIcon from "@/features/icons/error-circle";
import EllipseIcon from "@/features/icons/ellipse";
import GpsValidationItem from "../../../gps-validation-item/gps-validation-item";
import { FaCheck } from "react-icons/fa";
import { TbExclamationMark } from "react-icons/tb";
import { GoX } from "react-icons/go";

export default function TripVerifications({
  task,
  msg,
  lang,
  userGroups,
}: {
  task: TaskResponse;
  msg: I18nRecord;
  lang: string;
  userGroups: string[];
}) {
  const { data: serviceValidation, isLoading: _isLoadingServiceValidation } =
    useGetServiceValidation(task.mintral_serviceCode as string);

  const isError = (value?: {
    v_01eval?: number;
    v_02eval?: number;
    v_03eval?: number;
  }) =>
    serviceValidation?.error ||
    value?.v_01eval == -1 ||
    value?.v_02eval == -1 ||
    value?.v_03eval == -1;

  const executionType =
    task.mintral_executionType === "T"
      ? "Troncal"
      : task.mintral_executionType === "F"
        ? "Faena"
        : task.mintral_executionType;
  const priority =
    task.mintral_priorityCode === "UR"
      ? "URGENTE"
      : task.mintral_priorityCode === "RG"
        ? "REGULARIZACIÓN"
        : task.mintral_priorityCode;

  return (
    <div className="flex-1 flex flex-col gap-1 whitespace-nowrap w-full h-fit justify-center">
      <div className="flex gap-2 items-center">
        {isError(serviceValidation?.v_01) && <Ellipse />}
        {serviceValidation?.v_01?.v_01eval === 1 && <CheckCircle />}
        {serviceValidation?.v_01?.v_01eval === 2 && <Exclamation />}
        {serviceValidation?.v_01?.v_01eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).consolidation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        {isError(serviceValidation?.v_02) && <Ellipse />}
        {serviceValidation?.v_02?.v_02eval === 1 && <CheckCircle />}
        {serviceValidation?.v_02?.v_02eval === 2 && <Exclamation />}
        {serviceValidation?.v_02?.v_02eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).documentSeparation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        {isError(serviceValidation?.v_03) && <Ellipse />}
        {serviceValidation?.v_03?.v_03eval === 1 && <CheckCircle />}
        {serviceValidation?.v_03?.v_03eval === 2 && <Exclamation />}
        {serviceValidation?.v_03?.v_03eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).clientSystemValidation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <GpsValidationItem
          msg={msg}
          lang={lang}
          task={task}
          userGroups={userGroups}
        />
      </div>
    </div>
  );
}

export function Ellipse() {
  return (
    <div className="w-5 h-5 bg-white border border-gray-400 rounded-full flex-shrink-0" />
  );
}

/**
 <FaCheck />
<GoCheck />
<GoX />
<TbExclamationMark />
 
 */

export function CheckCircle() {
  return (
    <div className="w-5 h-5 text-white bg-green-500 border border-gray-400 rounded-full flex items-center justify-center p-1">
      <FaCheck className="w-full h-full" />
    </div>
  );
}

export function Exclamation() {
  return (
    <div className="w-5 h-5 text-white bg-yellow-300 border border-gray-400 rounded-full flex items-center justify-center">
      <TbExclamationMark className="w-full h-full" />
    </div>
  );
}

export function ErrorCircle() {
  return (
    <div className="w-5 h-5 text-white bg-red-500 border border-gray-400 rounded-full flex items-center justify-center">
      <GoX className="w-full h-full" />
    </div>
  );
}
