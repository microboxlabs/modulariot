import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button } from "flowbite-react";

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
    <Button.Group>
      <Button color="gray" onClick={() => onViewChange("table")} size="sm" disabled={activeView === "table"}>{dict.views?.table || "Table"}</Button>
      <Button color="gray" onClick={() => onViewChange("kanban")} size="sm" disabled={activeView === "kanban"}>{dict.views?.kanban || "Kanban"}</Button>
    </Button.Group>

  );
}

{/* <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700">
      <button
        className={`inline-flex items-center px-4 py-2 rounded-l-md ${activeView === "table"
            ? "bg-gray-200 text-primary-700 dark:bg-gray-700 dark:text-white"
            : "hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        onClick={() => onViewChange("table")}
      >
        <span className="hidden sm:inline">{dict.views?.table || "Table"}</span>
      </button>
      <button
        className={`inline-flex items-center px-4 py-2 rounded-r-lg ${activeView === "kanban"
            ? "bg-gray-200 text-primary-700 dark:bg-gray-700 dark:text-white bg-primary-100"
            : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        onClick={() => onViewChange("kanban")}
      >
        <span className="hidden sm:inline">
          {dict.views?.kanban || "Kanban"}
        </span>
      </button>
    </div> */}