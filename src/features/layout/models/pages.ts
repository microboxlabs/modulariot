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
        href: "/kanban",
        label: "werehouse",
      },
      {
        href: "/kanban",
        label: "logistics",
      },
      {
        href: "/kanban",
        label: "shipping",
      },
      {
        href: "/kanban",
        label: "finished",
      },
      {
        href: "/kanban",
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
