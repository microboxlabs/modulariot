import { memo, type ComponentType } from "react";
import { HiArrowRight } from "react-icons/hi";
import { BsStars } from "react-icons/bs";
import type { SpotlightItem } from "./types";
import { SpotlightResultItem } from "./spotlight-result-item";

interface SectionHeaderProps {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  iconClass: string;
  labelClass: string;
  dividerClass: string;
}

function SectionHeader({ Icon, label, iconClass, labelClass, dividerClass }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 select-none">
      <Icon className={`h-3 w-3 shrink-0 ${iconClass}`} />
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
      </span>
      <div className={`h-px flex-1 ${dividerClass}`} />
    </div>
  );
}

function HarnessSkeleton() {
  return (
    <div className="space-y-0.5 px-4 py-1">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-2 w-1/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SpotlightResultsProps {
  /** Navigate items including group-header rows */
  staticItems: SpotlightItem[];
  harnessItems: SpotlightItem[];
  isHarnessLoading: boolean;
  /** Id of the keyboard-selected item */
  selectedItemId: string | null;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
  navigateHeading: string;
  harnessHeading: string;
}

export const SpotlightResults = memo(function SpotlightResults({
  staticItems,
  harnessItems,
  isHarnessLoading,
  selectedItemId,
  onSelect,
  onHover,
  navigateHeading,
  harnessHeading,
}: Readonly<SpotlightResultsProps>) {
  const hasStaticResults = staticItems.some((i) => !i.isGroupHeader);
  const showHarnessSection = isHarnessLoading || harnessItems.length > 0;

  if (!hasStaticResults && !showHarnessSection) return null;

  return (
    <div className="max-h-80 overflow-y-auto py-1">
      {/* ── Static / navigate results ─────────────────────────────────── */}
      {hasStaticResults && (
        <div>
          <SectionHeader
            Icon={HiArrowRight}
            label={navigateHeading}
            iconClass="text-gray-400 dark:text-gray-500"
            labelClass="text-gray-400 dark:text-gray-500"
            dividerClass="bg-gray-100 dark:bg-gray-700"
          />
          {staticItems.map((item) => {
            if (item.isGroupHeader) {
              return (
                <div key={item.id} className="px-5 pt-2 pb-0.5 select-none">
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
              );
            }
            return (
              <SpotlightResultItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}

      {/* ── Harness results ───────────────────────────────────────────── */}
      {showHarnessSection && (
        <div
          className={
            hasStaticResults
              ? "mt-1 border-t border-gray-100 dark:border-gray-700 pt-1"
              : ""
          }
        >
          <SectionHeader
            Icon={BsStars}
            label={harnessHeading}
            iconClass="text-amber-400 dark:text-amber-500"
            labelClass="text-amber-500 dark:text-amber-400"
            dividerClass="bg-amber-50 dark:bg-amber-900/20"
          />
          {isHarnessLoading ? (
            <HarnessSkeleton />
          ) : (
            harnessItems.map((item) => (
              <SpotlightResultItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});
