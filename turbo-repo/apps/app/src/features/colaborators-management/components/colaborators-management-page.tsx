"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MessageBanner } from "@/features/common/components/message-banner";
import {
  computeColaboratorsKpis,
  getColaborators,
  getColaboratorNavigation,
} from "../data/colaborators-data-service";
import { getColaboratorDetailData } from "../data/colaborator-detail-mock-data";
import { useCollaborators } from "../hooks/use-collaborators";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import ColaboratorGrid from "./colaborator-grid/colaborator-grid";
import ColaboratorDetailView from "./colaborator-detail/colaborator-detail-view";

/** Grid-shaped skeleton that mirrors the ColaboratorGrid card layout
 * (9 cards × 3 cols on lg). Shown during the initial load so the page
 * doesn't flash empty. Matches the fleet usage-section skeleton pattern. */
function CollaboratorsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-6 w-40 rounded-md bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={`col-skel-${i}`}
            className="h-28 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

interface ColaboratorsManagementPageProps {
  readonly dict: I18nRecord;
  readonly locale: string;
}

export default function ColaboratorsManagementPage({
  dict,
  locale,
}: ColaboratorsManagementPageProps) {
  const colaboratorsDict = dict["colaboratorsManagement"] as I18nRecord;
  const gridDict = colaboratorsDict["grid"] as I18nRecord;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    colaborators: backendColaborators,
    disabled: backendDisabled,
    error,
    isLoading,
    mutate,
  } = useCollaborators();

  // When the pgrest source is disabled (501), silently fall back to the
  // mock data service so the page keeps working in environments that
  // haven't flipped `MIOT_COLLABORATORS_SOURCE=pgrest` yet.
  const colaborators = useMemo(() => {
    if (backendDisabled) return getColaborators();
    return backendColaborators;
  }, [backendDisabled, backendColaborators]);

  // URL-driven filters from the navbar searchbar (see navegation_params.ts
  // entry for `colaborators-management`). KPIs stay based on the
  // unfiltered list so they always show totals; only the grid below
  // reflects the filter. Mirrors the fleet-management page pattern.
  //
  // `name` matches `colaborator.name` (case-insensitive substring).
  // `rut` matches `colaborator.department` because that's where the
  // adapter surfaces `cust_account` from the pgrest view (the only
  // RUT-shaped column available — the view has no driver RUT).
  const filteredColaborators = useMemo(() => {
    const nameFilter = (searchParams.get("name") ?? "").trim().toLowerCase();
    const rutFilter = (searchParams.get("rut") ?? "").trim().toLowerCase();

    if (!nameFilter && !rutFilter) return colaborators;

    return colaborators.filter((c) => {
      if (nameFilter && !c.name.toLowerCase().includes(nameFilter)) {
        return false;
      }
      if (rutFilter && !c.department.toLowerCase().includes(rutFilter)) {
        return false;
      }
      return true;
    });
  }, [colaborators, searchParams]);

  // Derive the KPI row from the full (unfiltered) list so `total` and
  // the other cards always reflect the real fleet size, regardless of
  // what's currently being searched for. Matches the fleet pattern
  // where KPIs are totals and the grid is what gets filtered.
  const colaboratorsKpis = useMemo(
    () => computeColaboratorsKpis(colaborators),
    [colaborators]
  );

  const selectedColaboratorId = searchParams.get("colaborator");

  const selectedColaborator = useMemo(
    () => colaborators.find((c) => c.id === selectedColaboratorId),
    [selectedColaboratorId, colaborators]
  );

  const navigation = useMemo(() => {
    if (!selectedColaboratorId) return null;
    return getColaboratorNavigation(selectedColaboratorId, colaborators);
  }, [selectedColaboratorId, colaborators]);

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

  const handlePrevious = useCallback(() => {
    if (navigation?.previousId) {
      handleSelectColaborator(navigation.previousId);
    }
  }, [navigation, handleSelectColaborator]);

  const handleNext = useCallback(() => {
    if (navigation?.nextId) {
      handleSelectColaborator(navigation.nextId);
    }
  }, [navigation, handleSelectColaborator]);

  if (selectedColaborator && navigation) {
    const detailData = getColaboratorDetailData(selectedColaborator.id);

    if (!detailData) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 w-full h-full">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {tr("detail.noData", colaboratorsDict)}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tr("detail.backToList", colaboratorsDict)}
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 w-full">
        <ColaboratorDetailView
          colaborator={selectedColaborator}
          detailData={detailData}
          dict={colaboratorsDict}
          locale={locale}
          onBack={handleBack}
          previous={{
            hasPrevious: navigation.previousId !== null,
            onPrevious: handlePrevious,
          }}
          next={{
            hasNext: navigation.nextId !== null,
            onNext: handleNext,
          }}
        />
      </div>
    );
  }

  // The skeleton only shows on the *initial* load (SWR has no cached
  // data yet). Subsequent refetches keep the prior rows visible.
  const showSkeleton =
    !backendDisabled && isLoading && colaborators.length === 0;
  const showError = !backendDisabled && error && colaborators.length === 0;
  const showEmpty =
    !backendDisabled &&
    !isLoading &&
    !error &&
    filteredColaborators.length === 0;

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

      {showError && (
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("errorTitle", gridDict)}
          description={tr("errorDesc", gridDict)}
          variant="error"
          label={
            <button
              type="button"
              onClick={() => mutate()}
              className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              {tr("retry", gridDict)}
            </button>
          }
        />
      )}

      {showSkeleton ? (
        <CollaboratorsSkeleton />
      ) : showEmpty ? (
        <MessageBanner
          icon={HiOutlineInformationCircle}
          title={tr("emptyTitle", gridDict)}
          description={tr("emptyDesc", gridDict)}
          variant="info"
        />
      ) : (
        <ColaboratorGrid
          colaborators={filteredColaborators}
          dict={colaboratorsDict}
          onSelectColaborator={handleSelectColaborator}
        />
      )}
    </div>
  );
}
