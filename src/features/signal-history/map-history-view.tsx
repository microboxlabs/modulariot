import TagManager from "../symptoms/components/tag-manager";
import { FaTruck, FaRegClock } from "react-icons/fa";
import CustomCard from "../symptoms/components/card/custom-card";
import { ChevronLeft } from "flowbite-react-icons/outline";
import SignalsHistory from "./main-content";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";

export default function MapHistoryView({
  dict,
  onBackClick,
}: {
  dict: I18nRecord;
  onBackClick?: () => void;
}) {
  const urlParams = new URLSearchParams(window.location.search);
  const assetId = urlParams.get("license_plate") || "";
  const p_from = urlParams.get("start_date") || "";
  const p_to = urlParams.get("end_date") || "";

  /*
  const {
    data: timelineData,
    error: timelineError,
    isLoading: timelineIsLoading,
  } = useHistoricTimeline({
    assetId,
    p_from,
    p_to,
  });
  */

  // from the path get the value of "license_plate", "start_date" and "end_date" to show as tags
  const tags = [
    {
      text: (
        <div className="flex flex-row justify-center items-center gap-1">
          <FaTruck className="inline mr-1" />
          {new URLSearchParams(window.location.search).get("license_plate")}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-full relative flex flex-col gap-2">
      <div className={`relative flex flex-col gap-10 rounded-lg`}>
        <CustomCard className="flex flex-row p-0 overflow-hidden">
          <div className="flex flex-row items-center w-full">
            <button
              type="button"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              onClick={() => {
                // Trigger rerender in parent and go back
                if (onBackClick) {
                  onBackClick();
                }
                window.history.back();
              }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-7 h-7 p-0 dark:text-gray-400" />
            </button>
            <div className="w-px h-full rounded-full bg-gray-100 dark:bg-gray-500 mr-4"></div>
            <h1
              className={`flex flex-row gap-2 text-lg font-bold tracking-tight whitespace-nowrap justify-center items-center ${"text-gray-900 dark:text-white"}`}
            >
              <FaRegClock className="h-5 w-5" />
              {tr("signal_historic.historic_signals", dict)}
            </h1>
            <div className="flex align-middle mx-2 gap-1 w-full">
              <TagManager
                tag_style="bg-transparent border-gray-300 dark:border-gray-500 dark:text-white"
                tags={tags}
              />
            </div>
          </div>
        </CustomCard>
      </div>
      <SignalsHistory dict={dict} />
    </div>
  );
}
