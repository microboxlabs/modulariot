"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useRouter } from "next/navigation";
import { pages } from "../models/pages";
import { SidebarItem } from "../types/common.types";
import {
  getMyTasks,
  useCalendars,
  useHistoricInstancesCount,
  useMapPositions,
  useMyTasksCount,
  useSymptoms,
  useUserFilters,
} from "@/features/common/providers/client-api.provider";
import type { CalendarGroupResponse, CalendarResponse } from "@microboxlabs/miot-calendar-client";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { DeliveryProcessTask, PlanningProcessTask, ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";

interface SidebarNavigationContextValue {
  items: SidebarItem[];
  totals: Record<string, number | string>;
  isLoading: boolean;
}

const SidebarNavigationContext =
  createContext<SidebarNavigationContextValue | null>(null);

function useTaskDynamicItems(): SidebarItem[] {
  const { data: userFiltersData } = useUserFilters();
  const [dynamicItems, setDynamicItems] = useState<
    { item: SidebarItem; position: number }[]
  >([]);

  useEffect(() => {
    if (!userFiltersData || userFiltersData.length === 0) return;

    const pending: Promise<{ item: SidebarItem; position: number }>[] =
      userFiltersData.map((filter) => {
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

        return getMyTasks(
          [
            ...SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
            ...DELIVERY_COORDINATOR_PROCESS_TASKS,
            ...PLANNING_COORDINATOR_PROCESS_TASKS,
          ],
          false,
          0,
          2000,
          filterPart + "&editable=true"
        ).then((total) => ({
          item: {
            href: `/mytasks?${filterPart}`,
            label,
            totals: { [label]: total.total },
          },
          position: position ? Number.parseInt(position) : 0,
        }));
      });

    Promise.all(pending)
      .then((results) => {
        setDynamicItems(results);
      })
      .catch((err) => {
        console.error("Failed to load dynamic sidebar items:", err);
        setDynamicItems([]);
      });
  }, [userFiltersData]);

  return useMemo(
    () =>
      dynamicItems
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.item),
    [dynamicItems]
  );
}

function useCalendarDynamicItems(): SidebarItem[] {
  const { calendars } = useCalendars();

  return useMemo(() => {
    if (calendars.length === 0) return [];

    const groupMap = new Map<string, { group: CalendarGroupResponse; items: CalendarResponse[] }>();
    const ungrouped: CalendarResponse[] = [];

    for (const cal of calendars) {
      const group = cal.groups?.[0];
      if (group) {
        if (!groupMap.has(group.code)) groupMap.set(group.code, { group, items: [] });
        groupMap.get(group.code)!.items.push(cal);
      } else {
        ungrouped.push(cal);
      }
    }

    const result: SidebarItem[] = [];

    for (const { group, items } of groupMap.values()) {
      result.push({
        label: group.name,
        items: items.map((cal) => ({
          href: `/calendar/${cal.id}/planning?groupCode=${group.code}`,
          label: cal.name,
        })),
      });
    }

    for (const cal of ungrouped) {
      result.push({ href: `/calendar/${cal.id}/planning`, label: cal.name });
    }

    return result;
  }, [calendars]);
}

export function SidebarNavigationProvider({ children }: Readonly<PropsWithChildren>) {
  const router = useRouter();
  const { data, error } = useMyTasksCount();
  const { data: historicInstances } = useHistoricInstancesCount();
  const { count: mapCount } = useMapPositions();
  const { count: symptomsCount } = useSymptoms();
  const taskDynamicItems = useTaskDynamicItems();
  const calendarDynamicItems = useCalendarDynamicItems();

  useEffect(() => {
    if (error && (error.status === 401 || error.status === 403)) {
      router.push("/sign-in");
    }
  }, [error, router]);

  const contextValue = useMemo(() => {
    const totals: Record<string, number | string> = {};

    if (!error) {
      totals["shipping"] = Object.entries(data?.totals ?? {})
        .filter(([key]) =>
          SHIPPING_COORDINATOR_PROCESS_TASKS_V2.includes(key as ShippingCoordinatorProcessTaskV2)
        )
        .map(([, value]) => value)
        .reduce((a, b) => a + b, 0);

      totals["delivery"] = Object.entries(data?.totals ?? {})
        .filter(([key]) =>
          DELIVERY_COORDINATOR_PROCESS_TASKS.includes(key as DeliveryProcessTask)
        )
        .map(([, value]) => value)
        .reduce((a, b) => a + b, 0);

      totals["planning"] = Object.entries(data?.totals ?? {})
        .filter(([key]) =>
          PLANNING_COORDINATOR_PROCESS_TASKS.includes(key as PlanningProcessTask)
        )
        .map(([, value]) => value)
        .reduce((a, b) => a + b, 0);

      totals["calendarPlanning"] = Object.entries(data?.totals ?? {})
        .filter(([key]) => key === "planService")
        .map(([, value]) => value)
        .reduce((a, b) => a + b, 0);
    }

    const historicInstancesTotal = Object.values(
      historicInstances?.totals ?? {}
    ).reduce((sum, count) => sum + count, 0);

    totals["geographicView"] = mapCount;
    totals["symptoms"] = symptomsCount;
    totals["finished"] = historicInstancesTotal;
    totals["pending_tasks"] =
      ((totals["delivery"] as number) ?? 0) +
      ((totals["shipping"] as number) ?? 0);
    totals["completed_tasks"] = historicInstancesTotal;
    totals["signalHistory"] = "-";

    const dynamicMap: Record<string, SidebarItem[]> = {
      tasks: taskDynamicItems,
      calendars: calendarDynamicItems,
    };

    const resolvedItems = pages.map((page) => {
      if (!page.dynamicItemsSource) return page;
      const dynamic = dynamicMap[page.dynamicItemsSource] ?? [];
      return { ...page, items: [...(page.items ?? []), ...dynamic] };
    });

    return { items: resolvedItems, totals, isLoading: false };
  }, [taskDynamicItems, calendarDynamicItems, data, historicInstances, mapCount, symptomsCount, error]);

  return (
    <SidebarNavigationContext.Provider
      value={contextValue}
    >
      {children}
    </SidebarNavigationContext.Provider>
  );
}

export function useSidebarNavigation(): SidebarNavigationContextValue {
  const ctx = useContext(SidebarNavigationContext);
  if (!ctx) {
    throw new Error(
      "useSidebarNavigation must be used within SidebarNavigationProvider"
    );
  }
  return ctx;
}
