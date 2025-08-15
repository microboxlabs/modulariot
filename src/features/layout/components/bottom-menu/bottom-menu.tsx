import { twMerge } from "tailwind-merge";
import { HiCog } from "react-icons/hi";
import { Sidebar } from "flowbite-react";
import LifeSaver from "./LifeSaver";
import { tr } from "@/features/i18n/tr.service";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";

export default function BottomMenu({
  isCollapsed,
  dict,
  pathname,
}: {
  isCollapsed: boolean;
  dict: PropsWithI18nDict["dict"];
  pathname: string;
}) {
  return (
    <div
      className={twMerge(
        "flex items-center justify-center gap-4 mb-9",
        isCollapsed && "flex-col"
      )}
    >
      <Sidebar.ItemGroup>
        <Sidebar.Item
          href="/app/users/settings"
          icon={HiCog}
          className={twMerge(
            "justify-center [&>*]:font-normal",
            pathname === "/users/settings" && "bg-gray-100 dark:bg-gray-700"
          )}
        >
          {tr("settings", dict)}
        </Sidebar.Item>
        <Sidebar.Item href="#" icon={LifeSaver}>
          {tr("help", dict)}
        </Sidebar.Item>
      </Sidebar.ItemGroup>
    </div>
  );
}
