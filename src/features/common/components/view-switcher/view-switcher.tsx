import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button, ButtonGroup } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";

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
    <ButtonGroup>
      <Button
        outline
        color="alternative"
        onClick={() => onViewChange("kanban")}
        size="sm"
        disabled={activeView === "kanban"}
      >
        {tr("views.kanban", dict)}
      </Button>
      <Button
        outline
        color="alternative"
        onClick={() => onViewChange("table")}
        size="sm"
        disabled={activeView === "table"}
      >
        {tr("views.table", dict)}
      </Button>
    </ButtonGroup>
  );
}
