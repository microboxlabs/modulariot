import { FaCalendarAlt } from "react-icons/fa";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import icu_condition from "@/features/symptoms/model/icu_condition.json";
import KanbanViewSwitcherIconCompressed from "@/features/svg_components/kanban_view_switcher_icon_compressed";
import { FormattedDate } from "../../formatted-date/formatted-date";

export function TaskPrimaryInfo({
  task,
  dict,
  alert_level,
  alert_style,
}: {
  task: KanbanBoardTask;
  dict: I18nRecord;
  alert_level: number;
  alert_style: { main_color: string; secundary_text: string };
}) {
  return (
    <div className="flex flex-row gap-2">
      <div className="flex items-center">
        <ConditionIcon
          condition={(
            icu_condition[
              String(alert_level) as keyof typeof icu_condition
            ] as string
          ).toLowerCase()}
          dict={dict}
        />
      </div>

      <div className="flex flex-col text-xl">
        <div className="flex flex-row justify-between items-center w-fit">
          {task.name + " "} / {tr(`myTasks.${task.taskType}`, dict)}
        </div>
        <div
          className={`flex flex-row gap-4 text-sm font-light ${alert_style.secundary_text}`}
        >
          {task.departureDate && (
            <span className="flex flex-row items-center gap-1">
              <FaCalendarAlt />
              <FormattedDate date={task.departureDate} format="date" />
            </span>
          )}
          <span className="flex flex-row items-center gap-1">
            <KanbanViewSwitcherIconCompressed
              className={`h-5 w-5 ${alert_style.secundary_text}`}
            />
            {tr(`myTasks.${task.areaType}`, dict)}
          </span>
        </div>
      </div>
    </div>
  );
}
