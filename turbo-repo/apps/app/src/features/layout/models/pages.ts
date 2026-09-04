import CalendarIcon from "@/features/icons/calendar";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import TruckIcon from "@/features/icons/truck";
import PeopleIcon from "@/features/icons/people";
import { SidebarItem } from "../types/common.types";
import FaBookIcon from "@/features/icons/FaBook";
import VideoCameraIcon from "@/features/icons/video-camera";
import { FaDev, FaTruckLoading } from "react-icons/fa";
import { HiCog, HiLightningBolt } from "react-icons/hi";
import { LuTowerControl } from "react-icons/lu";
import type { FC, ComponentProps } from "react";
import pagesConfig from "./pages-config.json";

const PAGE_ICONS: Record<string, FC<ComponentProps<"svg">>> = {
  home: HomeIcon,
  calendar: CalendarIcon,
  kanban: ClipboardIcon,
  tasks: FaBookIcon,
  controlTower: LuTowerControl as FC<ComponentProps<"svg">>,
  liveStreams: VideoCameraIcon,
  collaboratorsManagement: PeopleIcon,
  fleetManagement: TruckIcon,
  whereIsMyLoad: FaTruckLoading as FC<ComponentProps<"svg">>,
  integrations: HiLightningBolt as FC<ComponentProps<"svg">>,
  settings: HiCog as FC<ComponentProps<"svg">>,
  dev: FaDev as FC<ComponentProps<"svg">>,
};

/**
 * The reference-only "Dev" section: Extensions/Components galleries for
 * whoever builds the harness's chat tool integrations, not a page real users
 * reach. Hidden unless dev tools are switched on.
 */
export const DEV_PAGE_LABEL = "dev";

// cpd-off — sidebar configuration data, structural repetition is intentional
/**
 * Every registered page, Dev included. Anything that *renders* navigation
 * should go through `visiblePages()` / `useVisiblePages()` instead, so the
 * Dev section is filtered consistently in both places that build nav (the
 * sidebar and Spotlight).
 */
export const pages: SidebarItem[] = pagesConfig.map((p) => ({
  ...p,
  icon: PAGE_ICONS[p.label],
  totals: {},
  items: (p.items ?? []).map((c) => ({ ...c, totals: {} })),
})) as SidebarItem[];
// cpd-on

/**
 * `pages` minus the Dev section unless dev tools are enabled.
 *
 * The flag arrives as an argument rather than being read here because it now
 * comes from the runtime config (`ENABLE_DEV_TOOLS`, fetched from
 * /api/runtime-config) instead of a build-time `NEXT_PUBLIC_` var. That's
 * what lets one built image be dev-tools-on in dev and off in prod; a
 * NEXT_PUBLIC_ value is inlined at build time and can't be changed per
 * deploy. Module scope can't await that fetch, so the filter moved out to
 * the consumers — see `useVisiblePages`.
 */
export function visiblePages(devToolsEnabled: boolean): SidebarItem[] {
  if (devToolsEnabled) return pages;
  return pages.filter((p) => p.label !== DEV_PAGE_LABEL);
}
