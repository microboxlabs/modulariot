"use client";

import { useEffect, useState } from "react";
import { TaskFormProps } from "../task-form/task-form.types";
import GpsValidationModal from "../gps-validation-modal/gps-validation-modal";
import { getEntityInfo } from "@/features/common/providers/client-api.provider";
import { calcGpsValidationType } from "../../services/client-form.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { GetEntityInfoResponse } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.types";
import { Spinner } from "flowbite-react";
/* import {
  CheckCircle,
  Exclamation,
  ErrorCircle,
  Ellipse,
} from "../task-bento-form/components/trip-information/trip-verifications"; */
import { ValidationIcon } from "../task-bento-form/components/driver/validation-icon";
import { ValidationStatus } from "../task-bento-form/components/driver/validations.types";
import { logger } from "@/lib/logger";

export default function GpsValidationItem({
  task,
  msg,
  lang,
  userGroups,
}: TaskFormProps) {
  logger.info(msg);
  const [showGpsValidationModal, setShowGpsValidationModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
        setLoading(false);
        setError(true);
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
        <div className="flex items-center">
          <Spinner className="w-5 h-5" />{" "}
          <p className="ml-2 text-gray-400 text-sm"> Loading...</p>
        </div>
      )}
      {!loading && !error && (
        <>
          {/* {gpsValidationType === "ok" && <CheckCircle />}
          {gpsValidationType === "warning" && <Exclamation />}
          {gpsValidationType === "error" && <ErrorCircle />}
          {gpsValidationType === undefined && <Ellipse />} */}
          <ValidationIcon status={gpsValidationType as ValidationStatus} />

          <a
            href="#"
            className="ml-2 text-gray-600 text-sm hover:underline"
            onClick={openGpsValidationModal}
          >
            {msg?.cards
              ? ((msg!.cards as I18nRecord).gpsValidation as string)
              : msg?.bento
                ? ((msg!.bento as I18nRecord).gpsValidation as string)
                : ((msg as I18nRecord).gpsValidation as string)}
          </a>
          <GpsValidationModal
            openModal={showGpsValidationModal}
            setOpenModal={() => setShowGpsValidationModal(false)}
            msg={msg!}
            entityInfo={entityInfo}
            lang={lang}
            task={task}
            userGroups={userGroups}
          />
        </>
      )}
      {error && (
        <p className=" text-red-400 text-sm">
          {msg?.cards
            ? ((msg!.cards as I18nRecord).gpsValidationError as string)
            : ((msg as I18nRecord).gpsValidationError as string)}
        </p>
      )}
    </small>
  );
}
