"use client";
import { useSidebarContext } from "@/features/sidebar/context/sidebar-context";
import { Sidebar } from "flowbite-react";
import SidebarItem from "../sidebar-item/sidebar-item";
import { usePathname, useSearchParams } from "next/navigation";
import { twMerge } from "tailwind-merge";
import { pages } from "../../models/pages";
/* import { externalPages } from "../../models/externalPages"; */
import BottomMenu from "../bottom-menu/bottom-menu";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import { pathNameWithoutLanguage } from "../../utils/utils";
import { tr } from "@/features/i18n/tr.service";
import { useState, useEffect } from "react";
import {
  useSymptoms,
  useMapPositions,
  useMyTasksCount,
  useMyTasks,
} from "@/features/common/providers/client-api.provider";
import { SHIPPING_COORDINATOR_PROCESS_TASKS } from "@/features/task-forms/services/form.service";

export default function MobileSidebar({ dict }: PropsWithI18nDict) {
  // remove first element of pathname which is the language
  const pathname = pathNameWithoutLanguage(usePathname());
  const { isOpen, close } = useSidebarContext().mobile;

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

  if (!error) {
    totals["shipping"] = Object.entries(data?.totals ?? {})
      .map(([_, value]) => value as number)
      .reduce((a, b) => a + b, 0);
  } /* else if (error.status === 403 || error.status === 401) {
    router.push("/sign-in");
  } */

  useEffect(() => {
    const newTotals = { ...totals };
    newTotals["geographicView"] = mapCount;
    newTotals["symptoms"] = symptomsCount;
    newTotals["finished"] = finishedTasks?.total ?? 0;
    setTotals(newTotals);
  }, [mapCount, symptomsCount, finishedTasks]);

  if (!isOpen) return null;

  return (
    <>
      <Sidebar
        aria-label="Sidebar with multi-level dropdown example"
        theme={{
          root: {
            inner:
              "h-full overflow-y-auto overflow-x-hidden bg-gray-50 px-3 py-4 dark:bg-gray-800",
          },
        }}
        className={twMerge(
          "fixed inset-y-0 left-0 z-20 hidden h-full shrink-0 flex-col border-r border-gray-200 pt-16 lg:flex dark:border-gray-700 bg-red-500",
          isOpen && "flex"
        )}
        id="sidebar"
      >
        <div className="flex h-full flex-col justify-between dark:border-gray-700">
          <div className="py-2">
            <Sidebar.Items>
              <Sidebar.ItemGroup className="mt-0 border-t-0 pb-1 pt-0">
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
              </Sidebar.ItemGroup>
              {/* <Sidebar.ItemGroup className="mt-2 pt-2">
                {externalPages.map((item) => (
                  <SidebarItem key={item.label} {...item} pathname={pathname} />
                ))}
              </Sidebar.ItemGroup> */}
            </Sidebar.Items>
          </div>
          <BottomMenu isCollapsed={false} dict={dict} pathname={pathname} />
        </div>
      </Sidebar>
      <div
        onClick={close}
        aria-hidden="true"
        className="fixed inset-0 z-10 h-full w-full bg-gray-900/50 pt-16 dark:bg-gray-900/90"
      />
    </>
  );
}
