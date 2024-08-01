import { SidebarItem } from "../types/common.types";
import { HiClipboardList, HiCollection, HiSupport } from "react-icons/hi";

export const externalPages: SidebarItem[] = [
  {
    href: "https://github.com/themesberg/flowbite-react/",
    target: "_blank",
    icon: HiClipboardList,
    label: "Docs",
  },
  {
    href: "https://flowbite-react.com/",
    target: "_blank",
    icon: HiCollection,
    label: "Components",
  },
  {
    href: "https://github.com/themesberg/flowbite-react/issues",
    target: "_blank",
    icon: HiSupport,
    label: "Help",
  },
];
