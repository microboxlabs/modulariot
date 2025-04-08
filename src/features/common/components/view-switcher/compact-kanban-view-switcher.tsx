import { ToggleSwitch } from "flowbite-react";
import KanbanViewSwitcherIcon from "../../../svg_components/kanban_view_switcher_icon";
import KanbanViewSwitcherIconCompressed from "../../../svg_components/kanban_view_switcher_icon_compressed";

interface CompactKanbanViewSwitcherProps {
  activeView: boolean;
  onViewChange: (view: boolean) => void;
  kanbanView: boolean;
}

export function CompactKanbanViewSwitcher({
  activeView,
  onViewChange,
  kanbanView,
}: CompactKanbanViewSwitcherProps) {
  return (
    <div className={`${kanbanView ? "flex" : "hidden"} gap-2`}>
      <span className="text-sm font-medium">
        {activeView ? (
          <KanbanViewSwitcherIconCompressed />
        ) : (
          <KanbanViewSwitcherIcon />
        )}
      </span>
      <ToggleSwitch
        checked={activeView}
        onChange={onViewChange}
        className="w-10 h-5"
      />
    </div>
  );
}
