import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SegmentedSwitcher } from "./segmented-switcher";

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
    <SegmentedSwitcher
      options={[
        { value: "kanban", label: tr("views.kanban", dict) },
        { value: "table", label: tr("views.table", dict) },
      ]}
      active={activeView}
      onChange={onViewChange}
    />
  );
}
