import ChartMixedIcon from "@/features/icons/chart-mixed";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import { SidebarItem } from "../types/common.types";

export const pages: SidebarItem[] = [
  {
    href: "/",
    icon: HomeIcon,
    label: "home",
    totals: {},
    requiredGroups: [], // Public route
  },
  {
    icon: ClipboardIcon,
    label: "tasks",
    items: [
      // {
      //   href: "/warehouse",
      //   label: "werehouse",
      //   totals: {},
      // },
      // {
      //   href: "/logistics",
      //   label: "logistics",
      //   totals: {},
      // },
      {
        href: "/shipping",
        label: "shipping",
        totals: {},
        requiredGroups: [],
      },
      {
        href: "/finished",
        label: "finished",
        totals: {},
        requiredGroups: [],
      },
      // {
      //   href: "/others",
      //   label: "others",
      //   totals: {},
      // },
    ],
    totals: {},
    requiredGroups: [],
  },
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "controlTower",
    /* eslint-disable */
    items: [       
          {
            href: "/geographic-view",
            label: "geographicView",
            totals: {},
            requiredGroups: [], //"GROUP_MINTRAL_EJECUTIVO_TORRE_CONTROL"
            blockedGroups: [], // Hide from revisors
          },
          {
            href: "/symptoms",
            label: "symptoms",
            totals: {},
            requiredGroups: [],
            blockedGroups: ["GROUP_MINTRAL_REVISOR"], // Hide from revisors
          },       
    ],
    /* eslint-enable */

    totals: {},
    requiredGroups: [],
    blockedGroups: [], // Hide reports section from revisors
  },
];
