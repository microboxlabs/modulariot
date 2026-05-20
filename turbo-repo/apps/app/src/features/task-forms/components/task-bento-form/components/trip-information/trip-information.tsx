"use client";

import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripData from "./trip-data";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import {
  HiExclamationCircle,
  HiOutlineClock,
  HiOutlineTag,
} from "react-icons/hi";
import { logError } from "@/lib/logger";
import { useServiceCategoryName } from "@/features/common/providers/client-api.provider";
import { serviceCategoryInitials } from "@/features/common/utils/service-category";

export default function TripInformation({
  task,
  msg,
  isLoading = false,
}: {
  task: TaskResponse;
  msg: I18nDictionary;
  isLoading?: boolean;
}) {
  let originIsSitrans = null;
  if (task.mintral_geofenceOriginMetadata) {
    try {
      originIsSitrans = (
        JSON.parse(task.mintral_geofenceOriginMetadata as string) as Record<
          string,
          boolean | undefined
        >
      )["origin_is_sitrans"];
    } catch (error) {
      logError(error as Error);
    }
  }

  let originIsSitransValue = "-";
  if (originIsSitrans !== null && originIsSitrans !== undefined) {
    originIsSitransValue = originIsSitrans === true ? "internal" : "external";
  }

  const serviceCategoryCode = task.mintral_serviceCategory as
    | string
    | undefined;
  const { name: serviceCategoryName } =
    useServiceCategoryName(serviceCategoryCode);

  const badges: Array<{
    text: string;
    color:
      | "gray"
      | "purple"
      | "blue"
      | "red"
      | "green"
      | "yellow"
      | "pink"
      | "indigo";
    icon: any;
    title?: string;
  }> = [];

  if (originIsSitrans !== null && originIsSitrans !== undefined) {
    badges.push({
      text: msg.bento[
        originIsSitransValue as keyof I18nDictionary["bento"]
      ] as string,
      color: "gray" as const,
      icon: HiOutlineClock,
    });
  }

  if (serviceCategoryName) {
    const initials = serviceCategoryInitials(serviceCategoryName);
    if (initials) {
      badges.push({
        text: initials,
        color: "indigo" as const,
        icon: HiOutlineTag,
        title: `${msg.bento.serviceCategory}: ${serviceCategoryName}`,
      });
    }
  }

  if (task.mintral_priorityCode === "UR") {
    badges.push({
      text: msg.bento.urgency,
      color: "purple" as const,
      icon: HiExclamationCircle,
    });
  }

  return (
    <CustomCard
      title={msg.bento.trip_information}
      subtitle={msg.bento.trip}
      badges={badges}
    >
      <div className="flex flex-col w-fit gap-2">
        <TripData
          task={task}
          taskId={task.id}
          msg={msg}
          isLoading={isLoading}
        />
      </div>
    </CustomCard>
  );
}
