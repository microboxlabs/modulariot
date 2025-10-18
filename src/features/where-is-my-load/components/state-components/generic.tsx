import { LoadSearchResponse } from "@/types/load.types";
import CustomCard, {
  InformationBadge,
} from "@/features/common/components/custom-card/custom-card";
import LoadableLabel from "@/features/common/components/loadable-label/loadable-label";

export default function GenericComponent({
  item,
  badges,
  className,
}: {
  item: LoadSearchResponse;
  badges: InformationBadge[] | null;
  className?: string;
}) {
  if (Object.entries(item.extradata).length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row">
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null} badges={badges || undefined}>
          {Object.entries(item.extradata).map(([key, value]) => (
            <LoadableLabel
              key={key}
              label={key}
              value={value as string}
              className={className}
            />
          ))}
        </CustomCard>
      </div>
    </div>
  );
}

export function GenericComponentOld({ item }: { item: LoadSearchResponse }) {
  if (Object.entries(item.extradata).length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row">
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 flex-grow w-full md:w-fit">
        <CustomCard title={null} subtitle={null}>
          {Object.entries(item.extradata).map(([key, value]) => (
            <LoadableLabel key={key} label={key} value={value as string} />
          ))}
        </CustomCard>
      </div>
    </div>
  );
}
