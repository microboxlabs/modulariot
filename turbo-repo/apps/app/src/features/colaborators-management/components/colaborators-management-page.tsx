"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { colaboratorsKpis, colaborators } from "../data/colaborators-mock-data";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import ColaboratorGrid from "./colaborator-grid/colaborator-grid";
import ColaboratorDetailView from "./colaborator-detail/colaborator-detail-view";

interface ColaboratorsManagementPageProps {
  readonly dict: I18nRecord;
}

export default function ColaboratorsManagementPage({
  dict,
}: ColaboratorsManagementPageProps) {
  const colaboratorsDict = dict["colaboratorsManagement"] as I18nRecord;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedColaboratorId = searchParams.get("colaborator");

  const selectedColaborator = useMemo(
    () => colaborators.find((c) => c.id === selectedColaboratorId),
    [selectedColaboratorId]
  );

  const handleSelectColaborator = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("colaborator", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const handleBack = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("colaborator");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, [searchParams, router, pathname]);

  if (selectedColaborator) {
    return (
      <div className="flex flex-col gap-6 p-4 max-w-screen-2xl mx-auto w-full">
        <ColaboratorDetailView
          colaborator={selectedColaborator}
          dict={colaboratorsDict}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-screen-2xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tr("title", colaboratorsDict)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("subtitle", colaboratorsDict)}
        </p>
      </div>

      <KpiCardsRow kpis={colaboratorsKpis} dict={colaboratorsDict} />

      <ColaboratorGrid
        colaborators={colaborators}
        dict={colaboratorsDict}
        onSelectColaborator={handleSelectColaborator}
      />
    </div>
  );
}
