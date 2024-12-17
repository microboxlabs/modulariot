"use client";

import { useState } from "react";
import { TaskFormProps } from "../task-form/task-form.types";
import GpsValidationModal from "../gps-validation-modal/gps-validation-modal";
import { useGetEntityInfo } from "@/features/common/providers/client-api.provider";
import CheckCircleIcon from "@/features/icons/check-circle";
import { calcGpsValidationType } from "../../services/client-form.service";
import ErrorCircleIcon from "@/features/icons/error-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import EllipseIcon from "@/features/icons/ellipse";

export default function GpsValidationItem({ task, msg, lang }: TaskFormProps) {
  const [showGpsValidationModal, setShowGpsValidationModal] = useState(false);

  const openGpsValidationModal = () => {
    setShowGpsValidationModal(true);
  };

  const { data: entityInfo, isLoading: _isLoadingEntityInfo } =
    useGetEntityInfo(task.mintral_truckLicensePlate as string);

  const gpsValidationType = entityInfo
    ? calcGpsValidationType(entityInfo)
    : undefined;

  return (
    <small className="flex items-center p-3">
      {gpsValidationType === "ok" && <CheckCircleIcon />}
      {gpsValidationType === "warning" && <ExclamationIcon />}
      {gpsValidationType === "error" && <ErrorCircleIcon />}
      {gpsValidationType === undefined && <EllipseIcon />}
      <a
        href="#"
        className="ml-2 text-gray-400 text-sm hover:underline"
        onClick={openGpsValidationModal}
      >
        {msg!.check4Subtitle as string}
      </a>
      <GpsValidationModal
        openModal={showGpsValidationModal}
        setOpenModal={() => setShowGpsValidationModal(false)}
        msg={msg!}
        entityInfo={entityInfo}
        lang={lang}
        task={task}
      />
    </small>
  );
}
