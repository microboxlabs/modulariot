"use client";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Sidebar, SidebarItemGroup, SidebarItems } from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import SidebarItem from "../sidebar-item/sidebar-item";
import BottomMenu from "../bottom-menu/bottom-menu";
import { pages } from "../../models/pages";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { sideBarTheme } from "../../models/sidebar-theme";
import { pathNameWithoutLanguage } from "../../utils/utils";
import {
  useMapPositions,
  useMyTasks,
  useMyTasksCount,
  useSymptoms,
} from "@/features/common/providers/client-api.provider";
import {
  SHIPPING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";

export default function DesktopSidebar({ dict }: PropsWithI18nDict) {
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isCollapsed, setCollapsed } = useSidebarContext().desktop;
  const [isPreview, setIsPreview] = useState(isCollapsed);
  const router = useRouter();
  const { data, error, isLoading: _ } = useMyTasksCount();
  const { data: finishedTasks } = useMyTasks(
    SHIPPING_COORDINATOR_PROCESS_TASKS,
    true,
    1,
    0,
  );
  const { count: mapCount } = useMapPositions();
  const { count: symptomsCount } = useSymptoms();
  const [totals, setTotals] = useState<{ [key: string]: number }>({});

  if (!error) {
    totals["shippingv1"] = Object.entries(data?.totals ?? {})
      .filter(([key]) =>
        SHIPPING_COORDINATOR_PROCESS_TASKS.includes(key as any),
      )
      .map(([_, value]) => value as number)
      .reduce((a, b) => a + b, 0);
    totals["shipping"] = Object.entries(data?.totals ?? {})
      .filter(([key]) =>
        SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(key as any),
      )
      .map(([_, value]) => value as number)
      .reduce((a, b) => a + b, 0);
    totals["picking"] = 0;
    totals["delivery"] = 0;
  } else if (error.status === 403 || error.status === 401) {
    router.push("/sign-in");
  }

  useEffect(() => {
    const newTotals = { ...totals };
    newTotals["geographicView"] = mapCount;
    newTotals["symptoms"] = symptomsCount;
    newTotals["finished"] = finishedTasks?.total ?? 0;
    setTotals(newTotals);
  }, [mapCount, symptomsCount, finishedTasks]);

  useEffect(() => {
    if (isCollapsed) setIsPreview(false);
  }, [isCollapsed]);

  const preview = {
    enable() {
      if (!isCollapsed) return;

      setIsPreview(true);
      setCollapsed(false);
    },
    disable() {
      if (!isPreview) return;

      setCollapsed(true);
    },
  };
  return (
    <Sidebar
      onMouseEnter={preview.enable}
      onMouseLeave={preview.disable}
      aria-label="Sidebar with multi-level dropdown example"
      collapsed={isCollapsed}
      theme={sideBarTheme}
      className={twMerge(
        "fixed inset-y-0 left-0 z-20 flex h-full bg-white shrink-0 flex-col border-gray-200 pt-16 duration-75 lg:flex dark:border-gray-700",
        isCollapsed && "hidden w-16",
      )}
      id="sidebar"
    >
      <div className="flex h-full flex-col justify-between  dark:border-gray-700">
        <div className="py-2">
          <SidebarItems>
            <SidebarItemGroup className="mt-0 border-t-0 pb-1 pt-0">
              {pages.map((item) => (
                <SidebarItem
                  key={item.label}
                  {...item}
                  pathname={pathname}
                  label={tr(item.label, dict)}
                  dict={dict}
                  icon={item.icon}
                  totals={totals}
                />
              ))}
            </SidebarItemGroup>
          </SidebarItems>
        </div>
        <BottomMenu isCollapsed={isCollapsed} dict={dict} pathname={pathname} />
      </div>
    </Sidebar>
  );
}
