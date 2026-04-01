"use client";

import type { Colaborator } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ColaboratorDetailHeader from "./colaborator-detail-header";

interface ColaboratorDetailViewProps {
  readonly colaborator: Colaborator;
  readonly dict: I18nRecord;
  readonly onBack: () => void;
}

export default function ColaboratorDetailView({
  colaborator,
  dict,
  onBack,
}: ColaboratorDetailViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <ColaboratorDetailHeader
        colaborator={colaborator}
        dict={dict}
        onBack={onBack}
      />
      {/* Content will be added here */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">
        Detalle del colaborador en construcción...
      </div>
    </div>
  );
}
