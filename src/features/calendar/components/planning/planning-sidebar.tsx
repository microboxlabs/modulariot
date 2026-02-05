import "server-only";

import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { PlanningSidebarForm } from "./planning-sidebar-form";

interface PlanningSidebarProps {
  dict: I18nDictionary;
  selectedService?: {
    serviceNumber: string;
    origin: string;
    destination: string;
  };
}

export default function PlanningSidebar({
  dict,
  selectedService,
}: Readonly<PlanningSidebarProps>) {
  const isActive = Boolean(selectedService);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("pages.planning.sidebar.title", dict)}
        </h2>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <PlanningSidebarForm dict={dict} isActive={isActive} />
      </div>
    </div>
  );
}
