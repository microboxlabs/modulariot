import type { SpotlightItem } from "./types";
import { SpotlightRow } from "./spotlight-row";

interface SpotlightResultItemProps {
  item: SpotlightItem;
  isSelected: boolean;
  onSelect: (item: SpotlightItem) => void;
  onHover: (id: string | null) => void;
}

export function SpotlightResultItem({
  item,
  isSelected,
  onSelect,
  onHover,
}: Readonly<SpotlightResultItemProps>) {
  return (
    <SpotlightRow
      item={item}
      isSelected={isSelected}
      onSelect={onSelect}
      onHover={onHover}
      accentHover={item.kind === "harness"}
    />
  );
}
