import { twMerge } from "tailwind-merge";
import { HiAdjustments, HiCog } from "react-icons/hi";
import { Sidebar, Tooltip } from "flowbite-react";
import Link from "next/link";
import LifeSaver from "./LifeSaver";

export default function BottomMenu({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div
      className={twMerge(
        "flex items-center justify-center gap-4 mb-9",
        isCollapsed && "flex-col",
      )}
    >
      <Sidebar.ItemGroup>
        <Sidebar.Item href="#" icon={HiCog}>
          <Link href="/users/settings">Ajustes</Link>
        </Sidebar.Item>
        <Sidebar.Item href="#" icon={LifeSaver}>
          Ayuda y cómo empezar
        </Sidebar.Item>
      </Sidebar.ItemGroup>
    </div>
  );
}

/* <div
      className={twMerge(
        "flex items-center justify-center gap-4 mb-9",
        isCollapsed && "flex-col",
      )}
    >
      <button className="inline-flex cursor-pointer justify-center rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white">
        <span className="sr-only">Tweaks</span>
        <HiAdjustments className="h-6 w-6" />
      </button>
      <Tooltip content="Settings page">
        <Link
          href="/users/settings"
          className="inline-flex cursor-pointer justify-center rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <span className="sr-only">Settings page</span>
          <HiCog className="h-6 w-6" />
        </Link>
      </Tooltip>
      <div>{/* <LanguageDropdown /> /}</div>
      </div> */
