"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MessageBanner } from "@/features/common/components/message-banner";
import type { Collaborator } from "../../types/collaborators.types";
import { useCollaboratorDetail } from "../../hooks/use-collaborator-detail";
import { useCollaborators } from "../../hooks/use-collaborators";
import {
  getCollaboratorById,
  getCollaborators,
} from "../../data/collaborators-data-service";
import { getCollaboratorDetailData } from "../../data/collaborator-detail-mock-data";
import CollaboratorDetailView from "./collaborator-detail-view";

interface CollaboratorDetailPageProps {
  readonly dict: I18nRecord;
  readonly codDriver: string;
}

/**
 * Grid-shaped skeleton that mirrors the detail layout (header bar, summary
 * row, 6 score cards, timeline placeholder). Shown on the initial load so
 * the page doesn't flash blank while SWR resolves.
 */
function DetailSkeleton() {
  return (
    <div className="flex flex-col h-full items-center w-full">
      <div className="w-full h-24 bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
      <div className="flex-1 min-h-0 overflow-y-auto w-[70vw] max-w-screen-2xl p-4 flex flex-col gap-4">
        <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`score-skel-${i}`}
              className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Walk the list to compute prev/next neighbors for the given driver.
 * Match against both `externalId` (backend path) and `id` (mock fallback
 * path) so the detail page works whether the URL segment is a cod_driver
 * or a numeric list id. Returns null when the list is still loading or
 * the driver isn't in the list at all.
 */
function computeNeighborNav(
  list: Collaborator[],
  routeSegment: string
): {
  prevSegment: string | null;
  nextSegment: string | null;
} | null {
  if (list.length === 0) return null;
  const idx = list.findIndex(
    (c) => c.externalId === routeSegment || c.id === routeSegment
  );
  if (idx === -1) return null;
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;
  return {
    prevSegment: prev ? prev.externalId ?? prev.id : null,
    nextSegment: next ? next.externalId ?? next.id : null,
  };
}

export default function CollaboratorDetailPage({
  dict,
  codDriver,
}: CollaboratorDetailPageProps) {
  const collaboratorsDict = dict["collaboratorsManagement"] as I18nRecord;
  const detailDict = collaboratorsDict["detail"] as I18nRecord;
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();

  const {
    collaborator: backendCollaborator,
    detailData: backendDetailData,
    disabled: backendDisabled,
    notFound,
    error,
    isLoading,
    mutate,
  } = useCollaboratorDetail(codDriver);

  // Pull the list for prev/next navigation. SWR dedupes against the list
  // page's call so there's no extra network cost when the user came here
  // via a card click; direct URL hits pay one fetch for navigation state.
  const { collaborators: backendList, disabled: listDisabled } =
    useCollaborators();

  // Mock-fallback branches. When the pgrest source is disabled the hooks
  // both return `disabled: true` and empty arrays, so we substitute the
  // mock data service at the point of use. The hook fallback branches on
  // the *detail* hook's flag because that's the one the detail UI reads.
  const list = useMemo<Collaborator[]>(() => {
    if (listDisabled) return getCollaborators();
    return backendList;
  }, [listDisabled, backendList]);

  const mockFallback = useMemo(() => {
    if (!backendDisabled) return null;
    // The mock data service keys by numeric id, not cod_driver.
    // Accept either shape — the list-page handoff passes `externalId`
    // when available and falls back to `id` for mock-only rows.
    const mockCollaborator =
      getCollaboratorById(codDriver) ??
      list.find((c) => c.externalId === codDriver || c.id === codDriver);
    if (!mockCollaborator) return null;
    const mockDetail = getCollaboratorDetailData(mockCollaborator.id);
    if (!mockDetail) return null;
    return { collaborator: mockCollaborator, detailData: mockDetail };
  }, [backendDisabled, codDriver, list]);

  const collaborator = backendCollaborator ?? mockFallback?.collaborator ?? null;
  const detailData = backendDetailData ?? mockFallback?.detailData ?? null;

  const navigation = useMemo(
    () => computeNeighborNav(list, codDriver),
    [list, codDriver]
  );

  const handleBack = useCallback(() => {
    router.push(`/${lang}/collaborators-management`);
  }, [router, lang]);

  const handlePrevious = useCallback(() => {
    if (navigation?.prevSegment) {
      router.push(
        `/${lang}/collaborators-management/${encodeURIComponent(
          navigation.prevSegment
        )}`
      );
    }
  }, [navigation, router, lang]);

  const handleNext = useCallback(() => {
    if (navigation?.nextSegment) {
      router.push(
        `/${lang}/collaborators-management/${encodeURIComponent(
          navigation.nextSegment
        )}`
      );
    }
  }, [navigation, router, lang]);

  // Loading — only on the initial load (SWR has no cached payload yet).
  if (isLoading && !collaborator) {
    return <DetailSkeleton />;
  }

  // 404 — driver not found upstream. Empty state + back link.
  if (notFound || (!collaborator && !isLoading && !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-4 p-8">
        <MessageBanner
          icon={HiOutlineInformationCircle}
          title={tr("notFoundTitle", detailDict)}
          description={tr("notFoundDesc", detailDict)}
          variant="info"
        />
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {tr("backToList", detailDict)}
        </button>
      </div>
    );
  }

  // Error — fetch failed, no cached payload to fall back on. Retry cta.
  if (error && !collaborator) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-4 p-8">
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("errorTitle", detailDict)}
          description={tr("errorDesc", detailDict)}
          variant="error"
          label={
            <button
              type="button"
              onClick={() => mutate()}
              className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              {tr("retry", detailDict)}
            </button>
          }
        />
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("backToList", detailDict)}
        </button>
      </div>
    );
  }

  if (!collaborator || !detailData) {
    // Defensive — should be unreachable given the guards above but keeps
    // TypeScript happy.
    return <DetailSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6 w-full mx-auto h-full">
      <CollaboratorDetailView
        collaborator={collaborator}
        detailData={detailData}
        dict={collaboratorsDict}
        locale={lang}
        onBack={handleBack}
        previous={{
          hasPrevious: navigation?.prevSegment !== null && navigation !== null,
          onPrevious: handlePrevious,
        }}
        next={{
          hasNext: navigation?.nextSegment !== null && navigation !== null,
          onNext: handleNext,
        }}
      />
    </div>
  );
}
