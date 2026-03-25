import { LoadSearchResponse } from "@/types/load.types";
import CustomCard, {
  InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";
import {
  FaBox,
  FaMapMarkerAlt,
  FaClipboardList,
  FaTruck,
  FaUser,
  FaCalendarAlt,
} from "react-icons/fa";
import { HiExclamation } from "react-icons/hi";
import { FaTrailer } from "react-icons/fa6";

// Fields that are used internally and should not be displayed
const HIDDEN_EXTRADATA_KEYS = new Set(["delivered"]);

export const EXTRADATA_ICONS_KEYS: Record<string, React.ReactNode> = {
  source: <FaBox className="h-4 w-4" />,
  terminal: <FaMapMarkerAlt className="h-4 w-4" />,
  alert: <HiExclamation className="h-4 w-4" />,
  previous: <FaClipboardList className="h-4 w-4" />,
  trip: <FaClipboardList className="h-4 w-4" />,
  carrier: <FaClipboardList className="h-4 w-4" />,
  truck: <FaTruck className="h-4 w-4" />,
  driver: <FaUser className="h-4 w-4" />,
  trailer: <FaTrailer className="h-4 w-4" />,
  transport: <FaClipboardList className="h-4 w-4" />,
  route: <FaMapMarkerAlt className="h-4 w-4" />,
  eta: <FaCalendarAlt className="h-4 w-4" />,
  ontime: <FaCalendarAlt className="h-4 w-4" />,
  lines: <FaClipboardList className="h-4 w-4" />,
};

// Format value for display (converts booleans, etc.)
function formatValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  return String(value);
}

export default function GenericComponent({
  item,
  badges,
  className,
}: {
  item: LoadSearchResponse;
  badges: InformationBadge[] | null;
  className?: string;
}) {
  const displayEntries = Object.entries(item.extradata).filter(
    ([key, value]) =>
      !HIDDEN_EXTRADATA_KEYS.has(key) && value != null && value !== false
  );

  if (displayEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row">
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 flex flex-col gap-5 grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null} badges={badges || undefined}>
          {displayEntries.map(([key, value]) => (
            <LoadableLabel
              key={key}
              label={EXTRADATA_ICONS_KEYS[key] ? "" : key}
              value={formatValue(value)}
              icon={EXTRADATA_ICONS_KEYS[key]}
              className={className}
              showEquals={false}
            />
          ))}
        </CustomCard>
      </div>
    </div>
  );
}

export function GenericComponentOld({ item }: { item: LoadSearchResponse }) {
  const displayEntries = Object.entries(item.extradata).filter(
    ([key, value]) =>
      !HIDDEN_EXTRADATA_KEYS.has(key) && value != null && value !== false
  );

  if (displayEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row">
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null}>
          {displayEntries.map(([key, value]) => (
            <LoadableLabel key={key} label={key} value={formatValue(value)} />
          ))}
        </CustomCard>
      </div>
    </div>
  );
}
