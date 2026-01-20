import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Dropdown, DropdownItem } from "flowbite-react";
import { useState } from "react";

export default function PlanningTitle({ dict }: { dict: I18nRecord }) {
  const [type, setType] = useState<"dispatch" | "reception">("dispatch");

  return (
    <div className="flex flex-row gap-2 items-center">
      {/* Title */}
      <h1 className="text-xl font-semibold text-gray-700 dark:text-white">
        {tr("layout.secured.sidebar.planning", dict)}
      </h1>
      <Dropdown
        label=""
        dismissOnClick={false}
        renderTrigger={() => (
          <h1 className="text-xl font-normal text-gray-500 dark:text-white">
            Despacho
          </h1>
        )}
      >
        <DropdownItem>Despacho</DropdownItem>
        <DropdownItem>Recepción</DropdownItem>
      </Dropdown>
    </div>
  );
}
