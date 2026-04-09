"use client";

import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MessageBanner } from "@/features/common/components/message-banner";
import {
  computeCollaboratorsKpis,
  getCollaborators,
} from "../data/collaborators-data-service";
import { useCollaborators } from "../hooks/use-collaborators";
import KpiCardsRow from "./kpi-cards/kpi-cards-row";
import CollaboratorGrid from "./collaborator-grid/collaborator-grid";

/** Grid-shaped skeleton that mirrors the CollaboratorGrid card layout
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

interface CollaboratorsManagementPageProps {
  readonly dict: I18nRecord;
  readonly locale: string;
}

export default function CollaboratorsManagementPage({
  dict,
}: CollaboratorsManagementPageProps) {
  const collaboratorsDict = dict["collaboratorsManagement"] as I18nRecord;
  const gridDict = collaboratorsDict["grid"] as I18nRecord;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();

  const {
    collaborators: backendCollaborators,
    disabled: backendDisabled,
    error,
    isLoading,
    mutate,
  } = useCollaborators();

  // When the pgrest source is disabled (501), silently fall back to the
  // mock data service so the page keeps working in environments that
  // haven't flipped `MIOT_COLLABORATORS_SOURCE=pgrest` yet.
  const collaborators = useMemo(() => {
    if (backendDisabled) return getCollaborators();
    return backendCollaborators;
  }, [backendDisabled, backendCollaborators]);

  // URL-driven filters from the navbar searchbar (see navegation_params.ts
  // entry for `collaborators-management`). KPIs stay based on the
  // unfiltered list so they always show totals; only the grid below
  // reflects the filter. Mirrors the fleet-management page pattern.
  //
  // `name` matches `collaborator.name` (case-insensitive substring).
  // `rut` matches `collaborator.department` because that's where the
  // adapter surfaces `cust_account` from the pgrest view (the only
  // RUT-shaped column available — the view has no driver RUT).
  const filteredCollaborators = useMemo(() => {
    const nameFilter = (searchParams.get("name") ?? "").trim().toLowerCase();
    const rutFilter = (searchParams.get("rut") ?? "").trim().toLowerCase();

    if (!nameFilter && !rutFilter) return collaborators;

    return collaborators.filter((c) => {
      if (nameFilter && !c.name.toLowerCase().includes(nameFilter)) {
        return false;
      }
      if (rutFilter && !c.department.toLowerCase().includes(rutFilter)) {
        return false;
      }
      return true;
    });
  }, [collaborators, searchParams]);

  // Derive the KPI row from the full (unfiltered) list so `total` and
  // the other cards always reflect the real fleet size, regardless of
  // what's currently being searched for. Matches the fleet pattern
  // where KPIs are totals and the grid is what gets filtered.
  const collaboratorsKpis = useMemo(
    () => computeCollaboratorsKpis(collaborators),
    [collaborators]
  );

  // Card click → full page navigation to the driver detail route. Prefer
  // `externalId` (the backend cod_driver) so the detail page hits the
  // real pgrest RPC; fall back to the numeric list `id` for mock rows
  // that don't carry a cod_driver. Mirrors fleet-management's per-vehicle
  // full-page navigation pattern.
  const handleSelectCollaborator = useCallback(
    (id: string) => {
      const target = collaborators.find((c) => c.id === id);
      const segment = target?.externalId ?? id;
      router.push(
        `/${lang}/collaborators-management/${encodeURIComponent(segment)}`
      );
    },
    [collaborators, router, lang]
  );

  const showSkeleton =
    !backendDisabled && isLoading && collaborators.length === 0;
  const showError = !backendDisabled && error && collaborators.length === 0;
  const showEmpty =
    !backendDisabled &&
    !isLoading &&
    !error &&
    filteredCollaborators.length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-screen-2xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {tr("title", collaboratorsDict)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("subtitle", collaboratorsDict)}
        </p>
      </div>

      <KpiCardsRow kpis={collaboratorsKpis} dict={collaboratorsDict} />

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
        <CollaboratorGrid
          collaborators={filteredCollaborators}
          dict={collaboratorsDict}
          onSelectCollaborator={handleSelectCollaborator}
        />
      )}
    </div>
  );
}
