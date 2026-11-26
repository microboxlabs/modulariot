"use client";

import { HiOutlineBars3, HiOutlineRectangleStack } from "react-icons/hi2";
import { SegmentedControl } from "./segmented-control";

export type CatalogLayout = "cards" | "list";

/**
 * Tarjetas / Lista for a catalog (dashboards, síntomas, reglas, credenciales…),
 * each with its icon; as tall as a small Button beside it. The labels are
 * plain words: the icons are drawn here, the same on every page.
 */
export default function LayoutToggle({
  layout,
  labels,
  onLayout,
}: Readonly<{
  layout: CatalogLayout;
  labels: Readonly<Record<CatalogLayout, string>>;
  onLayout: (layout: CatalogLayout) => void;
}>) {
  return (
    <SegmentedControl
      value={layout}
      onChange={onLayout}
      options={[
        { key: "cards", label: labels.cards, icon: HiOutlineRectangleStack },
        { key: "list", label: labels.list, icon: HiOutlineBars3 },
      ]}
    />
  );
}
