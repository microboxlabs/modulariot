import { memo, type ComponentType } from "react";
import { HiClock, HiArrowRight } from "react-icons/hi";
import { BsStars } from "react-icons/bs";
import type { SpotlightItem } from "./types";
import { SpotlightRow } from "./spotlight-row";

interface EmptyStateSectionProps {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  items: SpotlightItem[];
  selectedItemId: string | null;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
  accentHover?: boolean;
}

function EmptyStateSection({
  Icon,
  label,
  items,
  selectedItemId,
  onSelect,
  onHover,
  accentHover,
}: Readonly<EmptyStateSectionProps>) {
  if (!items.length) return null;

  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-4 py-1.5 select-none">
        <Icon className="h-3 w-3 shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </span>
        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-700" />
      </div>

      {items.map((item) => (
        <SpotlightRow
          key={item.id}
          item={item}
          isSelected={item.id === selectedItemId}
          onSelect={onSelect}
          onHover={onHover}
          accentHover={accentHover}
        />
      ))}
    </div>
  );
}

interface SpotlightEmptyStateProps {
  recentItems: SpotlightItem[];
  recentLabel: string;
  suggestedHarnessItems: SpotlightItem[];
  suggestedHarnessLabel: string;
  suggestedGotoItems: SpotlightItem[];
  suggestedGotoLabel: string;
  selectedItemId: string | null;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
}

export const SpotlightEmptyState = memo(function SpotlightEmptyState({
  recentItems,
  recentLabel,
  suggestedHarnessItems,
  suggestedHarnessLabel,
  suggestedGotoItems,
  suggestedGotoLabel,
  selectedItemId,
  onSelect,
  onHover,
}: Readonly<SpotlightEmptyStateProps>) {
  if (!recentItems.length && !suggestedHarnessItems.length && !suggestedGotoItems.length) {
    return null;
  }

  return (
    <>
      <EmptyStateSection
        Icon={HiClock}
        label={recentLabel}
        items={recentItems}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
        onHover={onHover}
      />
      <EmptyStateSection
        Icon={BsStars}
        label={suggestedHarnessLabel}
        items={suggestedHarnessItems}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
        onHover={onHover}
        accentHover
      />
      <EmptyStateSection
        Icon={HiArrowRight}
        label={suggestedGotoLabel}
        items={suggestedGotoItems}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
        onHover={onHover}
      />
    </>
  );
});
