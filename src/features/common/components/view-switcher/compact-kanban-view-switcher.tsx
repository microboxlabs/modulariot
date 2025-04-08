import { ToggleSwitch } from "flowbite-react";
import Image from "next/image";
interface CompactKanbanViewSwitcherProps {
  activeView: boolean;
  onViewChange: (view: boolean) => void;
}

export function CompactKanbanViewSwitcher({
  activeView,
  onViewChange,
}: CompactKanbanViewSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        <Image
          src={
            activeView
              ? "/app/icons/kanban/IconkanbanCom.png"
              : "/app/icons/kanban/IconkanbanExp.png"
          }
          alt="Kanban"
          width={20}
          height={20}
        />
      </span>
      <ToggleSwitch
        checked={activeView}
        onChange={onViewChange}
        className="w-10 h-5"
      />
    </div>
  );
}
