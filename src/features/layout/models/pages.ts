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
        requiredGroups: ["SHIPPING_ADMIN", "SHIPPING_USER"],
      },
      {
        href: "/finished",
        label: "finished",
        totals: {},
        requiredGroups: ["SHIPPING_ADMIN", "SHIPPING_USER"],
      },
      // {
      //   href: "/others",
      //   label: "others",
      //   totals: {},
      // },
    ],
    totals: {},
    requiredGroups: ["SHIPPING_ADMIN", "SHIPPING_USER"],
  },
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "controlTower",
    /* eslint-disable */
    items: [
      ...(process.env.NEXT_PUBLIC_DISPLAY_GEOGRAPHIC_VIEW == "TRUE"
        ? [
          {
            href: "/geographic-view",
            label: "geographicView",
            totals: {},
            requiredGroups: ["GEOGRAPHIC_VIEW_ADMIN", "GEOGRAPHIC_VIEW_USER"]
          },
          {
            href: "/symptoms",
            label: "symptoms",
            totals: {},
            requiredGroups: ["SYMPTOMS_ADMIN", "SYMPTOMS_USER"]
          },
        ]
        : []),
    ],
    /* eslint-enable */

    totals: {},
    requiredGroups: ["REPORTS_ADMIN", "REPORTS_USER"],
  },
];
