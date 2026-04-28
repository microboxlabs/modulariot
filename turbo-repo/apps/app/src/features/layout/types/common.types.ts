import { ComponentProps, FC, HTMLAttributeAnchorTarget } from "react";

export interface SidebarCreateAction {
  href: string;
  label: string;
}

export type SidebarItem = {
  href?: string;
  target?: HTMLAttributeAnchorTarget;
  icon?: FC<ComponentProps<"svg">>;
  label: string;
  items?: SidebarItem[];
  badge?: string;
  totals?: Record<string, number | string>;
  requiredGroups?: string[];
  blockedGroups?: string[];
  dynamicItemsSource?: string;
  searchable?: boolean;
  createAction?: SidebarCreateAction;
};
