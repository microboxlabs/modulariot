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
  getMyTasks,
  useMapPositions,
  useMyTasks,
  useMyTasksCount,
  useSymptoms,
  useUserFilters,
} from "@/features/common/providers/client-api.provider";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";

export default function DesktopSidebar({ dict }: PropsWithI18nDict) {
  const pathname = pathNameWithoutLanguage(usePathname());

  const { isCollapsed } = useSidebarContext().desktop;
  const router = useRouter();
  const { data, error, isLoading: _ } = useMyTasksCount();
  const { data: finishedTasks } = useMyTasks(
    SHIPPING_COORDINATOR_PROCESS_TASKS,
    true,
    1,
    0
  );
  const { count: mapCount } = useMapPositions();
  const { count: symptomsCount } = useSymptoms();
  const [totals, setTotals] = useState<{ [key: string]: number }>({});

  //const searchParams = useSearchParams();
  const {
    data: userFiltersData,
    error: _userFiltersError,
    isLoading: _userFiltersLoading,
  } = useUserFilters();

  useEffect(() => {
    if (userFiltersData && userFiltersData?.length > 0) {
      userFiltersData.forEach((filter) => {
        const filterArray = filter.split("&");
        const filterPart = filterArray
          .filter((part) => !part.includes("position"))
          .join("&");
        const label = filterArray
          .filter((part) => part.includes("titleLabel"))
          .join("&")
          .replace("titleLabel=", "");
        const position = filterArray
          .filter((part) => part.includes("position"))
          .join("&")
          .replace("position=", "");
        getMyTasks(
          [
            ...SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
            ...DELIVERY_COORDINATOR_PROCESS_TASKS,
          ],
          false,
          0,
          2000,
          filterPart
        ).then((total) => {
          if (
            pages &&
            pages[2] &&
            pages[2].items &&
            pages[2].items?.length <= userFiltersData?.length
          ) {
            pages[2].items?.splice(position ? parseInt(position) : 0, 0, {
              href: `/mytasks?${filterPart}`,
              label,
              totals: { [label]: total.total },
            });
          }
          totals[label] = total.total;
          setTotals(totals);
        });
      });
    }
  }, [userFiltersData]);

  useEffect(() => {
    if (error && (error.status === 403 || error.status === 401)) {
      router.push("/sign-in");
    }
  }, [error]);

  if (!error) {
    totals["shipping"] = Object.entries(data?.totals ?? {})
      .filter(([key]) =>
        SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(key as any)
      )
      .map(([_, value]) => value as number)
      .reduce((a, b) => a + b, 0);

    totals["delivery"] = Object.entries(data?.totals ?? {})
      .filter(([key]) =>
        DELIVERY_COORDINATOR_PROCESS_TASKS.includes(key as any)
      )
      .map(([_, value]) => value as number)
      .reduce((a, b) => a + b, 0);
  }

  useEffect(() => {
    const newTotals = { ...totals };
    newTotals["geographicView"] = mapCount;
    newTotals["symptoms"] = symptomsCount;
    newTotals["finished"] = finishedTasks?.total ?? 0;
    newTotals["pending_tasks"] = totals["delivery"] + totals["shipping"];
    newTotals["completed_tasks"] = finishedTasks?.total ?? 0;
    setTotals(newTotals);
  }, [mapCount, symptomsCount, finishedTasks]);

  return (
    <div
      className={twMerge(
        "transition-all duration-200 ease-in-out overflow-hidden h-full",
        isCollapsed ? "w-0" : "w-64"
      )}
    >
      <Sidebar
        aria-label="Sidebar with multi-level dropdown example"
        theme={sideBarTheme}
        id="sidebar"
      >
        <div className="flex h-full flex-col justify-between dark:border-gray-700">
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
          <BottomMenu
            isCollapsed={isCollapsed}
            dict={dict}
            pathname={pathname}
          />
        </div>
      </Sidebar>
    </div>
  );
}
