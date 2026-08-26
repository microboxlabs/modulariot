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
 * Reference-only "Dev" section (Extensions/Components galleries, for whoever
 * builds the harness's chat tool integrations) — never shown unless this is
 * explicitly set. NEXT_PUBLIC_-prefixed because pages.ts is consumed from
 * client code (SidebarNavigationProvider), so the check needs to survive
 * into the browser bundle, not just run server-side.
 */
const DEV_TOOLS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true";

// cpd-off — sidebar configuration data, structural repetition is intentional
export const pages: SidebarItem[] = pagesConfig
  .filter((p) => p.label !== "dev" || DEV_TOOLS_ENABLED)
  .map((p) => ({
    ...p,
    icon: PAGE_ICONS[p.label],
    totals: {},
    items: (p.items ?? []).map((c) => ({ ...c, totals: {} })),
  })) as SidebarItem[];
// cpd-on
