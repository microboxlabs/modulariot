import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import TripData from "./trip-data";
// import TripVerifications from "./trip-verifications";
import CustomCard from "@/features/common/components/custom-card/custom-card";

export default function TripInformation({
  task,
  msg,
  /* lang,
  userGroups, */
}: {
  task: TaskResponse;
  msg: I18nRecord;
  /* lang: string;
  userGroups: string[]; */
}) {
  return (
    <CustomCard
      title={(msg.bento as I18nRecord).trip_information as string}
      /* subtitle={task.mintral_serviceCode + "-V"} */
      subtitle={(msg.bento as I18nRecord).trip as string}
    >
      <div className="flex flex-col w-fit gap-2">
        <TripData
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
        />
        {/* <TripVerifications
          task={task}
          msg={(msg.pages as I18nRecord).transportValidationForm as I18nRecord}
           lang={lang}
          userGroups={userGroups} 
        /> */}
      </div>
    </CustomCard>
  );
}
