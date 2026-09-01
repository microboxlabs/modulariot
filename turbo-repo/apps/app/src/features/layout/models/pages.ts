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
import { HiSparkles } from "react-icons/hi2";
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
  storytelling: HiSparkles as FC<ComponentProps<"svg">>,
  settings: HiCog as FC<ComponentProps<"svg">>,
  dev: FaDev as FC<ComponentProps<"svg">>,
};

/**
 * The reference-only "Dev" section: Extensions/Components galleries for
 * whoever builds the harness's chat tool integrations, not a page real users
 * reach. Hidden unless dev tools are switched on.
 */
export const DEV_PAGE_LABEL = "dev";

/**
 * Storytelling is still testing-only content (see storytelling-store.ts,
 * the `testing/` fixtures) — hidden unless ENABLE_STORYTELLING is
 * switched on, same mechanism as DEV_PAGE_LABEL above.
 */
export const STORYTELLING_PAGE_LABEL = "storytelling";

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
 * `pages` minus the Dev section unless dev tools are enabled, and minus
 * Storytelling unless storytelling testing is enabled.
 *
 * Both flags arrive as arguments rather than being read here because they
 * come from the runtime config (`ENABLE_DEV_TOOLS` / `ENABLE_STORYTELLING`,
 * fetched from /api/runtime-config) instead of a build-time `NEXT_PUBLIC_`
 * var. That's what lets one built image be on in dev and off in prod; a
 * NEXT_PUBLIC_ value is inlined at build time and can't be changed per
 * deploy. Module scope can't await that fetch, so the filter moved out to
 * the consumers — see `useVisiblePages`.
 */
export function visiblePages(devToolsEnabled: boolean, storytellingEnabled: boolean): SidebarItem[] {
  return pages.filter((p) => {
    if (p.label === DEV_PAGE_LABEL) return devToolsEnabled;
    if (p.label === STORYTELLING_PAGE_LABEL) return storytellingEnabled;
    return true;
  });
}
