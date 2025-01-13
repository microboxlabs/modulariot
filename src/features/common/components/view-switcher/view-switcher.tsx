import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface ViewSwitcherProps {
  activeView: "table" | "kanban";
  onViewChange: (view: "table" | "kanban") => void;
  dict: I18nRecord;
}

export function ViewSwitcher({
  activeView,
  onViewChange,
  dict,
}: ViewSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        className={`inline-flex items-center px-4 py-2 rounded-l-lg ${
          activeView === "table"
            ? "bg-gray-200 text-primary-700 dark:bg-gray-700 dark:text-white"
            : "hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
        onClick={() => onViewChange("table")}
      >
        <span className="hidden sm:inline">{dict.views?.table || "Table"}</span>
      </button>
      <button
        className={`inline-flex items-center px-4 py-2 rounded-r-lg ${
          activeView === "kanban"
            ? "bg-gray-200 text-primary-700 dark:bg-gray-700 dark:text-white bg-primary-100"
            : "hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
        onClick={() => onViewChange("kanban")}
      >
        <span className="hidden sm:inline">
          {dict.views?.kanban || "Kanban"}
        </span>
      </button>
    </div>
  );
}
