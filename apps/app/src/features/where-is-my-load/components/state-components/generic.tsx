import { LoadSearchResponse } from "@/types/load.types";
import CustomCard, {
  InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";

// Fields that are used internally and should not be displayed
const HIDDEN_EXTRADATA_KEYS = new Set(["fecha_comprometida", "delivered"]);

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
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null} badges={badges || undefined}>
          {displayEntries.map(([key, value]) => (
            <LoadableLabel
              key={key}
              label={key}
              value={formatValue(value)}
              className={className}
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
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null}>
          {displayEntries.map(([key, value]) => (
            <LoadableLabel key={key} label={key} value={formatValue(value)} />
          ))}
        </CustomCard>
      </div>
    </div>
  );
}
