"use client";

import { useEffect, useState } from "react";
import { TaskFormProps } from "../task-form/task-form.types";
import GpsValidationModal from "../gps-validation-modal/gps-validation-modal";
import { getEntityInfo } from "@/features/common/providers/client-api.provider";
import CheckCircleIcon from "@/features/icons/check-circle";
import { calcGpsValidationType } from "../../services/client-form.service";
import ErrorCircleIcon from "@/features/icons/error-circle";
import ExclamationIcon from "@/features/icons/exclamation";
import EllipseIcon from "@/features/icons/ellipse";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";
import { Spinner, Breadcrumb } from "flowbite-react";

export default function GpsValidationItem({ task, msg, lang }: TaskFormProps) {
  const [showGpsValidationModal, setShowGpsValidationModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entityInfo, setEntityInfo] = useState<
    GetEntityInfoResponse | undefined
  >(undefined);

  const openGpsValidationModal = () => {
    setShowGpsValidationModal(true);
  };

  useEffect(() => {
    const entity_info_setting = async () => {
      try {
        const entity_info = (await getEntityInfo(
          task.mintral_truckLicensePlate as string,
        )) as GetEntityInfoResponse;
        setEntityInfo(entity_info);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    entity_info_setting();
  }, []);

  // This is still here since it might be useful still
  /* 
  const entity_info = useGetEntityInfo(
    task.mintral_truckLicensePlate as string,
  );
  const { data: entityInfo, isLoading: _isLoadingEntityInfo } = entity_info;
  */

  const gpsValidationType = entityInfo
    ? calcGpsValidationType(entityInfo)
    : undefined;

  return (
    <small className="flex items-center">
      {loading && (
        <>
          <Spinner /> <p className="ml-2 text-gray-400 text-sm"> Loading...</p>
        </>
      )}
      {!loading && (
        <>
          {gpsValidationType === "ok" && <CheckCircleIcon />}
          {gpsValidationType === "warning" && <ExclamationIcon />}
          {gpsValidationType === "error" && <ErrorCircleIcon />}
          {gpsValidationType === undefined && <EllipseIcon />}

          <a
            href="#"
            className="ml-2 text-gray-400 text-sm hover:underline"
            onClick={openGpsValidationModal}
          >
            {(msg!.cards as I18nRecord).gpsValidation as string}
          </a>
          <GpsValidationModal
            openModal={showGpsValidationModal}
            setOpenModal={() => setShowGpsValidationModal(false)}
            msg={msg!}
            entityInfo={entityInfo}
            lang={lang}
            task={task}
          />
        </>
      )}
    </small>
  );
}
