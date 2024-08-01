import ChartMixedIcon from "@/features/icons/chart-mixed";
import ClipboardIcon from "@/features/icons/clipboard";
import HomeIcon from "@/features/icons/home";
import { SidebarItem } from "../types/common.types";

export const pages: SidebarItem[] = [
  { href: "/", icon: HomeIcon, label: "home" },
  {
    icon: ClipboardIcon,
    label: "my_tasks",
    items: [
      {
        href: "/warehouse",
        label: "werehouse",
      },
      {
        href: "/kanban",
        label: "logistics",
      },
      {
        href: "/shipping",
        label: "shipping",
      },
      {
        href: "/finished",
        label: "finished",
      },
      {
        href: "/others",
        label: "others",
      },
    ],
  },
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "reports",
  },
];
