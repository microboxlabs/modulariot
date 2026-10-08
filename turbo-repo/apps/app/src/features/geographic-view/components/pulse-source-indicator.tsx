import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Badge } from "flowbite-react";
import { HiDevicePhoneMobile, HiMapPin } from "react-icons/hi2";
import { getAppSignalRingHex } from "../utils/pulse-source";

const COMPACT_BADGE_CLASSES =
  "gap-0.5 rounded px-1 py-0 text-[10px] leading-4 [&>svg]:h-3 [&>svg]:w-3";

interface PulseSourceIndicatorProps {
  readonly appCount: number;
  readonly gpsCount: number;
  readonly dict: I18nRecord;
}

interface PulseSourceLegendProps {
  readonly dict: I18nRecord;
  readonly showStops?: boolean;
  readonly isDarkMap?: boolean;
}

export function PulseSourceLegend({
  dict,
  showStops = false,
  isDarkMap = true,
}: Readonly<PulseSourceLegendProps>) {
  return (
    <div className="pointer-events-none inline-flex flex-col items-start gap-1 rounded-lg border border-gray-200 bg-white/90 px-2 py-1 text-[10px] leading-4 text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-200">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-1 ring-white" />
        {tr("geographic_view.gps", dict)}
      </span>
      {showStops && (
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-white" />
          {tr("geographic_view.stopped_pulse", dict)}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span
          className="h-3 w-3 rounded-full border-2 bg-transparent ring-1 ring-white"
          style={{ borderColor: getAppSignalRingHex(isDarkMap) }}
        />
        {tr("geographic_view.signal_detail_app", dict)}
      </span>
    </div>
  );
}

export default function PulseSourceIndicator({
  appCount,
  gpsCount,
  dict,
}: Readonly<PulseSourceIndicatorProps>) {
  const total = appCount + gpsCount;
  if (total === 0 || (total === 1 && appCount === 0)) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-gray-600 dark:text-gray-300">
        {tr("geographic_view.signal_detail", dict)}:
      </span>
      {appCount > 0 && (
        <Badge
          className={COMPACT_BADGE_CLASSES}
          color="gray"
          icon={HiDevicePhoneMobile}
          size="sm"
        >
          {tr("geographic_view.signal_detail_app", dict)}: {appCount}
        </Badge>
      )}
      {total > 1 && (
        <Badge
          className={COMPACT_BADGE_CLASSES}
          color="blue"
          icon={HiMapPin}
          size="sm"
        >
          {tr("geographic_view.gps", dict)}: {gpsCount}
        </Badge>
      )}
    </div>
  );
}
