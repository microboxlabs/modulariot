"use client";

import { Dispatch, SetStateAction } from "react";
import { ReactSortable } from "react-sortablejs";
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  Tooltip,
} from "flowbite-react";
import { HiCheck, HiDotsHorizontal } from "react-icons/hi";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KanbanBoard, KanbanBoardTask, Task } from "../../types/common.types";
import {
  LaneFilter,
  LaneSort,
  LaneViewState,
} from "../../hooks/use-lane-view-state";
import KanbanCard from "../kanban-card/kanban-card";
import { TaskCounter } from "../TaskCounter";

interface LaneColumnProps {
  board: KanbanBoard;
  compactKanbanView: boolean;
  showFinishedTasks: boolean;
  isLoading: boolean;
  dict: I18nRecord;
  laneState: LaneViewState;
  onLaneUpdate: (patch: Partial<LaneViewState>) => void;
  setList: Dispatch<SetStateAction<KanbanBoard[]>>;
  onCardMouseEnter: (task: Task) => void;
  onCardMouseLeave: () => void;
  onCardClick: () => void;
}

function departureValue(task: KanbanBoardTask): number {
  const raw = task.departureDate ?? task.expectedDepartureDate;
  const time = raw ? new Date(raw).getTime() : NaN;
  // Tasks without a date sort to the end.
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function sortTasks(tasks: KanbanBoardTask[], sort: LaneSort): KanbanBoardTask[] {
  if (sort === "none") return tasks;
  const copy = [...tasks];
  switch (sort) {
    case "priority":
      return copy.sort(
        (a, b) =>
          (a.mintral_priorityCode === "UR" ? 0 : 1) -
          (b.mintral_priorityCode === "UR" ? 0 : 1)
      );
    case "eta":
      return copy.sort((a, b) => departureValue(a) - departureValue(b));
    case "code":
      return copy.sort((a, b) =>
        (a.mintral_serviceCode ?? "").localeCompare(b.mintral_serviceCode ?? "")
      );
    default:
      return copy;
  }
}

function filterTasks(
  tasks: KanbanBoardTask[],
  filter: LaneFilter
): KanbanBoardTask[] {
  switch (filter) {
    case "urgent":
      return tasks.filter((t) => t.mintral_priorityCode === "UR");
    case "actionable":
      return tasks.filter((t) => t.isEditable);
    default:
      return tasks;
  }
}

/**
 * A single kanban lane rendered as a visually-separated panel. Columns map 1:1
 * to workflow stages, so the lane is presentation-only: drag is disabled and the
 * per-lane menu (density / sort / filter / collapse) only affects the client
 * view — it never mutates the workflow structure.
 */
export function LaneColumn({
  board,
  compactKanbanView,
  showFinishedTasks,
  isLoading,
  dict,
  laneState,
  onLaneUpdate,
  setList,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardClick,
}: LaneColumnProps) {
  const compact =
    laneState.density === "inherit"
      ? compactKanbanView
      : laneState.density === "compact";

  const title = tr(
    `kanban.${board.title}${
      compact && (dict.kanban as I18nRecord)?.[board.title + "Compact"]
        ? "Compact"
        : ""
    }`,
    dict
  );

  const visibleTasks = sortTasks(
    filterTasks(board.tasks, laneState.filter),
    laneState.sort
  );

  if (laneState.collapsed) {
    return (
      <Tooltip content={tr("kanban.lane.expand", dict)}>
        <button
          type="button"
          onClick={() => onLaneUpdate({ collapsed: false })}
          className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg bg-gray-100 p-2 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          aria-label={tr("kanban.lane.expand", dict)}
        >
          <TaskCounter count={visibleTasks.length} dict={dict} />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-gray-700 [writing-mode:vertical-rl] dark:text-gray-300">
            {title}
          </span>
        </button>
      </Tooltip>
    );
  }

  const checkIcon = (active: boolean) => (
    <HiCheck
      className={`h-4 w-4 ${active ? "text-primary-600" : "opacity-0"}`}
    />
  );

  return (
    <div
      className={`flex shrink-0 flex-col rounded-lg bg-gray-100 p-3 dark:bg-gray-800 ${
        compact ? "w-44" : "w-[280px]"
      }`}
    >
      <div className="sticky top-0 z-10 mb-3 flex min-h-[2.5rem] items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="line-clamp-2 min-w-0 text-xs font-semibold uppercase leading-tight tracking-wide text-gray-700 dark:text-gray-300">
            {title}
          </span>
          <TaskCounter count={visibleTasks.length} dict={dict} />
        </div>
        <div className="shrink-0">
          <Dropdown
            inline
            arrowIcon={false}
            dismissOnClick={false}
            label=""
            renderTrigger={() => (
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label={tr("kanban.lane.menuLabel", dict)}
              >
                <HiDotsHorizontal className="h-4 w-4" />
              </button>
            )}
          >
            <DropdownHeader className="py-1 text-xs font-semibold uppercase text-gray-400">
              {tr("kanban.lane.density", dict)}
            </DropdownHeader>
            <DropdownItem
              icon={() => checkIcon(laneState.density === "inherit")}
              onClick={() => onLaneUpdate({ density: "inherit" })}
            >
              {tr("kanban.lane.densityInherit", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.density === "compact")}
              onClick={() => onLaneUpdate({ density: "compact" })}
            >
              {tr("kanban.lane.densityCompact", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.density === "expanded")}
              onClick={() => onLaneUpdate({ density: "expanded" })}
            >
              {tr("kanban.lane.densityExpanded", dict)}
            </DropdownItem>

            <DropdownHeader className="py-1 text-xs font-semibold uppercase text-gray-400">
              {tr("kanban.lane.sort", dict)}
            </DropdownHeader>
            <DropdownItem
              icon={() => checkIcon(laneState.sort === "none")}
              onClick={() => onLaneUpdate({ sort: "none" })}
            >
              {tr("kanban.lane.sortNone", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.sort === "priority")}
              onClick={() => onLaneUpdate({ sort: "priority" })}
            >
              {tr("kanban.lane.sortPriority", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.sort === "eta")}
              onClick={() => onLaneUpdate({ sort: "eta" })}
            >
              {tr("kanban.lane.sortEta", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.sort === "code")}
              onClick={() => onLaneUpdate({ sort: "code" })}
            >
              {tr("kanban.lane.sortCode", dict)}
            </DropdownItem>

            <DropdownHeader className="py-1 text-xs font-semibold uppercase text-gray-400">
              {tr("kanban.lane.filter", dict)}
            </DropdownHeader>
            <DropdownItem
              icon={() => checkIcon(laneState.filter === "none")}
              onClick={() => onLaneUpdate({ filter: "none" })}
            >
              {tr("kanban.lane.filterNone", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.filter === "urgent")}
              onClick={() => onLaneUpdate({ filter: "urgent" })}
            >
              {tr("kanban.lane.filterUrgent", dict)}
            </DropdownItem>
            <DropdownItem
              icon={() => checkIcon(laneState.filter === "actionable")}
              onClick={() => onLaneUpdate({ filter: "actionable" })}
            >
              {tr("kanban.lane.filterActionable", dict)}
            </DropdownItem>

            <DropdownItem
              className="border-t border-gray-100 dark:border-gray-600"
              onClick={() => onLaneUpdate({ collapsed: true })}
            >
              {tr("kanban.lane.collapse", dict)}
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
      <ReactSortable
        animation={100}
        forceFallback
        group="kanban"
        list={visibleTasks}
        setList={(tasks: KanbanBoardTask[]) =>
          setList((list) => {
            const newList = [...list];
            const index = newList.findIndex((item) => item.id === board.id);
            newList[index].tasks = tasks;
            return newList;
          })
        }
        disabled={true}
        className={`flex flex-col ${compact ? "gap-1" : "gap-4"}`}
      >
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className={`w-full h-fit group relative ${
              isLoading ? "cursor-wait" : ""
            }`}
            role="button"
            tabIndex={0}
            onMouseEnter={() => onCardMouseEnter(task)}
            onMouseLeave={onCardMouseLeave}
            onClick={onCardClick}
            onKeyDown={(e) => {
              e.preventDefault();
            }}
            aria-label={`Task ${task.id}`}
          >
            <KanbanCard
              task={task}
              dict={dict}
              table_name={board.title}
              compactKanbanView={compact}
              showFinishedTasks={showFinishedTasks}
              isLoading={isLoading}
            />
          </div>
        ))}
      </ReactSortable>
    </div>
  );
}
