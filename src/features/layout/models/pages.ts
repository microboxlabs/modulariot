import ChartMixedIcon from "@/features/icons/chart-mixed";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import { SidebarItem } from "../types/common.types";
import FaBookIcon from "@/features/icons/FaBook";

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
    label: "kanban",
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
      /*  {
        href: "/picking",
        label: "picking",
        totals: {},
      }, */
      {
        href: "/shipping",
        label: "shipping",
        totals: {},
      },
      /* {
        href: "/shippingv1",
        label: "shippingv1",
        totals: {},
        requiredGroups: [],
      }, */
      {
        href: "/delivery",
        label: "delivery",
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
    icon: FaBookIcon,
    label: "tasks",
    items: [
      /* {
        href: "/mytasks?status=pending",
        label: "pending_tasks",
        totals: {},
      }, */
      {
        href: "/mytasks?status=finished",
        label: "completed_tasks",
        totals: {},
      },
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
  {
    href: "/where-is-my-load",
    icon: ChartMixedIcon,
    label: "whereIsMyLoad",
    totals: {},
    requiredGroups: [],
    blockedGroups: [], // Hide reports section from revisors
  },
];
