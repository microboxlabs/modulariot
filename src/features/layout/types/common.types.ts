import { ComponentProps, FC, HTMLAttributeAnchorTarget } from "react";

export type SidebarItem = {
  href?: string;
  target?: HTMLAttributeAnchorTarget;
  icon?: FC<ComponentProps<"svg">>;
  label: string;
  items?: SidebarItem[];
  badge?: string;
  totals: Record<string, number>;
};
