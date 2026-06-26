"use client";

import { Pagination } from "flowbite-react";
import { useState, useEffect, useRef } from "react";
import { HiClipboardList } from "react-icons/hi";
import {
  useMyTasks,
  useSearchTasks,
} from "@/features/common/providers/client-api.provider";
import { KanbanBoard, KanbanPageData, Task } from "../types/common.types";
import { LaneColumn } from "./lane/lane-column";
import { useLaneViewState } from "../hooks/use-lane-view-state";
import { tr } from "@/features/i18n/tr.service";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  PLANNING_COORDINATOR_PROCESS_TASKS,
  // SHIPPING_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
  SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS,
} from "@/features/task-forms/services/form.service";
import { ViewSwitcher } from "@/features/common/components/view-switcher/view-switcher";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { useViewPreference } from "../hooks/use-view-preference";
import { useCompactViewPreference } from "../hooks/use-compact-view-preference";
import { TableView } from "./views/table-view";
import { transformBoardsToTableData } from "../utils/transform-data";
import { configureLocale } from "@/features/common/services/days.service";
import { CompactKanbanViewSwitcher } from "@/features/common/components/view-switcher/compact-kanban-view-switcher";
import ModalTooltip from "./modal-tooltip";

export default function PageContent({
  showFinishedTasks,
  showWorkflowTasks,
  kanbanBoards,
  lang,
  dictionary,
  userGroups,
}: KanbanPageData & {
  userGroups: string[];
}) {
  const { activeView, handleViewChange } = useViewPreference("kanban");
  const { getLaneState, updateLaneState } = useLaneViewState();
  const [list, setList] = useState<KanbanBoard[]>(kanbanBoards);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [compactKanbanView, setCompactKanbanView] =
    useCompactViewPreference(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const pageSize = 100;

  configureLocale(lang);
  let columns: string[] = [];
  if (showWorkflowTasks) {
    switch (showWorkflowTasks) {
      case "shipping":
        columns = [...SHIPPING_COORDINATOR_PROCESS_TASKS_V2];
        break;
      case "delivery":
        columns = [...DELIVERY_COORDINATOR_PROCESS_TASKS];
        break;
      case "planning":
        columns = [...PLANNING_COORDINATOR_PROCESS_TASKS];
        break;
    }
  } else {
    columns = [...SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS];
  }

  const {
    data: myTasksData,
    error: myTasksError,
    isLoading: _1,
  } = useMyTasks(
    [...columns],
    showFinishedTasks,
    page,
    pageSize,
    searchParams.toString()
  );

  const {
    data: searchTasksData,
    error: searchTasksError,
    isLoading: _2,
  } = useSearchTasks(showFinishedTasks ? null : searchParams.get("search"));

  useEffect(() => {
    if (searchTasksData) {
      const newBoards = list.map((board) => ({
        ...board,
        tasks: board.title2
          ? [
              ...(searchTasksData.data[board.title]?.tasks ?? []),
              ...(searchTasksData.data[board.title2]?.tasks ?? []),
              ...(board.title3
                ? (searchTasksData.data[board.title3]?.tasks ?? [])
                : []),
            ]
          : (searchTasksData.data[board.title]?.tasks ?? []),
      }));
      setList(newBoards);
    } else if (myTasksData) {
      const newBoards = list.map((board) => ({
        ...board,
        tasks: [
          ...(myTasksData.data[board.title]?.tasks ?? []),
          ...(board.title2
            ? (myTasksData.data[board.title2]?.tasks ?? [])
            : []),
          ...(board.title3
            ? (myTasksData.data[board.title3]?.tasks ?? [])
            : []),
        ],
      }));

      setList(newBoards);
    }
  }, [searchTasksData, myTasksData, page, searchParams.get("search")]);

  useEffect(() => {
    if (myTasksError?.status === 401 || searchTasksError?.status === 401) {
      router.replace(`/${lang}/sign-in`);
    }
  }, [myTasksError?.status, searchTasksError?.status, lang, router]);

  const isUnauthorized =
    myTasksError?.status === 401 || searchTasksError?.status === 401;
  const hasOtherError =
    (myTasksError && myTasksError.status !== 401) ||
    (searchTasksError && searchTasksError.status !== 401);

  if (isUnauthorized) {
    return null;
  }

  if (hasOtherError) {
    return (
      <div>Error: {myTasksError?.message || searchTasksError?.message}</div>
    );
  }

  const handleMouseEnter = (task: Task) => {
    if (!isLoading) {
      hoverTimeoutRef.current = window.setTimeout(() => {
        setSelectedTask(task.id);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleCardClick = () => {
    setIsLoading(true);
    setSelectedTask(null);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const totalVisible = list
    .filter((board) => (showFinishedTasks ? board.finished : !board.finished))
    .reduce((sum, board) => sum + board.tasks.length, 0);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <SectionHeader
        path={[
          "breadcrumb.tasks",
          showFinishedTasks ? "breadcrumb.finished" : "breadcrumb.shipping",
        ]}
        rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
        breadcrumbDict={dictionary.base}
        filterDict={dictionary.general}
        lang={lang}
        rightContent={
          <div className="flex items-center gap-1">
            {activeView === "kanban" && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-[3px] text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {tr("taskCounter.activeCount", dictionary.base, {
                  count: totalVisible.toString(),
                })}
              </span>
            )}
            <CompactKanbanViewSwitcher
              kanbanView={activeView === "kanban"}
              activeView={compactKanbanView}
              onViewChange={setCompactKanbanView}
              dict={dictionary.base}
            />
            <ViewSwitcher
              activeView={activeView}
              onViewChange={handleViewChange}
              dict={dictionary.base}
            />
          </div>
        }
      />
      <div
        className={`isolate h-screen w-full overflow-auto ${
          activeView === "kanban" ? "bg-gray-50 dark:bg-gray-900" : ""
        }`}
      >
        {activeView === "kanban" ? (
          <div
            className={`flex items-start justify-start py-4 ${compactKanbanView ? "mx-2 gap-2" : "mx-4 gap-4"} `}
          >
            <ModalTooltip
              lang={lang}
              userGroups={userGroups}
              selectedTask={selectedTask}
              setSelectedTask={setSelectedTask}
              dict={dictionary.general}
              isFinished={false}
            />
            {list.map((board) => {
              if (showFinishedTasks ? !board.finished : board.finished) {
                return null;
              }
              return (
                <LaneColumn
                  key={board.id}
                  board={board}
                  compactKanbanView={compactKanbanView}
                  showFinishedTasks={showFinishedTasks}
                  isLoading={isLoading}
                  dict={dictionary.base}
                  laneState={getLaneState(board.title)}
                  onLaneUpdate={(patch) => updateLaneState(board.title, patch)}
                  setList={setList}
                  onCardMouseEnter={handleMouseEnter}
                  onCardMouseLeave={handleMouseLeave}
                  onCardClick={handleCardClick}
                />
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto px-4 bg-white dark:bg-gray-900 dark:text-white flex flex-col h-full">
            <TableView
              set_page={setPage}
              page={page}
              pageSize={pageSize}
              data={transformBoardsToTableData(
                list.reduce(
                  (acc, board) => {
                    acc[board.title] = board;
                    return acc;
                  },
                  {} as Record<string, KanbanBoard>
                )
              )}
              dict={dictionary.base}
              lang={lang}
              data_length={myTasksData?.total}
            />
            <div className="w-full flex py-2 justify-center align-middle items-center mt-auto">
              <Pagination
                theme={{
                  pages: {
                    base: "xs:mt-0 mt-0 inline-flex items-center align-middle -space-x-px",
                  },
                }}
                nextLabel=""
                previousLabel=""
                currentPage={page}
                totalPages={Math.ceil((myTasksData?.total ?? 100) / pageSize)}
                onPageChange={(page) => {
                  setPage(page);
                }}
                showIcons
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
