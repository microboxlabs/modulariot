"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { HiCheck } from "react-icons/hi2";
import { I18nRecord, I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME_LG } from "../../modal-theme";
import { moveBentoFile, useMyTasks } from "@/features/common/providers/client-api.provider";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { toast } from "sonner";
import { PlanningSearchAutocomplete } from "@/features/calendar/components/planning/planning-search-autocomplete";
import type { SelectedService, TripType } from "@/features/calendar/components/planning/planning-selection-context";

/**
 * Transform KanbanBoardTask to SelectedService for the search autocomplete.
 */
function taskToSelectedService(task: KanbanBoardTask): SelectedService {
  return {
    id: task.name || task.id,
    mintral_serviceCode: task.mintral_serviceCode,
    cliente: task.client || task.clientCode || "",
    origen: task.origin || "",
    destino: task.destination || "",
    lugarCarguio: "",
    tipoViaje: (task.serviceKind || "Sider") as TripType,
    ocupacion: 0,
    permanencia: "24h",
    leadTime: {
      total_lineasoc_cumplen: 0,
      total_lineasoc_incumplen: 0,
      lineasoc_pctn_cumplimiento: null,
    },
    eta: "",
    incidencias: [],
    observaciones: "",
    prioridad: 0,
    expectedDepartureDate: task.expectedDepartureDate || "",
    presentationDate: task.mintral_creationDate || task.cm_created || "",
  };
}

/**
 * Card component for displaying a service task with route info.
 */
function TaskServiceCard({
  task,
  isCurrent,
  isSelected,
  dictionary,
  onSelect,
}: Readonly<{
  task: KanbanBoardTask;
  isCurrent: boolean;
  isSelected: boolean;
  dictionary: I18nRecord;
  onSelect: () => void;
}>) {
  let cardCls =
    "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer";
  if (isCurrent) {
    cardCls =
      "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 opacity-50 cursor-not-allowed";
  } else if (isSelected) {
    cardCls = "border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer";
  }

  return (
    <button
      type="button"
      disabled={isCurrent}
      onClick={onSelect}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${cardCls}`}
    >
      <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
        {task.name}
      </span>
      {(task.origin || task.destination) && (
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {task.origin || "—"} → {task.destination || "—"}
        </span>
      )}
      {isCurrent && (
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">
          {tr("bento.multimedia.move_file_here", dictionary)}
        </span>
      )}
      {!isCurrent && isSelected && (
        <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
      )}
    </button>
  );
}

export function MoveToTaskModal({
  show,
  onClose,
  fileName,
  nodeId,
  currentTaskServiceCode,
  onMoved,
  dictionary,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  fileName: string;
  nodeId?: string;
  currentTaskServiceCode?: string;
  onMoved?: () => void;
  dictionary: I18nRecord;
}>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [filterMatchType, setFilterMatchType] = useState<{
    matchType: string;
    query: string;
  } | null>(null);
  const [selectedTask, setSelectedTask] = useState<KanbanBoardTask | null>(null);

  useEffect(() => {
    if (show) {
      setSearchQuery("");
      setActiveQuery("");
      setFilterMatchType(null);
      setSelectedTask(null);
    }
  }, [show]);

  // Use activeQuery (locked when filter is selected) or live searchQuery
  const effectiveQuery = filterMatchType ? activeQuery : searchQuery;
  const shouldSearch = effectiveQuery.length >= 2;

  const { data, isLoading } = useMyTasks(
    ["planService", "assignDriver", "presentDriver", "prepareService", "missionControl"],
    false,
    shouldSearch ? 1 : undefined,
    shouldSearch ? 50 : undefined,
    shouldSearch ? `q=${encodeURIComponent(effectiveQuery)}` : undefined
  );

  const allTasks: KanbanBoardTask[] = useMemo(() => {
    if (!shouldSearch || !data?.data) return [];
    return Object.values(data.data).flatMap((board) => board.tasks);
  }, [data, shouldSearch]);

  // Convert tasks to SelectedService for the autocomplete component
  const servicesForSearch: SelectedService[] = useMemo(
    () => allTasks.map(taskToSelectedService),
    [allTasks]
  );

  // Filter tasks based on selected match type
  const filteredTasks = useMemo(() => {
    if (!filterMatchType) return allTasks;
    const { matchType, query } = filterMatchType;
    const lowerQuery = query.toLowerCase();
    return allTasks.filter((task) => {
      switch (matchType) {
        case "id":
          return (task.name || task.id).toLowerCase().includes(lowerQuery);
        case "cliente":
          return (task.client || task.clientCode || "").toLowerCase().includes(lowerQuery);
        case "origen":
          return (task.origin || "").toLowerCase().includes(lowerQuery);
        case "destino":
          return (task.destination || "").toLowerCase().includes(lowerQuery);
        default:
          return true;
      }
    });
  }, [allTasks, filterMatchType]);

  const handleSearchSelect = useCallback((service: SelectedService) => {
    const task = allTasks.find(
      (t) => (t.name || t.id) === service.id
    );
    if (task) setSelectedTask(task);
  }, [allTasks]);

  const handleMatchTypeSelect = useCallback(
    (matchType: string, query: string) => {
      setActiveQuery(query);
      setFilterMatchType({ matchType, query });
    },
    []
  );

  const handleSearchClear = useCallback(() => {
    setFilterMatchType(null);
    setActiveQuery("");
  }, []);

  const handleQueryChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (q) {
      // New search started — clear previous filter
      setFilterMatchType(null);
      setActiveQuery("");
    }
  }, []);

  const handleMove = () => {
    if (!selectedTask || !nodeId) return;
    const movePromise = moveBentoFile(nodeId, selectedTask.id).then((res) => {
      onMoved?.();
      onClose();
      return res;
    });
    toast.promise(movePromise, {
      loading: tr("bento.multimedia.move_loading", dictionary),
      success: `"${fileName}" ${tr("bento.multimedia.move_success", dictionary)} ${selectedTask.name}`,
      error: tr("bento.multimedia.move_error", dictionary),
    });
  };

  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="lg"
      theme={MODAL_THEME_LG}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">{tr("bento.multimedia.move_modal_title", dictionary)}</span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {tr("bento.multimedia.move_modal_desc", dictionary)}
          </span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          {/* Search - uses the same component as the calendar planning sidebar */}
          <PlanningSearchAutocomplete
            dict={dictionary as I18nDictionary}
            services={servicesForSearch}
            onSelect={handleSearchSelect}
            onMatchTypeSelect={handleMatchTypeSelect}
            onClear={handleSearchClear}
            onQueryChange={handleQueryChange}
            hasActiveFilter={filterMatchType !== null}
            isLoading={isLoading}
          />

          {/* Results list */}
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {!shouldSearch && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_search_hint", dictionary)}
              </p>
            )}
            {shouldSearch && !isLoading && filteredTasks.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_no_results", dictionary)}
              </p>
            )}
            {filteredTasks.map((task) => {
              const isCurrent =
                !!currentTaskServiceCode &&
                (task.mintral_serviceCode === currentTaskServiceCode ||
                  task.name === currentTaskServiceCode ||
                  task.name.startsWith(currentTaskServiceCode + "-") ||
                  task.name.startsWith(currentTaskServiceCode + " "));
              const isSelected = selectedTask?.id === task.id;
              return (
                <TaskServiceCard
                  key={task.id}
                  task={task}
                  isCurrent={isCurrent}
                  isSelected={isSelected}
                  dictionary={dictionary}
                  onSelect={() => setSelectedTask(isSelected ? null : task)}
                />
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button color="alternative" onClick={onClose}>
              {tr("bento.multimedia.btn_cancel", dictionary)}
            </Button>
            <Button color="blue" disabled={!selectedTask} onClick={handleMove}>
              {tr("bento.multimedia.btn_move", dictionary)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
