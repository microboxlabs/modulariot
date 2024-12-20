import ChartMixedIcon from "@/features/icons/chart-mixed";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import { SidebarItem } from "../types/common.types";

export const pages: SidebarItem[] = [
  { href: "/", icon: HomeIcon, label: "home", totals: {} },
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
      },
      {
        href: "/finished",
        label: "finished",
        totals: {},
      },
      // {
      //   href: "/others",
      //   label: "others",
      //   totals: {},
      // },
    ],
    totals: {},
  },
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "reports",
    totals: {},
  },
];
