import { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import HistoricLoads from "@/features/shipping/components/historic-loads";
import { BentoReviewProvider } from "./bento-review-context";

import TripInformation from "./components/trip-information/trip-information";
import DriverInfo from "./components/driver/driver";
import KpisCard from "./components/kpis/kpis-card";

import ValidationsInfo from "./components/driver/validations";
import SymptomsCard from "./components/side-data/symptoms-card";
import BentoHead from "./bento-head";
import BentoMediaSection from "./bento-media-section";
// import Forum from "./components/forum/forum";
import Forum from "./components/forum/forum";

export default function Bento({
  lang,
  task,
  userGroups,
  dict, // this is the general dictionary to base all our code
  msg, // this is a relative dictionary for the current task
  active = true,
  enableActions = false,
  showActions = true,
}: {
  lang: string;
  task: TaskResponse;
  userGroups: string[];
  dict: I18nDictionary;
  msg: I18nRecord;
  active?: boolean;
  enableActions?: boolean;
  showActions?: boolean;
}) {
  // Check if there's a second driver
  const driver2Name = task.mintral_driver2Name as string;
  const hasTwoDrivers = driver2Name && driver2Name.trim() !== "";

  return (
    <div className="flex flex-col w-full h-full ">
      <BentoReviewProvider>
      {/* Head */}
      <BentoHead
        task={task}
        dict={dict}
        msg={msg}
        lang={lang}
        showActions={showActions}
        enableActions={enableActions}
        userGroups={userGroups}
      />
      {/* Head */}

      {/* Content */}
      <div className="gap-2 p-2 bg-gray-50 dark:bg-gray-900 h-fit grid grid-cols-1 lg:grid-cols-5">
        {/* First column: Trip Information + KPIs stacked vertically */}
        {/* 3/5 when 1 driver, 2/5 when 2 drivers */}
        <div
          className={`col-span-1 flex flex-col gap-2 ${hasTwoDrivers ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          {/* Trip Information - grows to fill available space */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 flex-1">
            <TripInformation task={task} msg={dict} />
          </div>

          {/* KPIs - narrow row, only as tall as content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
            <KpisCard task={task} dict={dict} />
          </div>
        </div>

        {/* Second column: Driver Info */}
        {/* 1/5 when 1 driver, 2/5 when 2 drivers */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 col-span-1 ${hasTwoDrivers ? "lg:col-span-2" : "lg:col-span-1"}`}
        >
          <DriverInfo task={task} msg={dict} />
        </div>

        {/* Third column: Validations (1/5 = 20%) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 col-span-1">
          <ValidationsInfo
            task={task}
            msg={dict}
            lang={lang}
            userGroups={userGroups}
          />
        </div>

        {/* Geographic + File Images container */}
        <div className="col-span-1 lg:col-span-5">
          <BentoMediaSection task={task} dict={dict} />
        </div>

        {/* Historic Loads + Symptoms container - full width with custom grid */}
        <div className="col-span-1 lg:col-span-5 grid grid-cols-1 lg:grid-cols-6 gap-2">
          {/* Historic Loads - spans 4/6 columns */}
          <div className="col-span-1 lg:col-span-4 bg-white dark:bg-gray-800 rounded-lg min-h-[300px] max-h-[520px] overflow-auto">
            <HistoricLoads
              task={task}
              dictionary={dict as unknown as Record<string, string>}
              active={active}
            />
          </div>

          {/* Conditions - spans 2/6 columns */}
          <div className="col-span-1 lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <SymptomsCard task={task} dict={dict as I18nRecord} />
          </div>
        </div>

        {/* Forum - full width */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden col-span-1 lg:col-span-5 h-[400px]">
          <Forum dict={dict as I18nRecord} task={task} />
        </div>
        {/* Content */}
      </div>
      </BentoReviewProvider>
    </div>
  );
}
