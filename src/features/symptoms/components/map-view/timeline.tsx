import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  ConditionsAgg,
  TimelineElement,
} from "@/features/symptoms/types/timeline";
import TimelineGroup from "./timeline-group";

/* function calculateDuration(
  startTime: string,
  dict: I18nRecord,
  lang: string,
): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffInMs = now.getTime() - start.getTime();

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  let duration = "";

  if (diffInMinutes < 60) {
    duration = `${diffInMinutes} ${(dict.symptoms as I18nRecord).minutes as string}`;
  } else if (diffInHours < 24) {
    duration = `${diffInHours} ${(dict.symptoms as I18nRecord).hours as string}`;
  } else {
    duration = `${diffInDays} ${(dict.symptoms as I18nRecord).days as string}`;
  }

  if (lang === "es") {
    duration = (dict.symptoms as I18nRecord).ago + " " + duration;
  } else if (lang === "en") {
    duration = duration + " " + (dict.symptoms as I18nRecord).ago;
  }

  return duration;
} */

export default function TimelineComponent({
  dict,
  treatmentData,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
  order,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (treatmentIndex: ConditionsAgg) => void;
  order: "asc" | "desc";
}) {
  if (!treatmentData || !treatmentData?.timeline) {
    return <p className="text-center dark:text-red-500">No data</p>;
  }

  // Ordering of elements to be displayed
  const TimelineGroupedByDate = treatmentData?.timeline
    .sort((a, b) => {
      if (order === "asc") {
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      } else {
        return new Date(b.start).getTime() - new Date(a.start).getTime();
      }
    })
    .reduce((acc: Record<string, ConditionsAgg[]>, item) => {
      const date = new Date(item.start).toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    }, {});

  return (
    <div className="flex flex-col gap-4 bg-gray-50 dark:bg-gray-800 rounded-md p-4">
      {TimelineGroupedByDate &&
        Object.entries(TimelineGroupedByDate).map(([date, items]) => {
          return (
            <div key={date} className="flex flex-col gap-2">
              <div className="flex flex-row justify-between items-center gap-1">
                <div className="flex flex-row justify-between h-[1px] w-full bg-gray-400 dark:bg-gray-600"></div>
                <span className="flex flex-row justify-between font-light text-xs whitespace-nowrap text-gray-500 dark:text-gray-500">
                  {date}
                </span>
                <div className="flex flex-row justify-between h-[1px] w-full bg-gray-400 dark:bg-gray-600"></div>
              </div>
              {items.map((item, index) => {
                if (treatmentData) {
                  return (
                    <TimelineGroup
                      key={index}
                      item={item as TimelineElement}
                      dict={dict}
                      treatmentData={treatmentData}
                      setSelectedTreatment={setSelectedTreatment}
                      setSelectedTreatmentIndex={setSelectedTreatmentIndex}
                    />
                  );
                }
              })}
            </div>
          );
        })}
    </div>
  );
}
