import TagManager from "../symptoms/components/tag-manager";
import { FaTruck, FaRegClock } from "react-icons/fa";
import CustomCard from "../symptoms/components/card/custom-card";
import { ChevronLeft } from "flowbite-react-icons/outline";
import SignalsHistory from "./main-content";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
import { FormattedDate } from "../common/components/formatted-date";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";

export default function MapHistoryView({
  dict,
  onBackClick,
}: {
  dict: I18nRecord;
  onBackClick?: () => void;
}) {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("license_plate") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  // Format dates with time: start_date at 00:00, end_date at 23:59
  const p_from = startDate
    ? dayjs(startDate).startOf("day").format("YYYY-MM-DD HH:mm")
    : "";
  const p_to = endDate
    ? dayjs(endDate).endOf("day").format("YYYY-MM-DD HH:mm")
    : "";

  const tags = [
    {
      text: (
        <div className="flex flex-row justify-center items-center gap-1">
          <FaTruck className="inline mr-1" />
          {assetId}
        </div>
      ),
    },
    {
      text: (
        <div className="flex flex-row justify-center items-center gap-1">
          <FormattedDate date={p_from} />
        </div>
      ),
    },
    {
      text: (
        <div className="flex flex-row justify-center items-center gap-1">
          <FormattedDate date={p_to} />
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
                if (onBackClick) {
                  onBackClick();
                }
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
      {/* Pass the formatted dates to SignalsHistory */}
      <SignalsHistory dict={dict} p_from={p_from} p_to={p_to} />
    </div>
  );
}
