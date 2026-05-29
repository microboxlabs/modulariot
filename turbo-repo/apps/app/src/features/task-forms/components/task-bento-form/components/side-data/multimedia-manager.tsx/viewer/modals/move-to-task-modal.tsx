"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { HiCheck, HiMagnifyingGlass } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME_LG } from "../../modal-theme";
import { moveBentoFile, useSearchTasks } from "@/features/common/providers/client-api.provider";
import type { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { toast } from "sonner";

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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<KanbanBoardTask | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setSearch("");
      setDebouncedSearch("");
      setSelectedTask(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useSearchTasks(debouncedSearch.length >= 2 ? debouncedSearch : null);

  const tasks: KanbanBoardTask[] = data
    ? Object.values(data.data).flatMap((board) => board.tasks)
    : [];

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
          {/* Search input */}
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("bento.multimedia.move_search_placeholder", dictionary)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Results list */}
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {debouncedSearch.length < 2 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_search_hint", dictionary)}
              </p>
            )}
            {debouncedSearch.length >= 2 && !isLoading && tasks.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                {tr("bento.multimedia.move_no_results", dictionary)}
              </p>
            )}
            {debouncedSearch.length >= 2 && tasks.length > 0 && tasks.map((task) => {
                const isCurrent = !!currentTaskServiceCode && (
                  task.mintral_serviceCode === currentTaskServiceCode ||
                  task.name === currentTaskServiceCode ||
                  task.name.startsWith(currentTaskServiceCode + "-") ||
                  task.name.startsWith(currentTaskServiceCode + " ")
                );
                const isSelected = selectedTask?.id === task.id;
                let taskButtonCls = "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer";
                if (isCurrent) {
                  taskButtonCls = "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 opacity-50 cursor-not-allowed";
                } else if (isSelected) {
                  taskButtonCls = "border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer";
                }
                return (
                  <button
                    key={task.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => !isCurrent && setSelectedTask(isSelected ? null : task)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${taskButtonCls}`}
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {task.name}
                    </span>
                    {isCurrent && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 whitespace-nowrap">{tr("bento.multimedia.move_file_here", dictionary)}</span>
                    )}
                    {!isCurrent && isSelected && (
                      <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })
            }
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
