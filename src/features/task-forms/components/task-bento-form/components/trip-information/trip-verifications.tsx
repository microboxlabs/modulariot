"use client";

import { useGetServiceValidation } from "@/features/common/providers/client-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
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

  const _executionType =
    task.mintral_executionType === "T"
      ? "Troncal"
      : task.mintral_executionType === "F"
        ? "Faena"
        : task.mintral_executionType;
  const _priority =
    task.mintral_priorityCode === "UR"
      ? "URGENTE"
      : task.mintral_priorityCode === "RG"
        ? "REGULARIZACIÓN"
        : task.mintral_priorityCode;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-b-lg w-full">
      <div className="flex gap-2 items-center p-1 border-0 border-gray-200 dark:border-gray-500">
        {isError(serviceValidation?.v_01) && <Ellipse />}
        {serviceValidation?.v_01?.v_01eval === 1 && <CheckCircle />}
        {serviceValidation?.v_01?.v_01eval === 2 && <Exclamation />}
        {serviceValidation?.v_01?.v_01eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).consolidation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center p-1 border-0 border-gray-200 dark:border-gray-500">
        {isError(serviceValidation?.v_02) && <Ellipse />}
        {serviceValidation?.v_02?.v_02eval === 1 && <CheckCircle />}
        {serviceValidation?.v_02?.v_02eval === 2 && <Exclamation />}
        {serviceValidation?.v_02?.v_02eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).documentSeparation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center p-1 border-0 border-gray-200 dark:border-gray-500 rounded-bl-lg">
        {isError(serviceValidation?.v_03) && <Ellipse />}
        {serviceValidation?.v_03?.v_03eval === 1 && <CheckCircle />}
        {serviceValidation?.v_03?.v_03eval === 2 && <Exclamation />}
        {serviceValidation?.v_03?.v_03eval === 3 && <ErrorCircle />}
        <span className="text-gray-400 text-sm">
          {(msg!.cards as I18nRecord).clientSystemValidation as string}
        </span>
      </div>
      <div className="flex gap-2 items-center p-1 border-0 border-gray-200 dark:border-gray-500 rounded-br-lg">
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
