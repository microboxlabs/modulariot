import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface CompactKanbanViewSwitcherProps {
  activeView: boolean;
  onViewChange: (view: boolean) => void;
  kanbanView: boolean;
  dict: I18nRecord;
}

export function CompactKanbanViewSwitcher({
  activeView,
  onViewChange,
  kanbanView,
  dict,
}: CompactKanbanViewSwitcherProps) {
  return (
    <div className={`${kanbanView ? "flex" : "hidden"} gap-2 h-full`}>
      <div
        className={`flex items-center gap-2 h-9 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-sm hover:cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-100 transition-all duration-300 select-none ${activeView ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100" : "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"}`}
        onClick={() => onViewChange(!activeView)}
      >
        {activeView ? (
          <p>{(dict.kanban as I18nRecord).expand as string}</p>
        ) : (
          <p>{(dict.kanban as I18nRecord).compact as string}</p>
        )}
      </div>
    </div>
  );
}
