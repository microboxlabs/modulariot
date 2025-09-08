import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripData from "./trip-data";
// import TripVerifications from "./trip-verifications";
import CustomCard from "@/features/common/components/custom-card/custom-card";
import { tr } from "@/features/i18n/tr.service";
import { HiExclamationCircle, HiOutlineClock } from "react-icons/hi";
import { logError } from "@/lib/logger";

export default function TripInformation({
  task,
  msg,
  isLoading = false,
}: {
  task: TaskResponse;
  msg: I18nRecord;
  isLoading?: boolean;
}) {
  let originIsSitrans = null;
  if (task.mintral_geofenceDestinationMetadata) {
    try {
      originIsSitrans = (
        JSON.parse(
          task.mintral_geofenceDestinationMetadata as string
        ) as Record<string, boolean | undefined>
      )["origin_is_sitrans"];
    } catch (error) {
      logError(error as Error);
    }
  }

  let originIsSitransValue = "-";
  if (originIsSitrans !== null) {
    originIsSitransValue = originIsSitrans === true ? "internal" : "external";
  }

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
  }> = [];

  if (originIsSitrans !== null) {
    badges.push({
      text: (msg.bento as I18nRecord)[
        originIsSitransValue as keyof I18nRecord
      ] as string,
      color: "gray" as const,
      icon: HiOutlineClock,
    });
  }

  if (task.mintral_priorityCode === "UR") {
    badges.push({
      text: (msg.bento as I18nRecord).urgency as string,
      color: "purple" as const,
      icon: HiExclamationCircle,
    });
  }

  return (
    <CustomCard
      title={tr("trip_information", msg.bento as I18nRecord)}
      /* subtitle={task.mintral_serviceCode + "-V"} */
      subtitle={(msg.bento as I18nRecord).trip as string}
      badges={badges}
    >
      <div className="flex flex-col w-fit gap-2">
        <TripData
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
          isLoading={isLoading}
        />
      </div>
    </CustomCard>
  );
}
